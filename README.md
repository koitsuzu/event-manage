# 🍃 新鮮農產 (Fresh Produce) - 智慧 AI 特助電商平台

![新鮮農產展示](https://img.shields.io/badge/Status-Brand_New-emerald) ![AI Powered](https://img.shields.io/badge/AI-Groq_Llama_3.3-orange) ![Stack](https://img.shields.io/badge/Stack-FastAPI_%2F_React-blue)

這是一款專為現代農產貿易設計的 **智慧數位轉型平台**。我們完全去除了傳統企業的死板包袱，以「新鮮、在地、科技」為核心，打造最親切的無縫採購體驗。

---

## ✨ 平台亮點 (Platform Features)

### 🤖 你的專屬農產特助「農小助」
- **擬人化對話體驗**：不再是機械化的問答。農小助懂口感、懂產季，能為您推薦今日最鮮甜的選擇。
- **意圖自動化行動**：只需說「幫我各加一份」或「我要點這個」，AI 即刻自動為您更新購物車，省略繁瑣點擊。
- **實時業務感知**：AI 能主動讀取最新公告（如：滿額贈禮規則），並對您的訂單進行即時優化建議。

### 📊 動態贈品與價格引擎
- **自動優惠計算**：系統後端內建公告規則引擎，消費若達標（如：滿1000送草莓），購物車會自動標記贈品並將金額歸零。
- **數據保真 (Data Fidelity)**：AI 回覆百分之百對齊資料庫狀態，確保文字敘述與結帳金額絕對精準，不遺漏任何一份心意。

### 🎨 現代化頂部佈局
- **全寬視野**：採用頂部導覽列 (Top Navbar) 設計，將空間還給產品。產品卡片橫向展開，瀏覽體驗大幅提升。
- **無遮擋交互**：優化了聊天視窗與主畫面的層次空間，即使在對話中，也能清晰觀看產品資訊。

### 📦 管理員高效控制台
- **庫存雙軌制**：區分「預扣可購庫存」與「實體庫存」，精準掌控銷售動能。
- **CSV 批量導入**：支援不同編碼的 CSV 快速匯入產品與損耗紀錄，數位化轉型一鍵完成。

---

## 🛠️ 技術架構 (Technical Stack)

- **前端 (Frontend)**: React, Vite, TailwindCSS, Framer Motion (流暢動畫)
- **後端 (Backend)**: FastAPI (高效 API), SQLAlchemy (資料庫 ORM), Pydantic
- **大腦 (Brain)**: Groq API (Llama 3.3 70B 傳心模型)
- **資料庫 (Database)**: SQLite (預設使用 `farm.db`)

---

## 🚀 快速啟動 (Quick Start)

### 1. 設置環境變數
請在根目錄建立 `.env` 檔案：
```env
# AI 配置
GROQ_API_KEY=your_groq_key_here

# Google 登入配置 (選填，若需完整功能請填寫)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# 系統配置
DATABASE_URL=sqlite:///./farm.db
```

### 2. 啟動後端
```powershell
uv run uvicorn app.main:app --reload --port 5000
```

### 3. 啟動前端
```powershell
cd frontend
npm install
npm run dev
```
訪問 `http://localhost:5173` 即可開始新鮮體驗！

---

## 🎨 品牌視覺 (Visual Identity)
本專案堅持「無公司化 (De-corporatization)」理念，以 **活力橘 (Orange)** 與 **清新綠 (Emerald)** 為主色調，象徵土地的熱情與產品的新鮮度。

---

## 📜 提交規格 (Commit Policy)
所有變更均以繁體中文摘要，保持團隊溝通透明度。
- `feat: 更新頂部導覽佈局解決對話遮擋`
- `fix: 修正贈品 0 元標記與庫存預扣邏輯`
- `style: 品牌全面更名為「新鮮農產」`

---
*Powered by 新鮮農產開發小組*
