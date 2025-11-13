const { useState, useRef, useCallback, useEffect } = React;

function App() {
    const [file, setFile] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState({ type: null, message: '' });
    const [result, setResult] = useState(null);
    const [chunks, setChunks] = useState([]);
    const [processedLines, setProcessedLines] = useState(0);
    const [totalLines, setTotalLines] = useState(0);
    const [sheetNames, setSheetNames] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState(null);
    const [chunkSize, setChunkSize] = useState(100000); // Taille par défaut : 100k lignes
    
    const fileInputRef = useRef(null);
    const uploadSectionRef = useRef(null);
    const workerRef = useRef(null);

    // Initialiser le Web Worker
    useEffect(() => {
        workerRef.current = new Worker('xlsx-worker.js');
        
        workerRef.current.onmessage = (e) => {
            const data = e.data;
            const { type } = data;
            
            if (type === 'SHEET_NAMES') {
                const sheets = data.sheetNames || [];
                setSheetNames(sheets);
                if (sheets.length > 0 && !selectedSheet) {
                    setSelectedSheet(sheets[0]);
                }
            } else if (type === 'PROGRESS') {
                const prog = data.progress || 0;
                const procLines = data.processedLines || 0;
                const totLines = data.totalLines || 0;
                const chunkCount = data.chunksGenerated || 0;
                
                setProgress(prog);
                setProcessedLines(procLines);
                setTotalLines(totLines);
                
                const message = data.message || `Traitement en cours... ${procLines.toLocaleString()} / ${totLines.toLocaleString()} lignes traitées${chunkCount > 0 ? ` (${chunkCount} fichier(s) généré(s))` : ''}`;
                setStatus({
                    type: 'info',
                    message: message
                });
            } else if (type === 'COMPLETE') {
                const tot = data.totalLines || 0;
                const chunkCount = data.chunkCount || 0;
                const newChunks = data.chunks || [];
                
                setProgress(100);
                setChunks(newChunks);
                setResult({
                    totalLines: tot,
                    chunkCount: chunkCount,
                    headers: data.headers || [],
                    sheetName: data.currentSheet
                });
                setStatus({
                    type: 'success',
                    message: `✅ Conversion terminée ! ${tot.toLocaleString()} lignes traitées et tronçonnées en ${chunkCount} fichier(s) CSV.`
                });
                setProcessing(false);
            } else if (type === 'ERROR') {
                const error = data.error || 'Erreur inconnue';
                setStatus({
                    type: 'error',
                    message: `Erreur: ${error}`
                });
                setProcessing(false);
            }
        };
        
        workerRef.current.onerror = (error) => {
            setStatus({
                type: 'error',
                message: `Erreur du Worker: ${error.message}`
            });
            setProcessing(false);
        };
        
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, []);

    const isExcelFile = (fileName) => {
        return fileName.endsWith('.xlsx') || 
               fileName.endsWith('.xls') || 
               fileName.endsWith('.xlsm');
    };

    const handleFileSelect = useCallback(async (selectedFile) => {
        if (selectedFile) {
            // Vérifier le type de fichier
            const isValidType = isExcelFile(selectedFile.name) ||
                               selectedFile.name.endsWith('.csv') || 
                               selectedFile.name.endsWith('.txt') ||
                               selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                               selectedFile.type === 'application/vnd.ms-excel';
            
            if (!isValidType) {
                setStatus({
                    type: 'error',
                    message: 'Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV valide.'
                });
                return;
            }

            setFile(selectedFile);
            setStatus({
                type: 'info',
                message: `Fichier sélectionné: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`
            });
            setResult(null);
            setChunks([]);
            setProgress(0);
            setSheetNames([]);
            setSelectedSheet(null);

            // Si c'est un fichier Excel, détecter les feuilles
            if (isExcelFile(selectedFile.name)) {
                try {
                    setStatus({
                        type: 'info',
                        message: 'Analyse du fichier Excel...'
                    });
                    
                    const arrayBuffer = await readFileAsArrayBuffer(selectedFile);
                    
                    if (workerRef.current) {
                        workerRef.current.postMessage({
                            type: 'GET_SHEET_NAMES',
                            data: { arrayBuffer }
                        });
                    }
                } catch (error) {
                    setStatus({
                        type: 'error',
                        message: `Erreur lors de la lecture du fichier: ${error.message}`
                    });
                }
            }
        }
    }, []);

    const readFileAsArrayBuffer = useCallback((file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Erreur lors de la lecture du fichier'));
            reader.readAsArrayBuffer(file);
        });
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadSectionRef.current) {
            uploadSectionRef.current.classList.add('dragover');
        }
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadSectionRef.current) {
            uploadSectionRef.current.classList.remove('dragover');
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (uploadSectionRef.current) {
            uploadSectionRef.current.classList.remove('dragover');
        }
        
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    }, [handleFileSelect]);

    const handleProcess = useCallback(async () => {
        if (!file) {
            setStatus({
                type: 'error',
                message: 'Veuillez sélectionner un fichier d\'abord.'
            });
            return;
        }

        // Pour les fichiers Excel, s'assurer qu'une feuille est sélectionnée
        if (isExcelFile(file.name)) {
            // Si aucune feuille n'est sélectionnée mais qu'on a des noms de feuilles, utiliser la première
            if (!selectedSheet && sheetNames.length > 0) {
                setSelectedSheet(sheetNames[0]);
            }
            // Si toujours pas de feuille, attendre un peu pour laisser le temps de charger
            if (!selectedSheet) {
                setStatus({
                    type: 'error',
                    message: 'Veuillez attendre que les feuilles soient chargées, puis sélectionnez une feuille.'
                });
                return;
            }
        }

        setProcessing(true);
        setProgress(0);
        setStatus({
            type: 'info',
            message: 'Lecture du fichier en cours...'
        });
        setChunks([]);
        setProcessedLines(0);
        setTotalLines(0);

        try {
            if (isExcelFile(file.name)) {
                // Traitement d'un fichier Excel
                setStatus({
                    type: 'info',
                    message: 'Lecture du fichier Excel... Cela peut prendre quelques instants pour les gros fichiers.'
                });
                
                const arrayBuffer = await readFileAsArrayBuffer(file);
                
                setStatus({
                    type: 'info',
                    message: 'Conversion Excel vers CSV avec Web Worker...'
                });
                
                // Envoyer au Worker pour traitement
                if (workerRef.current) {
                    workerRef.current.postMessage({
                        type: 'PROCESS_XLSX',
                        data: {
                            arrayBuffer: arrayBuffer,
                            chunkSize: chunkSize, // Taille configurable pour le tronçonnage
                            fileName: file.name,
                            sheetName: selectedSheet
                        }
                    });
                } else {
                    throw new Error('Web Worker non initialisé');
                }
            } else {
                setStatus({
                    type: 'error',
                    message: 'Seuls les fichiers Excel (.xlsx, .xls) sont supportés pour la conversion.'
                });
                setProcessing(false);
            }
            
        } catch (error) {
            setProcessing(false);
            setStatus({
                type: 'error',
                message: `Erreur: ${error.message}`
            });
        }
    }, [file, selectedSheet, readFileAsArrayBuffer]);

    const handleDownload = useCallback((chunk) => {
        const blob = new Blob([chunk.content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = chunk.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    const handleDownloadAll = useCallback(() => {
        if (!chunks.length) return;
        
        chunks.forEach((chunk, index) => {
            setTimeout(() => {
                handleDownload(chunk);
            }, index * 300); // Délai pour éviter de bloquer le navigateur
        });
    }, [chunks, handleDownload]);

    const handleCancel = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            // Recréer le worker
            workerRef.current = new Worker('xlsx-worker.js');
            workerRef.current.onmessage = (e) => {
                const { type, progress: prog, processedLines: procLines, totalLines: totLines, chunks: newChunks, chunkCount, totalLines: tot, error, headers, sheetNames: sheets } = e.data;
                
                if (type === 'SHEET_NAMES') {
                    setSheetNames(sheets);
                    if (sheets.length > 0) {
                        setSelectedSheet(sheets[0]);
                    }
                } else if (type === 'PROGRESS') {
                    setProgress(prog);
                    setProcessedLines(procLines);
                    setTotalLines(totLines);
                } else if (type === 'COMPLETE') {
                    setProgress(100);
                    setChunks(newChunks);
                    setResult({
                        totalLines: tot,
                        chunkCount: chunkCount,
                        headers: headers
                    });
                    setProcessing(false);
                } else if (type === 'ERROR') {
                    setStatus({
                        type: 'error',
                        message: `Erreur: ${error}`
                    });
                    setProcessing(false);
                }
            };
        }
        setProcessing(false);
        setProgress(0);
        setStatus({
            type: 'info',
            message: 'Traitement annulé.'
        });
    }, []);

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="container">
            <h1>🚀 Convertisseur Excel vers CSV</h1>
            <p className="subtitle">Conversion de fichiers Excel (.xlsx) en CSV - Optimisé pour 1M+ lignes (100% Client-Side)</p>

            <div
                ref={uploadSectionRef}
                className="upload-section"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.xlsm"
                    onChange={(e) => handleFileSelect(e.target.files[0])}
                    disabled={processing}
                />
                <button
                    className="upload-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processing}
                >
                    📁 Sélectionner un fichier Excel
                </button>
                <p style={{ marginTop: '15px', color: '#666' }}>
                    ou glissez-déposez votre fichier .xlsx ici
                </p>
                {file && (
                    <div className="file-info">
                        <strong>Fichier:</strong> {file.name}<br />
                        <strong>Taille:</strong> {formatFileSize(file.size)}
                    </div>
                )}
            </div>

            {file && !processing && (
                <div style={{ marginTop: '20px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
                    {sheetNames.length > 1 && (
                        <>
                            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#333' }}>
                                Sélectionner la feuille à convertir:
                            </label>
                            <select
                                value={selectedSheet || ''}
                                onChange={(e) => setSelectedSheet(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    fontSize: '1em',
                                    borderRadius: '6px',
                                    border: '2px solid #667eea',
                                    background: 'white',
                                    marginBottom: '20px'
                                }}
                            >
                                {sheetNames.map((sheet, index) => (
                                    <option key={index} value={sheet}>
                                        {sheet} {index === 0 && '(par défaut)'}
                                    </option>
                                ))}
                            </select>
                            <p style={{ marginBottom: '20px', color: '#666', fontSize: '0.9em' }}>
                                {sheetNames.length} feuille(s) trouvée(s) dans le fichier
                            </p>
                        </>
                    )}
                    
                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', color: '#333' }}>
                        📊 Taille des fichiers CSV (tronçonnage):
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                            value={chunkSize}
                            onChange={(e) => setChunkSize(Number(e.target.value))}
                            style={{
                                padding: '10px',
                                fontSize: '1em',
                                borderRadius: '6px',
                                border: '2px solid #667eea',
                                background: 'white',
                                minWidth: '200px'
                            }}
                        >
                            <option value={50000}>50 000 lignes par fichier</option>
                            <option value={100000}>100 000 lignes par fichier (recommandé)</option>
                            <option value={200000}>200 000 lignes par fichier</option>
                            <option value={500000}>500 000 lignes par fichier</option>
                        </select>
                        <span style={{ color: '#666', fontSize: '0.9em' }}>
                            Le fichier sera automatiquement tronçonné en plusieurs fichiers CSV
                        </span>
                    </div>
                    <p style={{ marginTop: '10px', color: '#667eea', fontSize: '0.85em', fontStyle: 'italic' }}>
                        💡 Pour un fichier de 1M lignes avec 100k lignes/chunk : ~10 fichiers CSV seront générés
                    </p>
                </div>
            )}

            {file && !processing && !result && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                        className="upload-button"
                        onClick={handleProcess}
                        disabled={isExcelFile(file.name) && !selectedSheet}
                    >
                        ⚡ Convertir en CSV
                    </button>
                </div>
            )}

            {processing && (
                <div className="progress-section active">
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${progress}%` }}>
                            {progress}%
                        </div>
                    </div>
                    <div className="progress-text">
                        {status.message || 'Traitement en cours... Veuillez patienter.'}
                    </div>
                    {totalLines > 0 && (
                        <div className="progress-text" style={{ marginTop: '5px' }}>
                            {processedLines.toLocaleString()} / {totalLines.toLocaleString()} lignes
                        </div>
                    )}
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button
                            className="upload-button"
                            onClick={handleCancel}
                            style={{ background: '#dc3545' }}
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {status.type && !processing && (
                <div className={`status-message ${status.type}`}>
                    {status.message}
                </div>
            )}

            {result && (
                <>
                    <div className="stats">
                        <div className="stat-item">
                            <div className="stat-value">{result.totalLines.toLocaleString()}</div>
                            <div className="stat-label">Lignes converties</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{result.chunkCount}</div>
                            <div className="stat-label">Fichiers CSV générés</div>
                        </div>
                        {result.sheetName && (
                            <div className="stat-item">
                                <div className="stat-value" style={{ fontSize: '1.2em' }}>📄</div>
                                <div className="stat-label">Feuille: {result.sheetName}</div>
                            </div>
                        )}
                    </div>

                    <div className={`chunks-section ${chunks.length > 0 ? 'active' : ''}`}>
                        <h2 style={{ marginBottom: '20px', color: '#333' }}>
                            📦 Fichiers CSV générés (tronçonnage)
                        </h2>
                        <p style={{ marginBottom: '20px', color: '#666', fontSize: '0.95em' }}>
                            Le fichier Excel a été automatiquement tronçonné en <strong>{chunks.length}</strong> fichier(s) CSV pour faciliter le traitement.
                        </p>
                        <div className="chunks-list">
                            {chunks.map((chunk, index) => (
                                <div key={index} className="chunk-card">
                                    <h3>{chunk.filename}</h3>
                                    <p><strong>Enregistrements:</strong> {chunk.recordCount.toLocaleString()}</p>
                                    <p><strong>Taille:</strong> {formatFileSize(new Blob([chunk.content]).size)}</p>
                                    {chunk.sheetName && (
                                        <p><strong>Feuille:</strong> {chunk.sheetName}</p>
                                    )}
                                    <button
                                        className="download-button"
                                        onClick={() => handleDownload(chunk)}
                                    >
                                        ⬇️ Télécharger
                                    </button>
                                </div>
                            ))}
                        </div>
                        {chunks.length > 0 && (
                            <div style={{ textAlign: 'center' }}>
                                <button
                                    className="download-all-button"
                                    onClick={handleDownloadAll}
                                >
                                    ⬇️ Télécharger tous les fichiers
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
