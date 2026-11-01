(() => {
  const BUCKET = 'wardrobe-photos';
  let client = null;
  let syncQueue = Promise.resolve();
  function getClient() {
    if (client) return client;
    const ready = window.TENDANCE_SUPABASE_URL && window.TENDANCE_SUPABASE_PUBLISHABLE_KEY && window.supabase?.createClient;
    if (!ready) return null;
    client = window.supabase.createClient(window.TENDANCE_SUPABASE_URL, window.TENDANCE_SUPABASE_PUBLISHABLE_KEY);
    return client;
  }
  function imageDataToBlob(dataUrl) {
    const [header, encoded] = dataUrl.split(',');
    const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new Blob([bytes], { type: mime });
  }
  async function withSignedPhoto(item, supabase) {
    const next = { ...item };
    if (!next.photo_path) return next;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(next.photo_path, 60 * 60 * 24 * 6);
    if (error) throw error;
    next.photo = data.signedUrl;
    return next;
  }
  async function load(user) {
    const supabase = getClient();
    if (!supabase) return null;
    const [clothesResult, outfitsResult] = await Promise.all([
      supabase.from('wardrobe_items').select('*').eq('user_id', user.id),
      supabase.from('saved_outfits').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ]);
    if (clothesResult.error) throw clothesResult.error;
    if (outfitsResult.error) throw outfitsResult.error;
    const clothes = await Promise.all(clothesResult.data.map(async row => ({
      id: row.id, name: row.name, category: row.category, subcategory: row.subcategory, color: row.color,
      aesthetics: row.aesthetics, occasions: row.occasions, photo_path: row.photo_path,
      ...(row.photo_path ? { photo: (await withSignedPhoto({ photo_path: row.photo_path }, supabase)).photo } : {})
    })));
    const outfits = await Promise.all(outfitsResult.data.map(async row => ({
      id: row.id, occasion: row.occasion, day: row.day, createdAt: row.created_at,
      items: await Promise.all((row.items || []).map(item => withSignedPhoto(item, supabase)))
    })));
    return { clothes, outfits };
  }
  async function sync(user, state) {
    const supabase = getClient();
    if (!supabase) return;
    syncQueue = syncQueue.catch(() => {}).then(async () => {
      const existing = await supabase.from('wardrobe_items').select('id,photo_path').eq('user_id', user.id);
      if (existing.error) throw existing.error;
      const previousPaths = existing.data.map(row => row.photo_path).filter(Boolean);
      const rows = [];
      for (const item of state.clothes) {
        let photoPath = item.photo_path || null;
        if (item.photo?.startsWith('data:image/')) {
          photoPath = `${user.id}/${item.id}.jpg`;
          const { error } = await supabase.storage.from(BUCKET).upload(photoPath, imageDataToBlob(item.photo), { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
          if (error) throw error;
          item.photo_path = photoPath;
        }
        rows.push({ id: item.id, user_id: user.id, name: item.name, category: item.category, subcategory: item.subcategory || '', color: item.color, aesthetics: item.aesthetics || ['Tous les styles'], occasions: item.occasions || ['Toutes les occasions'], photo_path: photoPath, updated_at: new Date().toISOString() });
      }
      if (rows.length) {
        const result = await supabase.from('wardrobe_items').upsert(rows, { onConflict: 'user_id,id' });
        if (result.error) throw result.error;
      }
      const keepIds = state.clothes.map(item => item.id);
      if (keepIds.length) {
        const result = await supabase.from('wardrobe_items').delete().eq('user_id', user.id).not('id', 'in', `(${keepIds.map(id => `"${id}"`).join(',')})`);
        if (result.error) throw result.error;
      } else {
        const result = await supabase.from('wardrobe_items').delete().eq('user_id', user.id);
        if (result.error) throw result.error;
      }
      const pathById = new Map(existing.data.map(row => [row.id, row.photo_path || null]));
      state.clothes.forEach(item => pathById.set(item.id, item.photo_path || pathById.get(item.id) || null));
      const outfitRows = state.outfits.map(outfit => ({
        id: outfit.id, user_id: user.id, occasion: outfit.occasion || 'Toutes les occasions', day: outfit.day || null, created_at: outfit.createdAt || new Date().toISOString(),
        items: outfit.items.map(item => ({ ...item, photo: undefined, photo_path: item.photo_path || pathById.get(item.id) || null }))
      }));
      if (outfitRows.length) {
        const result = await supabase.from('saved_outfits').upsert(outfitRows, { onConflict: 'user_id,id' });
        if (result.error) throw result.error;
      }
      const outfitIds = state.outfits.map(outfit => outfit.id);
      if (outfitIds.length) {
        const result = await supabase.from('saved_outfits').delete().eq('user_id', user.id).not('id', 'in', `(${outfitIds.map(id => `"${id}"`).join(',')})`);
        if (result.error) throw result.error;
      } else {
        const result = await supabase.from('saved_outfits').delete().eq('user_id', user.id);
        if (result.error) throw result.error;
      }
      const retainedPaths = new Set([...state.clothes.map(item => item.photo_path), ...state.outfits.flatMap(outfit => outfit.items.map(item => item.photo_path || pathById.get(item.id)))].filter(Boolean));
      const obsolete = previousPaths.filter(path => !retainedPaths.has(path));
      if (obsolete.length) {
        const result = await supabase.storage.from(BUCKET).remove(obsolete);
        if (result.error) throw result.error;
      }
    });
    return syncQueue;
  }
  window.TendanceCloud = {
    ready: () => Boolean(getClient()),
    getUser: async () => { const supabase = getClient(); if (!supabase) return null; const { data, error } = await supabase.auth.getUser(); if (error) throw error; return data.user; },
    onAuthChange: callback => { const supabase = getClient(); if (supabase) supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null)); },
    signUp: (email, password, displayName) => getClient().auth.signUp({ email, password, options: { data: { display_name: displayName } } }),
    updateProfile: displayName => getClient().auth.updateUser({ data: { display_name: displayName } }),
    resendConfirmation: email => getClient().auth.resend({ type: 'signup', email }),
    signIn: (email, password) => getClient().auth.signInWithPassword({ email, password }),
    signOut: () => getClient().auth.signOut(), load, sync
  };
})();
