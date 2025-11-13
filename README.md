# Convertisseur Excel vers CSV - Client-Side

Application web **100% côté client** pour convertir des fichiers Excel (.xlsx) en CSV avec segmentation automatique pour les très gros fichiers (optimisé pour 1 000 000+ lignes).

## 🚀 Fonctionnalités

- ✅ **100% Client-Side** : Aucun serveur nécessaire, fonctionne directement dans le navigateur
- ✅ **Conversion Excel → CSV** : Support des fichiers .xlsx, .xls, .xlsm
- ✅ **Traitement en streaming** : Lecture du fichier par chunks pour éviter de saturer la mémoire
- ✅ **Segmentation automatique** : Découpage en chunks de 100 000 lignes
- ✅ **Barre de progression** : Suivi en temps réel du traitement
- ✅ **Web Workers** : Traitement asynchrone dans un thread séparé (non-bloquant)
- ✅ **Multi-feuilles** : Sélection de la feuille à convertir si plusieurs feuilles
- ✅ **CDN pour bibliothèques** : React, Babel et SheetJS via CDN (portable, pas de build)
- ✅ **Gestion d'erreurs** : Gestion robuste des erreurs de format et d'encodage
- ✅ **Préservation des en-têtes** : Chaque fichier CSV généré contient les en-têtes
- ✅ **Téléchargement multiple** : Téléchargement individuel ou en masse
- ✅ **Drag & Drop** : Interface intuitive pour l'upload

## 📋 Prérequis

- **Aucun !** Juste un navigateur web moderne (Chrome, Firefox, Edge, Safari)
- Pas besoin de Node.js, npm, ou serveur
- Fonctionne en ouvrant simplement le fichier HTML

## 🎯 Utilisation

### Option 1 : Ouvrir directement dans le navigateur
1. Ouvrez `index.html` dans votre navigateur
2. Sélectionnez ou glissez-déposez votre fichier Excel (.xlsx)
3. Si plusieurs feuilles, sélectionnez celle à convertir
4. Cliquez sur "Convertir en CSV"
5. Téléchargez les fichiers CSV générés

### Option 2 : Utiliser un serveur local (recommandé pour gros fichiers)
Pour de meilleures performances avec de très gros fichiers, utilisez un serveur HTTP simple :

```bash
# Avec Python 3
python -m http.server 8000

# Avec Node.js (si installé)
npx http-server -p 8000

# Avec PHP
php -S localhost:8000
```

Puis ouvrez : `http://localhost:8000`

## 🏗️ Architecture

### Frontend (React via CDN)
- **React 18** : Via CDN (unpkg.com) - pas de build nécessaire
- **Babel Standalone** : Pour le support JSX directement dans le navigateur
- **SheetJS (XLSX)** : Bibliothèque pour parser les fichiers Excel
- **FileReader API** : Lecture du fichier en ArrayBuffer
- **Web Workers** : Traitement Excel→CSV dans un thread séparé
- **Blob API** : Génération et téléchargement des fichiers CSV

### Web Worker (`xlsx-worker.js`)
- **Parsing Excel** : Utilise SheetJS pour lire les fichiers .xlsx
- **Conversion CSV** : Conversion des données Excel en format CSV
- **Segmentation** : Découpage automatique en chunks de 100k lignes
- **Génération CSV** : Création de fichiers CSV valides avec en-têtes
- **Progression** : Envoi de mises à jour de progression au thread principal

## 📁 Structure du projet

```
Projet_01/
├── index.html          # Page HTML principale
├── app.jsx             # Application React
├── styles.css          # Styles CSS
├── xlsx-worker.js      # Web Worker pour conversion Excel→CSV
├── README.md           # Documentation
└── INSTRUCTIONS.md     # Guide de démarrage rapide
```

## 🔧 Configuration

### Taille des chunks CSV
Par défaut, les fichiers sont segmentés tous les 100 000 enregistrements. Pour modifier cette valeur, éditez `app.jsx` :

```javascript
workerRef.current.postMessage({
    type: 'PROCESS_XLSX',
    data: {
        arrayBuffer: arrayBuffer,
        chunkSize: 100000,  // Modifier cette valeur
        fileName: file.name,
        sheetName: selectedSheet
    }
});
```

## 🐛 Gestion des erreurs

L'application gère automatiquement :
- Formats de fichier invalides
- Fichiers Excel corrompus
- Feuilles vides
- Problèmes d'encodage
- Erreurs de traitement dans le Web Worker
- Annulation du traitement

## 📝 Notes techniques

### Performance
- **Traitement par batches** : Les données sont traitées par lots de 10 000 lignes pour éviter de saturer la mémoire
- **Libération mémoire** : Chaque chunk est libéré après génération pour économiser la RAM
- **Web Workers** : Le traitement se fait dans un thread séparé, l'interface reste réactive
- **Segmentation** : Chaque chunk est un fichier CSV valide avec ses propres en-têtes
- **Optimisé pour 1M+ lignes** : Peut traiter des fichiers de 1 million+ lignes grâce au traitement incrémental
- **Options SheetJS optimisées** : Désactivation des fonctionnalités non nécessaires (styles, formules, etc.) pour réduire l'utilisation mémoire

### Limitations du navigateur
- La taille maximale dépend de la RAM disponible
- Les très gros fichiers (>500MB) peuvent prendre du temps à traiter
- Le navigateur peut demander confirmation avant de télécharger plusieurs fichiers
- Les fichiers Excel avec des formules complexes peuvent être convertis en valeurs uniquement

### Compatibilité
- ✅ Chrome/Edge (Chromium) : Support complet
- ✅ Firefox : Support complet
- ✅ Safari : Support complet
- ⚠️ Internet Explorer : Non supporté (pas de Web Workers)

### Formats supportés
- ✅ .xlsx (Excel 2007+)
- ✅ .xls (Excel 97-2003) - via SheetJS
- ✅ .xlsm (Excel avec macros)

## 🔒 Sécurité et confidentialité

- **100% Local** : Tous les fichiers sont traités dans votre navigateur
- **Aucun upload** : Aucune donnée n'est envoyée à un serveur
- **Confidentialité totale** : Vos données restent sur votre machine
- **Pas de cookies** : Aucun tracking ou stockage de données

## 🚀 Avantages de l'approche Client-Side

1. **Portabilité** : Fonctionne partout, même hors ligne
2. **Confidentialité** : Aucune donnée n'est envoyée à un serveur
3. **Simplicité** : Pas besoin de serveur ou de configuration
4. **Performance** : Traitement direct dans le navigateur
5. **Gratuit** : Pas de coûts d'hébergement
6. **Sécurité** : Vos données Excel ne quittent jamais votre ordinateur

## 📄 Licence

MIT

## 🙏 Remerciements

- **SheetJS** : Bibliothèque utilisée pour parser les fichiers Excel
- **React** : Framework UI
- **Babel** : Compilateur JSX
