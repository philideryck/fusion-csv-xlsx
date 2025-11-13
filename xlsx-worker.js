// Web Worker pour le traitement Excel vers CSV - Optimisé pour 1M+ lignes
// SheetJS (XLSX) doit être chargé dans le worker
importScripts('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');

self.onmessage = function(e) {
    const { type, data, options } = e.data;
    
    if (type === 'PROCESS_XLSX') {
        processExcelFile(data).catch(error => {
            self.postMessage({
                type: 'ERROR',
                error: error.message,
                stack: error.stack
            });
        });
    }
    
    if (type === 'GET_SHEET_NAMES') {
        try {
            const { arrayBuffer } = data;
            // Lecture minimale pour obtenir juste les noms de feuilles
            const workbook = XLSX.read(arrayBuffer, { 
                type: 'array',
                sheetRows: 0, // Ne pas lire les données
                cellFormula: false,
                cellHTML: false
            });
            
            self.postMessage({
                type: 'SHEET_NAMES',
                sheetNames: workbook.SheetNames || []
            });
        } catch (error) {
            self.postMessage({
                type: 'ERROR',
                error: error.message
            });
        }
    }
};

async function processExcelFile(data) {
    const { arrayBuffer, chunkSize, fileName, sheetName } = data;
    
    try {
        // Envoyer un message de démarrage
        self.postMessage({
            type: 'PROGRESS',
            progress: 0,
            processedLines: 0,
            totalLines: 0,
            chunksGenerated: 0,
            message: 'Parsing du fichier Excel...'
        });
        
        // Parser le fichier Excel avec options optimisées pour gros fichiers
        const workbook = XLSX.read(arrayBuffer, { 
            type: 'array',
            cellDates: true,
            cellNF: false,        // Pas de formatage de nombres
            cellText: false,      // Pas de texte formaté
            cellFormula: false,   // Pas de formules
            cellHTML: false,      // Pas de HTML
            cellStyles: false,    // Pas de styles
            sheetStubs: false,    // Pas de stubs
            bookVBA: false,       // Pas de VBA
            bookSheets: false,    // Pas de métadonnées de feuilles
            bookProps: false,     // Pas de propriétés du livre
            bookFiles: false      // Pas de fichiers
        });
        
        // Vérifier que le workbook a des feuilles
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Aucune feuille trouvée dans le fichier Excel');
        }
        
        // Sélectionner la feuille à traiter
        let worksheet;
        let selectedSheetName;
        
        // Si un nom de feuille est fourni, essayer de le trouver
        if (sheetName && sheetName.trim()) {
            // Chercher la feuille par nom exact
            if (workbook.Sheets[sheetName]) {
                worksheet = workbook.Sheets[sheetName];
                selectedSheetName = sheetName;
            } else {
                // Essayer de trouver par correspondance (insensible à la casse)
                const foundSheet = workbook.SheetNames.find(name => 
                    name.toLowerCase() === sheetName.toLowerCase()
                );
                if (foundSheet) {
                    worksheet = workbook.Sheets[foundSheet];
                    selectedSheetName = foundSheet;
                } else {
                    // Si pas trouvé, utiliser la première feuille
                    selectedSheetName = workbook.SheetNames[0];
                    worksheet = workbook.Sheets[selectedSheetName];
                }
            }
        } else {
            // Utiliser la première feuille par défaut
            selectedSheetName = workbook.SheetNames[0];
            worksheet = workbook.Sheets[selectedSheetName];
        }
        
        if (!worksheet) {
            throw new Error(`Feuille "${selectedSheetName}" non trouvée. Feuilles disponibles: ${workbook.SheetNames.join(', ')}`);
        }
        
        // Envoyer un message de progression
        self.postMessage({
            type: 'PROGRESS',
            progress: 5,
            processedLines: 0,
            totalLines: 0,
            chunksGenerated: 0,
            message: `Traitement de la feuille "${selectedSheetName}"...`
        });
        
        // Obtenir la plage de la feuille
        const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
        
        if (!range) {
            throw new Error('La feuille est vide ou invalide');
        }
        
        const totalRows = range.e.r + 1; // +1 car range est 0-indexed
        
        if (totalRows === 0) {
            throw new Error('La feuille est vide');
        }
        
        // Envoyer un message avec le nombre total de lignes
        self.postMessage({
            type: 'PROGRESS',
            progress: 10,
            processedLines: 0,
            totalLines: totalRows - 1,
            chunksGenerated: 0,
            message: `Lecture des en-têtes... ${totalRows - 1} lignes à traiter`
        });
        
        // Lire la première ligne pour les en-têtes
        const headerRow = [];
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            const cell = worksheet[cellAddress];
            const value = cell ? (cell.w || cell.v || '') : '';
            headerRow.push(String(value).trim());
        }
        
        // Filtrer les en-têtes vides
        const headers = headerRow.filter(h => h);
        
        if (headers.length === 0) {
            throw new Error('Aucun en-tête trouvé dans la première ligne');
        }
        
        const totalDataRows = totalRows - 1; // Exclure l'en-tête
        const chunks = [];
        let currentChunk = [];
        let chunkIndex = 0;
        let processedLines = 0;
        
        // Traiter les données ligne par ligne pour économiser la mémoire
        self.postMessage({
            type: 'PROGRESS',
            progress: 15,
            processedLines: 0,
            totalLines: totalDataRows,
            chunksGenerated: 0,
            message: `Traitement des données... 0 / ${totalDataRows.toLocaleString()} lignes`
        });
        
        // Traiter par batch pour permettre au navigateur de respirer
        const BATCH_SIZE = 10000; // Traiter 10k lignes à la fois
        let batchStart = 1; // Commencer après l'en-tête (ligne 0)
        let lastProgressUpdate = 0;
        
        while (batchStart < totalRows) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, totalRows);
            
            // Traiter ce batch
            for (let row = batchStart; row < batchEnd; row++) {
                const record = {};
                let isEmptyRow = true;
                
                // Lire les cellules de cette ligne
                for (let col = range.s.c; col <= range.e.c && col < headers.length + range.s.c; col++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                    const cell = worksheet[cellAddress];
                    const headerIndex = col - range.s.c;
                    
                    if (headerIndex < headers.length) {
                        const header = headers[headerIndex];
                        let value = '';
                        
                        if (cell) {
                            // Utiliser la valeur formatée si disponible, sinon la valeur brute
                            value = cell.w || (cell.v !== undefined && cell.v !== null ? String(cell.v) : '');
                            if (value.trim()) {
                                isEmptyRow = false;
                            }
                        }
                        
                        record[header] = value.trim();
                    }
                }
                
                // Ignorer les lignes complètement vides
                if (!isEmptyRow) {
                    currentChunk.push(record);
                    processedLines++;
                    
                    // Si on atteint la taille du chunk, le générer et le sauvegarder (TRONÇONNAGE)
                    if (currentChunk.length >= chunkSize) {
                        const csvContent = generateCSVOptimized(headers, currentChunk);
                        const baseName = fileName.replace(/\.[^/.]+$/, '');
                        const sheetSuffix = workbook.SheetNames.length > 1 ? `-${selectedSheetName}` : '';
                        
                        chunks.push({
                            index: chunkIndex,
                            filename: `${baseName}${sheetSuffix}-partie-${String(chunkIndex + 1).padStart(3, '0')}.csv`,
                            content: csvContent,
                            recordCount: currentChunk.length,
                            sheetName: selectedSheetName
                        });
                        
                        // Libérer la mémoire du chunk après tronçonnage
                        currentChunk = [];
                        chunkIndex++;
                        
                        // Envoyer la progression avec info de tronçonnage
                        const progress = Math.min(95, 15 + Math.round((processedLines / totalDataRows) * 80));
                        self.postMessage({
                            type: 'PROGRESS',
                            progress: progress,
                            processedLines: processedLines,
                            totalLines: totalDataRows,
                            chunksGenerated: chunks.length,
                            message: `Tronçonnage en cours... ${chunks.length} fichier(s) CSV créé(s) (${processedLines.toLocaleString()}/${totalDataRows.toLocaleString()} lignes)`
                        });
                        
                        // Permettre au navigateur de traiter d'autres tâches
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
            }
            
            batchStart = batchEnd;
            
            // Envoyer une mise à jour de progression périodique (toutes les 5% ou à chaque batch important)
            const currentProgress = 15 + Math.round((processedLines / totalDataRows) * 80);
            if (currentProgress - lastProgressUpdate >= 5 || batchStart >= totalRows) {
                lastProgressUpdate = currentProgress;
                const progress = Math.min(95, currentProgress);
                self.postMessage({
                    type: 'PROGRESS',
                    progress: progress,
                    processedLines: processedLines,
                    totalLines: totalDataRows,
                    chunksGenerated: chunks.length,
                    message: `Traitement en cours... ${processedLines.toLocaleString()} / ${totalDataRows.toLocaleString()} lignes traitées${chunks.length > 0 ? ` (${chunks.length} fichier(s) créé(s))` : ''}`
                });
            }
            
            // Permettre au navigateur de respirer entre les batches
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Sauvegarder le dernier chunk s'il reste des données (dernier tronçon)
        if (currentChunk.length > 0) {
            const csvContent = generateCSVOptimized(headers, currentChunk);
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            const sheetSuffix = workbook.SheetNames.length > 1 ? `-${selectedSheetName}` : '';
            
            chunks.push({
                index: chunkIndex,
                filename: `${baseName}${sheetSuffix}-partie-${String(chunkIndex + 1).padStart(3, '0')}.csv`,
                content: csvContent,
                recordCount: currentChunk.length,
                sheetName: selectedSheetName
            });
        }
        
        // Libérer la mémoire du workbook
        workbook.Sheets = null;
        worksheet = null;
        
        // Envoyer le résultat final
        self.postMessage({
            type: 'COMPLETE',
            chunks: chunks,
            totalLines: processedLines,
            chunkCount: chunks.length,
            headers: headers,
            sheetNames: workbook.SheetNames,
            currentSheet: selectedSheetName
        });
        
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            error: error.message,
            stack: error.stack
        });
    }
}

// Génération CSV optimisée pour la mémoire
function generateCSVOptimized(headers, records) {
    // Utiliser un tableau pour construire le CSV de manière plus efficace
    const lines = [];
    
    // En-têtes
    lines.push(headers.map(escapeCSVValue).join(','));
    
    // Données
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const row = [];
        for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            const value = record[header] || '';
            row.push(escapeCSVValue(value));
        }
        lines.push(row.join(','));
    }
    
    return lines.join('\n') + '\n';
}

// Échapper les valeurs CSV (optimisé)
function escapeCSVValue(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }
    
    const str = String(value);
    
    // Vérification rapide pour éviter les opérations inutiles
    if (str.length === 0) {
        return '';
    }
    
    // Si la valeur contient des caractères spéciaux, l'échapper
    if (str.indexOf(',') >= 0 || str.indexOf('"') >= 0 || str.indexOf('\n') >= 0 || str.indexOf('\r') >= 0) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    
    return str;
}
