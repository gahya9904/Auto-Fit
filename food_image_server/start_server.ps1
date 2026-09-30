$logFile = "D:\healthcare_ai_server\Auto-Fit\food_image_server\server_start.log"

"[$(Get-Date)] Starting Auto-Fit Food Image Server" | Out-File -FilePath $logFile -Append

Set-Location "D:\healthcare_ai_server\Auto-Fit\food_image_server"

& "D:\healthcare_ai_server\Auto-Fit\food_image_server\.venv\Scripts\python.exe" `
    -m uvicorn app.main:app `
    --host 0.0.0.0 `
    --port 8002 `
    2>&1 | Out-File -FilePath $logFile -Append