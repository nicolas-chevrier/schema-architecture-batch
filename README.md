# Schéma d'architecture des batchs

Page statique pour présenter et modifier un schéma d'architecture : une base de données, des batchs Java
Spring Batch et des fichiers sur un serveur. Aucune dépendance, aucun build.

## Utilisation

- **Modifier** : glisser les éléments, relier avec les points qui apparaissent au survol, cliquer pour éditer
  dans le panneau de droite.
- **Présenter** : le bouton *Présenter* masque l'édition. Cliquer sur un batch (ou utiliser `←` `→`) isole son
  flux et affiche son détail.
- **Exporter** : *Fichiers > Exporter en JSON*, ou image PNG et SVG.
- **Importer** : *Fichiers > Importer un JSON*, ou déposer le fichier sur la page.

## Confidentialité

Aucune donnée du schéma ne transite sur internet :

- le schéma est enregistré dans le navigateur (`localStorage`) et dans les fichiers que vous exportez ;
- la page n'appelle aucun service et ne charge rien de l'extérieur ;
- sa politique de sécurité (`Content-Security-Policy`, dans `index.html`) interdit au navigateur toute connexion
  sortante.

Sur GitHub Pages, seul le code de l'application est téléchargé depuis GitHub. Ce dépôt ne doit contenir que
l'exemple générique : ne pas y committer vos exports JSON. Pour ne rien télécharger du tout, ouvrez `index.html`
depuis une copie locale.

Le schéma enregistré dans le navigateur est propre à ce navigateur et à cette adresse. Exportez-le en JSON pour le
conserver ou le transmettre, et pensez que l'effacement des données du site le supprime.

## Publier sur GitHub Pages

1. Pousser ce dossier sur un dépôt GitHub.
2. Dans *Settings > Pages*, choisir *Deploy from a branch*, la branche `main` et le dossier `/ (root)`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `exemple.js` | Exemple affiché à la première ouverture, sans donnée réelle |
| `index.html`, `styles.css`, `app.js` | L'application |
