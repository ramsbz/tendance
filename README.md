# Tendance — première version

Site web autonome en HTML, CSS et JavaScript.

## Identité visuelle

Le prototype suit désormais la direction retenue : monogramme vert lumineux `#00E676`, noir profond `#0B0F0E`, gris `#A0A6AD` et blanc `#F7F8FA`, avec un mot-symbole sans empattement en minuscules. Le monogramme est disponible dans [logo-symbole.svg](logo-symbole.svg).

## Ouvrir le site

Ouvre `index.html` dans un navigateur récent. Aucune installation ni serveur n'est nécessaire.

## Fonctions incluses

- Ajout d'un vêtement par sélection d'image ou prise de photo sur téléphone.
- Informations manuelles : nom, rôle, type de vêtement, couleur, styles compatibles (plusieurs possibles) et occasions compatibles (facultatives et multiples).
- Types de vêtement courants et champ « Autre (personnalisé) » pour les pièces particulières.
- Styles vestimentaires distincts des occasions, pour que le style choisi guide le planning sans enfermer les vêtements dans un seul contexte.
- Quatre familles de style pour garder le choix simple : classique, décontracté, sport/athleisure et streetwear.
- Filtrage et suppression des vêtements.
- Filtrage combiné des vêtements par catégorie et par style.
- Génération de plannings de 3, 5 ou 7 jours selon l'occasion, à partir des pièces compatibles.
- Aperçu agrandi des combinaisons depuis le planning et Mes tenues.
- Répartition des pièces pour varier les looks quand la garde-robe le permet.
- Évitement de la répétition d'une pièce entre les jours lorsqu'une autre combinaison compatible existe.
- Préférence pour les associations de couleurs équilibrées, sans interdire les contrastes.
- Enregistrement et consultation des tenues préférées.
- Enregistrement individuel des looks préférés depuis le planning, journée par journée.
- Enregistrement de tous les looks non encore gardés avec le bouton « Tout enregistrer ».
- Conservation des données dans le stockage local du navigateur.

Le site comprend maintenant un parcours de compte par e-mail et mot de passe, un nom affiché personnalisable, la synchronisation du dressing et des tenues, ainsi que le chargement des photos privées depuis Supabase. La météo et la reconnaissance automatique par IA ne sont pas encore intégrées.

- Jusqu'à trois accessoires peuvent compléter une tenue, avec une préférence pour des types variés.
- Couleurs adaptées aux accessoires : argent, or, or rose, bronze et transparent/incolore.


## Préparation du stockage cloud (Supabase)

Les fichiers `supabase-schema.sql` et `supabase-config.js` définissent la base et le stockage privé des photos. Le parcours de compte est intégré au site ; pour activer les échanges cloud, le SQL doit être exécuté dans le SQL Editor du projet et l'URL/clé **publishable** renseignées dans `supabase-config.js`. La configuration connue de Tendance est déjà inscrite dans ce fichier. La clé secrète/service role ne doit jamais être placée dans le site web. L'application doit ensuite être servie via un hébergement web (elle ne peut pas accéder au service cloud en ouvrant simplement le fichier `index.html`).

Le schéma applique des règles RLS qui isolent les vêtements, tenues et photos par compte. L'authentification Supabase prend en charge les comptes par e-mail et mot de passe ; les photos du bucket restent privées et sont affichées à l'aide d'URL temporaires. Le site doit être servi depuis `http://localhost` ou un domaine hébergé, pas ouvert avec `file://`. Pour confirmer les nouveaux comptes, règle aussi l'URL locale ou de production dans Authentication > URL Configuration du tableau de bord Supabase.
- Affichage d'un look du jour composé à partir du dressing lorsque les pièces nécessaires sont disponibles ; sinon la zone reste une illustration d'inspiration.
