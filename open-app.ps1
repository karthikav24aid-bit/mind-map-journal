# Open the Mind Map Journal in the default browser
$htmlFile = Join-Path (Get-Location) "frontend\index.html"
if (Test-Path $htmlFile) {
    Write-Host "Opening Mind Map Journal..." -ForegroundColor Cyan
    Start-Process $htmlFile
} else {
    Write-Error "Could not find frontend\index.html. Run this script from the project root."
}
