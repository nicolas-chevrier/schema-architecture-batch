// Exemple générique affiché à la première ouverture. Il ne contient aucune donnée réelle.
// Votre schéma reste dans votre navigateur et dans les fichiers JSON que vous exportez.
window.SCHEMA_EXEMPLE = {
  "version": 1,
  "title": "Architecture des traitements batch",
  "nodes": [
    { "id": "zone-serveur", "type": "zone", "x": 40, "y": 220, "w": 300, "h": 280, "name": "Serveur de fichiers", "description": "Serveur qui héberge les fichiers lus et produits par les batchs." },
    { "id": "zone-batchs", "type": "zone", "x": 430, "y": 60, "w": 320, "h": 600, "name": "Traitements Spring Batch", "description": "Jobs Java Spring Batch." },
    { "id": "fichier-init", "type": "file", "x": 70, "y": 120, "w": 240, "h": 84, "name": "Données d'initialisation", "subtitle": "Reprise initiale", "description": "Données chargées une seule fois." },
    { "id": "fichier-entrant", "type": "file", "x": 70, "y": 260, "w": 240, "h": 84, "name": "Fichier entrant", "subtitle": "Reçu chaque jour", "description": "Fichier lu par le batch d'import journalier." },
    { "id": "fichier-sortant", "type": "file", "x": 70, "y": 400, "w": 240, "h": 84, "name": "Fichier d'export", "subtitle": "Généré chaque jour", "description": "Fichier créé sur le serveur à partir du contenu de la base." },
    { "id": "app-externe", "type": "app", "x": 70, "y": 530, "w": 240, "h": 104, "name": "Application externe", "subtitle": "Consultation des statistiques", "description": "Affiche les statistiques produites par le batch." },
    { "id": "batch-init", "type": "batch", "x": 460, "y": 110, "w": 260, "h": 104, "name": "Batch d'initialisation", "subtitle": "Charge les données de départ", "schedule": "Une seule fois", "description": "Importe les données initiales dans la base avant la mise en service des batchs journaliers.", "reader": "Lecture des données d'initialisation", "processor": "Contrôle et mise au format", "writer": "Insertion dans la base" },
    { "id": "batch-import", "type": "batch", "x": 460, "y": 250, "w": 260, "h": 104, "name": "Import journalier", "subtitle": "Alimente la base", "schedule": "Quotidien", "description": "Lit le fichier du jour, traite ses données et remplit la base.", "reader": "Lecture du fichier entrant", "processor": "Contrôle et transformation des lignes", "writer": "Écriture dans la base" },
    { "id": "batch-export", "type": "batch", "x": 460, "y": 390, "w": 260, "h": 104, "name": "Export journalier", "subtitle": "Produit un fichier", "schedule": "Quotidien", "description": "Lit la base et crée un fichier sur le serveur.", "reader": "Lecture de la base", "processor": "Mise au format du fichier", "writer": "Écriture du fichier" },
    { "id": "batch-stats", "type": "batch", "x": 460, "y": 530, "w": 260, "h": 104, "name": "Statistiques journalières", "subtitle": "Lecture seule de la base", "schedule": "Quotidien", "description": "Lit seulement la base pour créer des statistiques, visibles depuis l'application externe.", "reader": "Lecture de la base", "processor": "Calcul des indicateurs", "writer": "Mise à disposition de l'application externe" },
    { "id": "bdd", "type": "database", "x": 860, "y": 110, "w": 220, "h": 524, "name": "Base de données", "subtitle": "Données métier", "description": "Base lue et alimentée par les batchs." }
  ],
  "edges": [
    { "id": "e1", "from": "fichier-init", "to": "batch-init", "kind": "read", "label": "Lit" },
    { "id": "e2", "from": "batch-init", "to": "bdd", "kind": "write", "label": "Importe" },
    { "id": "e3", "from": "fichier-entrant", "to": "batch-import", "kind": "read", "label": "Lit" },
    { "id": "e4", "from": "batch-import", "to": "bdd", "kind": "write", "label": "Remplit" },
    { "id": "e5", "from": "bdd", "to": "batch-export", "kind": "read", "label": "Lit" },
    { "id": "e6", "from": "batch-export", "to": "fichier-sortant", "kind": "write", "label": "Crée" },
    { "id": "e7", "from": "bdd", "to": "batch-stats", "kind": "read", "label": "Lit" },
    { "id": "e8", "from": "batch-stats", "to": "app-externe", "kind": "publish", "label": "Publie" }
  ]
};
