const STORE_KEY = 'tendance-v1';
const categories = ['Tout', 'Haut', 'Bas', 'Robe', 'Veste', 'Chaussures', 'Accessoire', 'Nuit'];
const fallbackArt = { Haut: '👚', Bas: '👖', Robe: '👗', Veste: '🧥', Chaussures: '👟', Accessoire: '👜', Nuit: '🌙' };
const garmentTypes = {
  Haut: ['T-shirt', 'Chemise', 'Blouse / chemisier', 'Polo', 'Débardeur', 'Pull / maille', 'Gilet', 'Sweat / hoodie', 'Tunique', 'Haut traditionnel', 'Autre (personnalisé)'],
  Bas: ['Jean', 'Pantalon', 'Jupe', 'Short', 'Legging', 'Jogging', 'Pagne / wrapper', 'Bas traditionnel', 'Autre (personnalisé)'],
  Robe: ['Robe', 'Combinaison', 'Boubou / kaftan', 'Abaya / robe longue', 'Ensemble une pièce', 'Autre (personnalisé)'],
  Veste: ['Blazer', 'Veste', 'Manteau', 'Trench', 'Parka / coupe-vent', 'Gilet sans manches', 'Veste traditionnelle', 'Autre (personnalisé)'],
  Chaussures: ['Sneakers', 'Mocassins', 'Chaussures habillées', 'Escarpins / talons', 'Sandales', 'Bottes / bottines', 'Chaussures plates', 'Claquettes / pantoufles', 'Chaussures traditionnelles', 'Autre (personnalisé)'],
  Accessoire: ['Sac', 'Ceinture', 'Foulard / écharpe', 'Chapeau / casquette', 'Bijoux', 'Lunettes', 'Montre', 'Cravate / nœud papillon', 'Voile / couvre-chef', 'Autre (personnalisé)'],
  Nuit: ['Pyjama', 'Chemise de nuit', 'Peignoir', 'Sous-vêtement', 'Chaussettes', 'Autre (personnalisé)']
};
const broadStyles = ['Classique', 'Décontracté', 'Sport & athleisure', 'Streetwear', 'Tous les styles'];
const styleGroups = {
  'Classique / contemporain': 'Classique', 'Minimaliste': 'Classique', 'Preppy': 'Classique', 'Élégant / formel': 'Classique',
  'Smart casual': 'Décontracté', 'Vintage / rétro': 'Décontracté', 'Bohème': 'Décontracté',
  'Indie / alternatif': 'Streetwear', 'Outdoor / utilitaire': 'Sport & athleisure'
};
let state = readState();
let selectedOccasion = 'Toutes les occasions';
let selectedDays = 5;
let currentPlan = [];
let activeCategory = 'Tout';
let activeStyle = 'Tous les styles';
let pendingPhoto = '';
let toastTimer;
let activeCloudUser = null;
let confirmationPending = false;
let confirmationEmail = '';

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)) || { clothes: [], outfits: [] };
    saved.clothes = (saved.clothes || []).map(item => {
      const oldTag = item.style || 'Tous les styles';
      const oldOccasion = item.occasion || (['Décontracté', 'Bureau', 'Sortie', 'Élégant'].includes(oldTag) ? oldTag : 'Toutes les occasions');
      const occasions = normalizeOccasions(item.occasions || [oldOccasion]);
      const oldAesthetics = item.aesthetics || (item.aesthetic ? [item.aesthetic] : ['Tous les styles']);
      const aesthetics = normalizeAesthetics(oldAesthetics);
      return { ...item, occasions, aesthetics, subcategory: item.subcategory || '' };
    });
    saved.outfits ||= [];
    return saved;
  }
  catch { return { clothes: [], outfits: [] }; }
}
function normalizeAesthetics(values) {
  const list = Array.isArray(values) ? values : [values];
  const mapped = list.map(value => styleGroups[value] || (broadStyles.includes(value) ? value : 'Tous les styles'));
  if (mapped.includes('Tous les styles')) return ['Tous les styles'];
  return [...new Set(mapped)].length ? [...new Set(mapped)] : ['Tous les styles'];
}
function normalizeOccasions(values) {
  const list = Array.isArray(values) ? values : [values];
  if (!list.length || list.includes('Toutes les occasions') || list.includes('Tous les styles')) return ['Toutes les occasions'];
  return [...new Set(list)];
}
function itemHasStyle(item, style) {
  const styles = normalizeAesthetics(item.aesthetics || (item.aesthetic ? [item.aesthetic] : ['Tous les styles']));
  return style === 'Tous les styles' || styles.includes(style) || styles.includes('Tous les styles');
}
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(cacheState(state))); }
  catch {
    if (!activeCloudUser) { showToast('Le stockage du navigateur est plein. Essaie une photo plus légère.'); return false; }
  }
  if (activeCloudUser && window.TendanceCloud?.ready()) window.TendanceCloud.sync(activeCloudUser, state).then(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cacheState(state))); } catch { /* Le cloud reste la source de données du compte. */ }
  }).catch(error => showToast(`Synchronisation impossible : ${error.message}`));
  return true;
}
function cacheState(value) {
  const cached = JSON.parse(JSON.stringify(value));
  cached.clothes.forEach(item => { if (item.photo_path) delete item.photo; });
  cached.outfits.forEach(outfit => outfit.items.forEach(item => { if (item.photo_path) delete item.photo; }));
  return cached;
}
function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function photoMarkup(item, extra = '') {
  const image = item.photo ? `<img src="${item.photo}" alt="${safeText(item.name)}">` : `<span class="item-emoji">${fallbackArt[item.category] || '✦'}</span>`;
  return `<div class="item-photo ${extra}">${image}</div>`;
}
function outfitRole(item) {
  const description = `${item.subcategory || ''} ${item.name || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(veste|blazer|manteau|trench|parka|blouson|bomber|coupe-vent|jacket|coat)\b/.test(description)) return 'Veste';
  return item.category;
}
function cardMarkup(item, deletable = true) {
  const role = outfitRole(item);
  const label = role !== item.category ? `${role} · ${item.color}` : `${item.subcategory || item.category} · ${item.color}`;
  return `<article class="item-card">${photoMarkup(item)}${deletable ? `<button class="item-delete" data-delete="${item.id}" aria-label="Supprimer ${safeText(item.name)}">×</button>` : ''}<div class="item-info"><strong>${safeText(item.name)}</strong><span>${safeText(label)}</span></div></article>`;
}
function outfitSignature(items, occasion) {
  return `${occasion}::${items.map(item => item.id).sort().join('|')}`;
}
function isOutfitSaved(items, occasion = selectedOccasion) {
  const signature = outfitSignature(items, occasion);
  return state.outfits.some(outfit => outfitSignature(outfit.items, outfit.occasion) === signature);
}
function syncPlanFavoriteButtons() {
  document.querySelectorAll('[data-save-day]').forEach(button => {
    const outfit = currentPlan.find(item => item.day === Number(button.dataset.saveDay));
    if (!outfit) return;
    const saved = isOutfitSaved(outfit.items);
    button.textContent = saved ? '✓ Gardé' : '♡ Garder ce look';
    button.classList.toggle('saved', saved);
    button.disabled = saved;
  });
  const saveAll = document.querySelector('#save-all-plans');
  if (saveAll) {
    const remaining = currentPlan.filter(outfit => !isOutfitSaved(outfit.items)).length;
    saveAll.textContent = remaining ? `♡ Tout enregistrer (${remaining})` : '✓ Tout enregistré';
    saveAll.disabled = remaining === 0;
  }
}
function render() {
  document.querySelector('#nav-count').textContent = state.clothes.length;
  document.querySelector('#wardrobe-total').textContent = state.clothes.length;
  document.querySelector('#outfit-total').textContent = state.outfits.length;
  document.querySelector('#wardrobe-count-label').textContent = `${state.clothes.length} ${state.clothes.length === 1 ? 'pièce' : 'pièces'}`;

  const preview = document.querySelector('#preview-grid');
  preview.innerHTML = state.clothes.slice(0, 4).map(item => cardMarkup(item)).join('');
  document.querySelector('#preview-empty').classList.toggle('hidden', state.clothes.length > 0);
  preview.classList.toggle('hidden', state.clothes.length === 0);

  document.querySelector('#category-filters').innerHTML = categories.map(category => `<button class="filter-chip ${category === activeCategory ? 'active' : ''}" data-filter="${category}">${category}</button>`).join('');
  document.querySelector('#style-filters').innerHTML = broadStyles.map(style => `<button class="filter-chip ${style === activeStyle ? 'active' : ''}" data-style-filter="${style}">${style}</button>`).join('');
  const filtered = state.clothes.filter(item => (activeCategory === 'Tout' || item.category === activeCategory) && itemHasStyle(item, activeStyle));
  document.querySelector('#wardrobe-grid').innerHTML = filtered.map(item => cardMarkup(item)).join('');
  document.querySelector('#wardrobe-empty').classList.toggle('hidden', state.clothes.length > 0);
  document.querySelector('#filter-empty').classList.toggle('hidden', state.clothes.length === 0 || filtered.length > 0);

  const saved = document.querySelector('#saved-outfits');
  saved.innerHTML = state.outfits.map(outfit => `<article class="saved-card"><div class="saved-card-head"><div><strong>${safeText(outfit.occasion)}${outfit.day ? ` · Jour ${outfit.day}` : ''}</strong><span style="display:block;margin-top:3px">${new Date(outfit.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span></div><div class="saved-card-actions"><button class="saved-zoom" data-zoom-saved="${outfit.id}" aria-label="Agrandir cette tenue">⤢ Agrandir</button><button class="saved-remove" data-remove-outfit="${outfit.id}" aria-label="Supprimer cette tenue">×</button></div></div><div class="saved-pieces">${outfit.items.map(item => `<div>${photoMarkup(item)}<small>${safeText(item.name)}</small></div>`).join('')}</div></article>`).join('');
  document.querySelector('#saved-empty').classList.toggle('hidden', state.outfits.length > 0);
  updateHeroDailyLook();
  bindDeleteButtons();
  syncPlanFavoriteButtons();
}
function bindDeleteButtons() {
  document.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => {
    state.clothes = state.clothes.filter(item => item.id !== button.dataset.delete);
    state.outfits = state.outfits.map(outfit => ({ ...outfit, items: outfit.items.filter(item => item.id !== button.dataset.delete) })).filter(outfit => outfit.items.length);
    persist(); render(); showToast('Pièce retirée de ton dressing.');
  });
  document.querySelectorAll('[data-remove-outfit]').forEach(button => button.onclick = () => {
    state.outfits = state.outfits.filter(outfit => outfit.id !== button.dataset.removeOutfit);
    persist(); render(); showToast('Tenue supprimée.');
  });
}
function showToast(message) {
  const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
function setView(view) {
  const pageIds = { accueil: 'home-view', 'garde-robe': 'wardrobe-view', tenues: 'tenues-view' };
  const pageId = pageIds[view];
  if (!pageId) return;
  document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
  document.querySelector(`#${pageId}`).classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  document.querySelector('#crumb').textContent = view === 'accueil' ? 'Accueil' : view === 'garde-robe' ? 'Ma garde-robe' : 'Mes tenues';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function openAddDialog() {
  pendingPhoto = '';
  document.querySelector('#clothing-form').reset();
  populateGarmentTypes();
  const preview = document.querySelector('#photo-preview');
  preview.src = '';
  preview.classList.add('hidden');
  document.querySelector('#photo-input').value = '';
  document.querySelector('#camera-input').value = '';
  document.querySelector('#form-error').classList.add('hidden');
  document.querySelector('#add-dialog').showModal();
}
function populateGarmentTypes() {
  const category = document.querySelector('#item-category').value;
  const select = document.querySelector('#item-type');
  const types = garmentTypes[category] || [];
  select.innerHTML = `<option value="">Choisir un type</option>${types.map(type => `<option value="${type.startsWith('Autre') ? 'Autre' : safeText(type)}">${safeText(type)}</option>`).join('')}`;
  const custom = document.querySelector('#custom-type-wrap');
  const customInput = document.querySelector('#custom-type');
  const isCustom = select.value === 'Autre';
  custom.classList.toggle('hidden', !isCustom);
  customInput.required = isCustom;
  if (!isCustom) customInput.value = '';
}
function colorPairScore(first, second) {
  if (!first || !second) return 1;
  const neutrals = ['Noir', 'Blanc', 'Beige', 'Marron', 'Gris', 'Argent', 'Or', 'Or rose', 'Bronze', 'Transparent / incolore'];
  if (first === 'Multicolore' || second === 'Multicolore') return neutrals.includes(first) || neutrals.includes(second) ? 2.5 : 0.75;
  if (neutrals.includes(first) || neutrals.includes(second)) return 3;
  if (first === second) return 2.5;
  const pairings = { Bleu: ['Vert', 'Rose', 'Jaune'], Vert: ['Bleu', 'Jaune', 'Rose'], Rouge: ['Bleu', 'Rose', 'Jaune'], Rose: ['Bleu', 'Vert', 'Rouge'], Jaune: ['Bleu', 'Vert', 'Rouge'] };
  return pairings[first]?.includes(second) || pairings[second]?.includes(first) ? 2 : 1;
}
function colorScore(items) {
  if (items.length < 2) return 1;
  let score = 0, pairs = 0;
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    score += colorPairScore(items[a].color, items[b].color); pairs++;
  }
  return score / pairs;
}
function weightedPick(items, scoreFor, random = Math.random) {
  if (!items.length) return null;
  const scores = items.map(scoreFor);
  const min = Math.min(...scores);
  const weights = scores.map(score => 1 + Math.max(0, score - min) * 1.4);
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < items.length; index++) {
    roll -= weights[index];
    if (roll <= 0) return items[index];
  }
  return items[items.length - 1];
}
function composePlan(occasion, days, aesthetic, random = Math.random) {
  const eligible = state.clothes.filter(item => {
    const occasions = normalizeOccasions(item.occasions || [item.occasion || 'Toutes les occasions']);
    const occasionMatches = occasion === 'Toutes les occasions' || occasions.includes('Toutes les occasions') || occasions.includes(occasion);
    return !item.category.startsWith('Nuit') && occasionMatches;
  });
  const bases = eligible.filter(item => outfitRole(item) === 'Robe').map(item => [item]);
  const tops = eligible.filter(item => outfitRole(item) === 'Haut');
  const bottoms = eligible.filter(item => outfitRole(item) === 'Bas');
  tops.forEach(top => bottoms.forEach(bottom => bases.push([top, bottom])));
  if (!bases.length) return null;

  const usage = new Map();
  const usedBases = new Set();
  const plan = [];
  let currentBase = [];
  const takeLeastUsed = items => {
    if (!items.length) return null;
    const least = Math.min(...items.map(item => usage.get(item.id) || 0));
    const options = items.filter(item => (usage.get(item.id) || 0) === least);
    return weightedPick(options, item => colorScore([...currentBase, item]), random);
  };
  for (let day = 1; day <= days; day++) {
    const unused = bases.filter(base => !usedBases.has(base.map(item => item.id).sort().join('|')));
    const choices = unused.length ? unused : bases;
    const minRepeatedPieces = Math.min(...choices.map(base => base.filter(item => (usage.get(item.id) || 0) > 0).length));
    let candidates = choices.filter(base => base.filter(item => (usage.get(item.id) || 0) > 0).length === minRepeatedPieces);
    if (aesthetic !== 'Tous les styles') {
      const bestStyleFit = Math.max(...candidates.map(base => base.filter(item => itemHasStyle(item, aesthetic)).length));
      if (bestStyleFit > 0) candidates = candidates.filter(base => base.filter(item => itemHasStyle(item, aesthetic)).length === bestStyleFit);
    }
    const leastUse = Math.min(...candidates.map(base => base.reduce((sum, item) => sum + (usage.get(item.id) || 0), 0)));
    candidates = candidates.filter(base => base.reduce((sum, item) => sum + (usage.get(item.id) || 0), 0) === leastUse);
    const base = weightedPick(candidates, colorScore, random);
    currentBase = [...base];
    const key = base.map(item => item.id).sort().join('|');
    usedBases.add(key);
    const items = [...base];
    for (const category of ['Veste', 'Chaussures']) {
      let options = eligible.filter(item => outfitRole(item) === category);
      if (aesthetic !== 'Tous les styles') {
        const matching = options.filter(item => itemHasStyle(item, aesthetic));
        if (matching.some(item => (item.aesthetics || []).includes(aesthetic))) options = matching;
      }
      const complement = takeLeastUsed(options);
      if (complement) items.push(complement);
    }
    let accessoryOptions = eligible.filter(item => outfitRole(item) === 'Accessoire');
    if (aesthetic !== 'Tous les styles') {
      const matching = accessoryOptions.filter(item => itemHasStyle(item, aesthetic));
      if (matching.some(item => (item.aesthetics || []).includes(aesthetic))) accessoryOptions = matching;
    }
    const chosenAccessories = [];
    for (let count = 0; count < 3 && accessoryOptions.some(item => !chosenAccessories.includes(item)); count++) {
      const remaining = accessoryOptions.filter(item => !chosenAccessories.includes(item));
      const availableTypes = new Set(remaining.map(item => (item.subcategory || '').trim().toLocaleLowerCase()).filter(Boolean));
      let diverseOptions = remaining;
      if (chosenAccessories.length && availableTypes.size > 1) {
        const unusedTypes = remaining.filter(item => !chosenAccessories.some(chosen => (chosen.subcategory || '').trim().toLocaleLowerCase() === (item.subcategory || '').trim().toLocaleLowerCase()));
        if (unusedTypes.length) diverseOptions = unusedTypes;
      }
      const accessory = takeLeastUsed(diverseOptions);
      if (!accessory) break;
      chosenAccessories.push(accessory);
      items.push(accessory);
      currentBase.push(accessory);
    }
    items.forEach(item => usage.set(item.id, (usage.get(item.id) || 0) + 1));
    plan.push({ day, items });
  }
  return plan;
}
function updateHeroDailyLook() {
  const hero = document.querySelector('#hero-art');
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const closetKey = state.clothes.map(item => item.id).sort().join('|');
  let seed = 2166136261;
  for (const char of `${dateKey}|${closetKey}`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const dailyRandom = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const look = composePlan('Toutes les occasions', 1, 'Tous les styles', dailyRandom)?.[0];
  if (!look) {
    hero.classList.remove('has-daily-look');
    hero.setAttribute('aria-label', 'Inspiration mode du jour');
    hero.innerHTML = '<div class="art-sun"></div><div class="art-plant plant-one">✽</div><div class="art-plant plant-two">✳</div><div class="art-frame"><div class="art-blouse"></div><div class="art-trouser"></div><div class="art-scarf"></div></div><div class="art-caption">INSPIRATION TENDANCE <span>✦</span></div><div class="art-sticker">une pièce<br>après l\'autre <b>✦</b></div>';
    return;
  }
  hero.classList.add('has-daily-look');
  hero.setAttribute('aria-label', 'Tenue du jour composée avec les vêtements de ton dressing');
  hero.innerHTML = `${outfitStageMarkup(look.items, 'hero-outfit-stage')}<div class="art-caption">LE LOOK DU JOUR<span>${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span></div>`;
}
function outfitStageMarkup(items, extraClass = '') {
  const slots = { top: null, bottom: null, dress: null, jacket: null, accessories: [], shoes: null };
  items.forEach(item => {
    const role = outfitRole(item);
    if (role === 'Haut') slots.top = item;
    else if (role === 'Bas') slots.bottom = item;
    else if (role === 'Robe') slots.dress = item;
    else if (role === 'Veste') slots.jacket = item;
    else if (role === 'Accessoire') slots.accessories.push(item);
    else if (role === 'Chaussures') slots.shoes = item;
  });
  const piece = (item, position) => item ? `<div class="outfit-piece slot-${position}">${photoMarkup(item)}<span>${safeText(item.name)}</span></div>` : '';
  const accessories = slots.accessories.slice(0, 3).map((item, index) => piece(item, `accessory-${index + 1}`)).join('');
  return `<div class="outfit-stage ${extraClass}">${piece(slots.top, 'top')}${piece(slots.bottom, 'bottom')}${piece(slots.dress, 'dress')}${piece(slots.jacket, 'jacket')}${accessories}${piece(slots.shoes, 'shoes')}</div>`;
}
function savePlanDay(day) {
  const outfit = currentPlan.find(item => item.day === day);
  if (!outfit || isOutfitSaved(outfit.items)) return;
  const record = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${day}`, occasion: selectedOccasion, day, createdAt: new Date().toISOString(), items: outfit.items };
  state.outfits.unshift(record);
  if (!persist()) { state.outfits.shift(); return; }
  render();
  showToast('Look ajouté à Mes tenues.');
}
function saveAllPlan() {
  const pending = currentPlan.filter(outfit => !isOutfitSaved(outfit.items));
  if (!pending.length) return;
  const createdAt = new Date().toISOString();
  const records = pending.map(outfit => ({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${outfit.day}`, occasion: selectedOccasion, day: outfit.day, createdAt, items: outfit.items }));
  const previous = state.outfits;
  state.outfits = [...records, ...previous];
  if (!persist()) { state.outfits = previous; return; }
  render();
  showToast(`${records.length} look${records.length > 1 ? 's' : ''} ajouté${records.length > 1 ? 's' : ''} à Mes tenues.`);
}
function generateOutfit() {
  if (state.clothes.length === 0) {
    showToast('Ajoute quelques vêtements à ton dressing pour composer un look.');
    setView('garde-robe');
    return;
  }
  selectedOccasion = document.querySelector('#plan-occasion').value;
  const aesthetic = document.querySelector('#plan-style').value;
  currentPlan = composePlan(selectedOccasion, selectedDays, aesthetic) || [];
  if (!currentPlan.length) {
    showToast(`Il te faut au moins un haut et un bas adaptés à « ${selectedOccasion} », ou une robe.`);
    return;
  }
  document.querySelector('#result-occasion').textContent = selectedOccasion.toLowerCase();
  document.querySelector('#result-aesthetic').textContent = aesthetic === 'Tous les styles' ? 'tous les styles' : aesthetic;
  document.querySelector('#outfit-result').innerHTML = currentPlan.map(outfit => {
    return `<article class="day-look"><div class="day-look-title"><strong>Jour ${outfit.day}</strong><span>${safeText(selectedOccasion)}</span></div><div class="day-look-actions"><button class="day-zoom" type="button" data-zoom-day="${outfit.day}" aria-label="Agrandir la tenue du jour ${outfit.day}">⤢ Agrandir</button><button class="favorite-look" type="button" data-save-day="${outfit.day}">♡ Garder ce look</button></div>${outfitStageMarkup(outfit.items)}</article>`;
  }).join('');
  document.querySelector('#result-section').classList.remove('hidden');
  document.querySelector('#result-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  syncPlanFavoriteButtons();
}

document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => setView(link.dataset.view)));
document.querySelectorAll('[data-open-wardrobe]').forEach(button => button.addEventListener('click', () => setView('garde-robe')));
document.querySelector('#global-add').addEventListener('click', openAddDialog);
document.querySelector('#add-from-home').addEventListener('click', openAddDialog);
document.querySelector('#jump-generator').addEventListener('click', () => document.querySelector('#generator-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }));
document.querySelector('#hero-generate').addEventListener('click', generateOutfit);
document.querySelector('#generate').addEventListener('click', generateOutfit);
document.querySelector('#another-look').addEventListener('click', generateOutfit);
document.querySelector('#save-all-plans').addEventListener('click', saveAllPlan);
document.querySelector('#outfit-result').addEventListener('click', event => {
  const saveButton = event.target.closest('[data-save-day]');
  if (saveButton) { savePlanDay(Number(saveButton.dataset.saveDay)); return; }
  const button = event.target.closest('[data-zoom-day]');
  if (!button) return;
  const outfit = currentPlan.find(item => item.day === Number(button.dataset.zoomDay));
  if (!outfit) return;
  document.querySelector('#zoom-title').textContent = `Jour ${outfit.day} · ${selectedOccasion}`;
  document.querySelector('#zoom-stage').innerHTML = outfitStageMarkup(outfit.items, 'zoom-stage');
  document.querySelector('#look-zoom-dialog').showModal();
});
document.querySelector('#saved-outfits').addEventListener('click', event => {
  const button = event.target.closest('[data-zoom-saved]');
  if (!button) return;
  const outfit = state.outfits.find(item => item.id === button.dataset.zoomSaved);
  if (!outfit) return;
  document.querySelector('#zoom-title').textContent = `${outfit.occasion}${outfit.day ? ` · Jour ${outfit.day}` : ''}`;
  document.querySelector('#zoom-stage').innerHTML = outfitStageMarkup(outfit.items, 'zoom-stage');
  document.querySelector('#look-zoom-dialog').showModal();
});
document.querySelector('#close-zoom').addEventListener('click', () => document.querySelector('#look-zoom-dialog').close());
document.querySelectorAll('.day-option').forEach(option => option.addEventListener('click', () => {
  selectedDays = Number(option.dataset.days);
  document.querySelectorAll('.day-option').forEach(other => other.classList.toggle('selected', other === option));
}));
document.querySelector('#item-category').addEventListener('change', populateGarmentTypes);
document.querySelector('#item-type').addEventListener('change', () => {
  const isCustom = document.querySelector('#item-type').value === 'Autre';
  document.querySelector('#custom-type-wrap').classList.toggle('hidden', !isCustom);
  document.querySelector('#custom-type').required = isCustom;
  if (!isCustom) document.querySelector('#custom-type').value = '';
});
document.querySelectorAll('input[name="garment-style"]').forEach(input => input.addEventListener('change', event => {
  const allStyles = document.querySelector('input[name="garment-style"][value="Tous les styles"]');
  const specific = [...document.querySelectorAll('input[name="garment-style"]')].filter(option => option.value !== 'Tous les styles');
  if (event.target === allStyles && allStyles.checked) specific.forEach(option => option.checked = false);
  else if (event.target !== allStyles && event.target.checked) allStyles.checked = false;
  if (!specific.some(option => option.checked)) allStyles.checked = true;
}));
document.querySelectorAll('input[name="garment-occasion"]').forEach(input => input.addEventListener('change', event => {
  const allOccasions = document.querySelector('input[name="garment-occasion"][value="Toutes les occasions"]');
  const specific = [...document.querySelectorAll('input[name="garment-occasion"]')].filter(option => option.value !== 'Toutes les occasions');
  if (event.target === allOccasions && allOccasions.checked) specific.forEach(option => option.checked = false);
  else if (event.target !== allOccasions && event.target.checked) allOccasions.checked = false;
  if (!specific.some(option => option.checked)) allOccasions.checked = true;
}));
['#open-add', '#empty-add', '#add-first'].forEach(selector => document.querySelector(selector).addEventListener('click', openAddDialog));
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => document.querySelector('#add-dialog').close()));
document.querySelector('#choose-gallery').addEventListener('click', () => document.querySelector('#photo-input').click());
document.querySelector('#take-photo').addEventListener('click', () => document.querySelector('#camera-input').click());
document.querySelectorAll('#photo-input, #camera-input').forEach(input => input.addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  event.target.value = '';
  const error = document.querySelector('#form-error');
  if (!file.type.startsWith('image/')) { error.textContent = 'Choisis un fichier image.'; error.classList.remove('hidden'); return; }
  if (file.size > 8 * 1024 * 1024) { error.textContent = 'Cette image dépasse 8 Mo. Choisis une image plus légère.'; error.classList.remove('hidden'); event.target.value = ''; return; }
  try {
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = new Image(); image.src = dataUrl; await image.decode();
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    pendingPhoto = canvas.toDataURL('image/jpeg', .78);
    const preview = document.querySelector('#photo-preview'); preview.src = pendingPhoto; preview.classList.remove('hidden'); error.classList.add('hidden');
  } catch { error.textContent = 'Impossible de lire cette image. Essaie un autre fichier.'; error.classList.remove('hidden'); }
}));
document.querySelector('#clothing-form').addEventListener('submit', event => {
  event.preventDefault();
  const error = document.querySelector('#form-error');
  const chosenType = document.querySelector('#item-type').value;
  const selectedStyles = [...document.querySelectorAll('input[name="garment-style"]:checked')].map(input => input.value);
  const selectedOccasions = [...document.querySelectorAll('input[name="garment-occasion"]:checked')].map(input => input.value);
  const item = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name: document.querySelector('#item-name').value.trim(), category: document.querySelector('#item-category').value, subcategory: chosenType === 'Autre' ? document.querySelector('#custom-type').value.trim() : chosenType, color: document.querySelector('#item-color').value, aesthetics: selectedStyles.length ? selectedStyles : ['Tous les styles'], occasions: normalizeOccasions(selectedOccasions), photo: pendingPhoto };
  state.clothes.unshift(item);
  if (!persist()) { state.clothes.shift(); error.textContent = 'Espace de stockage insuffisant. Choisis une image plus petite ou enlève la photo.'; error.classList.remove('hidden'); return; }
  document.querySelector('#add-dialog').close(); render(); showToast(`${item.name} a été ajouté à ton dressing.`);
});
document.querySelector('#category-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]'); if (!button) return;
  activeCategory = button.dataset.filter; render();
});
document.querySelector('#style-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-style-filter]'); if (!button) return;
  activeStyle = button.dataset.styleFilter; render();
});
document.querySelector('#clear-filters').addEventListener('click', () => {
  activeCategory = 'Tout'; activeStyle = 'Tous les styles'; render();
});
document.querySelector('#new-from-saved').addEventListener('click', () => setView('accueil'));
document.querySelector('#saved-generate').addEventListener('click', () => setView('accueil'));

const now = new Date();
populateGarmentTypes();
document.querySelector('#today').textContent = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
document.querySelector('.welcome-row .eyebrow').textContent = `${now.toLocaleDateString('fr-FR', { weekday: 'long' }).toUpperCase()} · INSPIRATION DU JOUR`;
render();

// Compte et synchronisation Supabase
let accountCreateMode = false;
function updateAccountUi(user) {
  if (confirmationPending && !user) {
    document.querySelector('#account-title').textContent = 'Confirme ton adresse e-mail';
    document.querySelector('#account-intro').textContent = 'Ton inscription est presque terminée.';
    document.querySelector('#account-notice').textContent = `Un e-mail de confirmation a été envoyé à ${confirmationEmail}. Vérifie aussi les courriers indésirables. Clique sur le lien, puis reviens ici pour te connecter.`;
    document.querySelector('#account-notice').classList.remove('hidden');
    document.querySelector('#account-error').classList.add('hidden');
    document.querySelectorAll('.auth-field, #account-profile-field, #account-save-profile, #account-actions, #account-logout').forEach(element => element.classList.add('hidden'));
    document.querySelector('#account-resend-confirmation').classList.remove('hidden');
    document.querySelector('#account-back-to-login').classList.remove('hidden');
    return;
  }
  document.querySelector('#account-notice').classList.add('hidden');
  document.querySelector('#account-resend-confirmation').classList.add('hidden');
  document.querySelector('#account-back-to-login').classList.add('hidden');
  const displayName = user?.user_metadata?.display_name || '';
  document.querySelector('#account-name').textContent = user ? (displayName || user.email?.split('@')[0] || 'Mon espace') : 'Mon espace';
  document.querySelector('#account-status').textContent = user ? 'Synchronisé sur tes appareils' : (window.TendanceCloud?.ready() ? 'Connecte-toi pour synchroniser' : 'Données sur cet appareil');
  document.querySelector('#account-avatar').textContent = user ? (displayName[0] || user.email?.[0] || 'T').toUpperCase() : 'T';
  document.querySelector('#welcome-name').textContent = displayName ? `${displayName}.` : 'toi.';
  document.querySelector('#account-title').textContent = user ? 'Ton compte' : accountCreateMode ? 'Créer un compte' : 'Connexion';
  document.querySelector('#account-intro').textContent = user ? `Connecté avec ${user.email}. Tes vêtements, tenues et photos sont synchronisés.` : 'Connecte-toi pour retrouver ta garde-robe et tes tenues sur tes appareils.';
  document.querySelectorAll('.auth-field').forEach(field => field.classList.toggle('hidden', Boolean(user)));
  document.querySelector('#account-profile-field').classList.toggle('hidden', !user && !accountCreateMode);
  document.querySelector('#account-display-name').required = !user && accountCreateMode;
  document.querySelector('#account-display-name').value = displayName;
  document.querySelector('#account-save-profile').classList.toggle('hidden', !user);
  document.querySelector('#account-toggle').classList.toggle('hidden', Boolean(user));
  document.querySelector('#account-submit').classList.toggle('hidden', Boolean(user));
  document.querySelector('#account-logout').classList.toggle('hidden', !user);
  document.querySelector('#account-error').classList.add('hidden');
}
async function handleCloudUser(user) {
  if (user?.id === activeCloudUser?.id) return;
  if (!user) {
    if (activeCloudUser) { activeCloudUser = null; state = { clothes: [], outfits: [] }; localStorage.removeItem(STORE_KEY); render(); showToast('Tu es déconnecté·e.'); }
    updateAccountUi(null); return;
  }
  confirmationPending = false;
  const localState = state;
  try {
    const remote = await window.TendanceCloud.load(user);
    const cloudHasData = remote.clothes.length || remote.outfits.length;
    const clothes = cloudHasData ? [...remote.clothes, ...localState.clothes.filter(item => !remote.clothes.some(cloudItem => cloudItem.id === item.id))] : localState.clothes;
    const outfits = cloudHasData ? [...remote.outfits, ...localState.outfits.filter(item => !remote.outfits.some(cloudItem => cloudItem.id === item.id))] : localState.outfits;
    activeCloudUser = user;
    state = { clothes, outfits };
    localStorage.setItem(STORE_KEY, JSON.stringify(cacheState(state)));
    render(); updateAccountUi(user);
    await window.TendanceCloud.sync(user, state);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cacheState(state))); } catch { /* Les données du compte sont conservées dans Supabase. */ }
    showToast(cloudHasData ? 'Ta garde-robe est synchronisée.' : 'Ton espace cloud est prêt.');
  } catch (error) {
    activeCloudUser = null;
    updateAccountUi(null);
    showToast(`Connexion cloud impossible : ${error.message}`);
  }
}
document.querySelector('#account-button').addEventListener('click', () => {
  updateAccountUi(activeCloudUser);
  if (!window.TendanceCloud?.ready()) document.querySelector('#account-error').textContent = 'Configuration Supabase manquante. Vérifie supabase-config.js.';
  document.querySelector('#account-dialog').showModal();
});
document.querySelector('#account-button').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.querySelector('#account-button').click(); } });
document.querySelector('[data-close-account]').addEventListener('click', () => document.querySelector('#account-dialog').close());
document.querySelector('#account-back-to-login').addEventListener('click', () => {
  confirmationPending = false; confirmationEmail = ''; accountCreateMode = false;
  document.querySelector('#account-password').value = '';
  updateAccountUi(null);
  document.querySelector('#account-submit').textContent = 'Se connecter →';
});
document.querySelector('#account-resend-confirmation').addEventListener('click', async () => {
  const { error } = await window.TendanceCloud.resendConfirmation(confirmationEmail);
  const notice = document.querySelector('#account-notice');
  if (error) { const errorNode = document.querySelector('#account-error'); errorNode.textContent = error.message; errorNode.classList.remove('hidden'); }
  else { notice.textContent = `Un nouveau message de confirmation a été envoyé à ${confirmationEmail}.`; }
});
document.querySelector('#account-toggle').addEventListener('click', () => { accountCreateMode = !accountCreateMode; updateAccountUi(activeCloudUser); document.querySelector('#account-submit').textContent = accountCreateMode ? 'Créer mon compte →' : 'Se connecter →'; });
document.querySelector('#account-save-profile').addEventListener('click', async () => {
  const name = document.querySelector('#account-display-name').value.trim();
  const errorNode = document.querySelector('#account-error');
  if (!name) { errorNode.textContent = 'Saisis le nom que tu veux afficher.'; errorNode.classList.remove('hidden'); return; }
  const { data, error } = await window.TendanceCloud.updateProfile(name);
  if (error) { errorNode.textContent = error.message; errorNode.classList.remove('hidden'); return; }
  updateAccountUi(data.user); showToast('Ton nom d’utilisateur a été mis à jour.');
});
document.querySelector('#account-form').addEventListener('submit', async event => {
  event.preventDefault();
  const errorNode = document.querySelector('#account-error');
  errorNode.classList.add('hidden');
  document.querySelector('#account-notice').classList.add('hidden');
  if (!window.TendanceCloud?.ready()) { errorNode.textContent = 'Supabase n’est pas configuré.'; errorNode.classList.remove('hidden'); return; }
  const email = document.querySelector('#account-email').value.trim();
  const password = document.querySelector('#account-password').value;
  const displayName = document.querySelector('#account-display-name').value.trim();
  const result = accountCreateMode ? await window.TendanceCloud.signUp(email, password, displayName) : await window.TendanceCloud.signIn(email, password);
  if (result.error) { errorNode.textContent = result.error.message; errorNode.classList.remove('hidden'); return; }
  if (accountCreateMode && !result.data.session) {
    confirmationPending = true; confirmationEmail = email;
    updateAccountUi(null); return;
  }
  document.querySelector('#account-dialog').close();
});
document.querySelector('#account-logout').addEventListener('click', async () => {
  const { error } = await window.TendanceCloud.signOut();
  if (error) { const node = document.querySelector('#account-error'); node.textContent = error.message; node.classList.remove('hidden'); }
  else document.querySelector('#account-dialog').close();
});
if (window.TendanceCloud?.ready()) window.TendanceCloud.onAuthChange(user => handleCloudUser(user));

document.querySelector('#mobile-account-button').addEventListener('click', () => document.querySelector('#account-button').click());


document.querySelector('#mobile-brand').addEventListener('click', event => { event.preventDefault(); setView('accueil'); });

