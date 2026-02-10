Write-Host "正在啟動後端 FastAPI..." -ForegroundColor Green
# 使用 uv run 確保在正確的虛擬環境執行
Start-Process powershell -ArgumentList "-NoExit", "-Command", "uv run uvicorn app.main:app --reload"

Write-Host "正在檢查並啟動前端 Vite..." -ForegroundColor Cyan
cd frontend
# 確保 node_modules 存在
if (!(Test-Path "node_modules")) {
    npm install
}
npm run dev
