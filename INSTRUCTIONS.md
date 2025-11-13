# Instructions d'utilisation

## 🚀 Démarrage rapide

### Méthode 1 : Ouvrir directement (simple)
1. Double-cliquez sur `index.html`
2. Votre navigateur s'ouvrira avec l'application
3. Sélectionnez votre fichier Excel (.xlsx) et convertissez-le !

### Méthode 2 : Avec serveur local (recommandé pour gros fichiers)
Pour de meilleures performances, utilisez un serveur HTTP :

**Avec Python :**
```bash
python -m http.server 8000
```
Puis ouvrez : http://localhost:8000

**Avec Node.js :**
```bash
npx http-server -p 8000
```

**Avec PHP :**
```bash
php -S localhost:8000
```

## 📝 Utilisation

1. **Sélectionner un fichier** : Cliquez sur le bouton ou glissez-déposez votre fichier Excel (.xlsx, .xls)
2. **Sélectionner la feuille** : Si votre fichier contient plusieurs feuilles, choisissez celle à convertir
3. **Convertir** : Cliquez sur "Convertir en CSV"
4. **Attendre** : La barre de progression vous indiquera l'avancement
5. **Télécharger** : Une fois terminé, téléchargez les fichiers CSV générés

## ⚙️ Configuration

### Modifier la taille des chunks
Dans `app.jsx`, ligne ~200, modifiez :
```javascript
chunkSize: 100000,  // Nombre de lignes par fichier CSV
```

## 🎯 Fonctionnalités

- ✅ Conversion 100% dans le navigateur (aucun serveur)
- ✅ Support des fichiers Excel jusqu'à 1 000 000+ lignes (optimisé)
- ✅ Segmentation automatique (100k lignes par fichier)
- ✅ Support multi-feuilles avec sélection
- ✅ Barre de progression en temps réel
- ✅ Web Workers pour performance optimale
- ✅ Téléchargement multiple des fichiers générés

## ⚠️ Notes importantes

- Les très gros fichiers Excel (>500MB) peuvent prendre du temps à convertir
- Le navigateur peut demander confirmation avant de télécharger plusieurs fichiers
- Fonctionne mieux avec un serveur HTTP local pour les gros fichiers
- Les formules Excel sont converties en valeurs uniquement
- Les formats de cellules (couleurs, styles) ne sont pas conservés dans le CSV

## 📋 Formats supportés

- ✅ .xlsx (Excel 2007+)
- ✅ .xls (Excel 97-2003)
- ✅ .xlsm (Excel avec macros)
