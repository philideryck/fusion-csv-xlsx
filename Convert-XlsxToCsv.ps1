param (
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath
)

if (-not (Test-Path $InputPath)) {
    Write-Error "Fichier introuvable : $InputPath"
    exit 1
}

# Si OutputPath non spécifié, on dérive à partir de l'entrée
if (-not $OutputPath) {
    $OutputPath = [System.IO.Path]::ChangeExtension($InputPath, ".csv")
}

# Ouvre Excel
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $workbook = $excel.Workbooks.Open($InputPath)
    $worksheet = $workbook.Worksheets.Item(1)
    $worksheet.SaveAs($OutputPath, 6)  # 6 = xlCSV
    Write-Output "✅ Fichier converti : $OutputPath"
}
catch {
    Write-Error "❌ Erreur : $_"
}
finally {
    $workbook.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($worksheet) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
