# Tendance — brief de la première version

## Vision

Tendance aide à choisir quoi porter en proposant des tenues à partir des vêtements que la personne possède déjà. La promesse est de réduire l'hésitation au quotidien et de faire redécouvrir sa garde-robe, sans pousser à acheter davantage.

## Public de départ

Jeunes adultes et personnes qui travaillent, avec des besoins de tenues pour le bureau, les journées décontractées et les sorties.

## Plateforme

Un site web responsive, utilisable sur ordinateur et téléphone. Une application mobile pourra être envisagée plus tard, si le projet et ses moyens le permettent.

## Parcours principal

1. La personne ouvre son dressing et ajoute ses vêtements.
2. Pour chaque pièce, elle peut choisir une image enregistrée ou prendre une photo.
3. Elle renseigne le nom, le rôle de la pièce, son type, sa couleur, un ou plusieurs styles vestimentaires et, facultativement, une ou plusieurs occasions adaptées.
4. Elle choisit une occasion, par exemple « Bureau », « Décontracté », « Sortie » ou « Élégant ».
5. La personne peut préciser une occasion, ou laisser Tendance considérer toute sa garde-robe, puis choisit une durée de 3, 5 ou 7 jours.
6. Tendance compose un planning : une robe, ou un haut avec un bas par jour. Veste, chaussures et accessoires peuvent compléter les looks, mais restent facultatifs.
7. La personne peut demander un autre planning et enregistrer individuellement les looks qu'elle préfère.

## Périmètre du prototype

- Garde-robe personnelle avec ajout, consultation, filtrage et suppression des vêtements.
- Filtrage combiné de la garde-robe par rôle/catégorie et par style.
- Rôles de départ : haut, bas, robe/pièce une-pièce, veste, chaussures, accessoire et nuit.
- Types détaillés, avec un champ « Autre (personnalisé) » pour les pièces non listées.
- Quatre styles simples (classique, décontracté, sport/athleisure, streetwear) séparés des occasions (bureau, sortie, cérémonie, etc.).
- Génération de plannings de 3, 5 ou 7 jours avec des règles simples, sans IA.
- Répartition des pièces sur le planning afin de varier les tenues quand la garde-robe le permet.
- Préférence probabiliste pour des associations de couleurs équilibrées ; les choix plus contrastés restent possibles.
- Enregistrement et consultation des tenues préférées.
- Identité visuelle retenue : monogramme vert `#00E676`, noir `#0B0F0E`, gris `#A0A6AD`, blanc `#F7F8FA`, logo en minuscules et typographie sans empattement.

## Hors périmètre pour le moment

- Reconnaissance automatique des vêtements sur les photos.
- Suggestions météo et apprentissage des goûts.
- Comptes, synchronisation entre appareils et stockage en ligne.
- Partage public et application mobile.

## État et limites à garder en tête

Le prototype actuel conserve les vêtements et les looks dans le stockage local du navigateur. Les données ne suivent donc pas la personne sur un autre appareil. La génération utilise les rôles, styles et occasions renseignés manuellement, avec une heuristique simple de couleur ; elle ne garantit pas une pertinence stylistique.

## Règle de composition validée

Chaque tenue quotidienne requiert une robe ou une combinaison haut + bas. Les chaussures, vestes et accessoires sont des compléments optionnels. Une veste seule ne constitue pas une tenue. Le générateur évite de réutiliser une pièce tant qu'une combinaison compatible sans répétition est disponible ; si le dressing contient peu de pièces adaptées, il réutilise d'abord celles qui ont le moins servi.

## Prochaine étape de conception

Faire essayer les règles de composition sur plusieurs garde-robes et recueillir les retours sur les associations proposées.
