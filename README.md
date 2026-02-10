# 活動報名管理系統 (Event Management System)

這是一個功能強大的多角色活動管理平台，專為活動組織者設計。系統支援訪客瀏覽、會員報名、自動化通知，以及完整的後台管理功能。

## 🌟 核心功能亮點

### 📢 公告與首頁
- **動態佈告欄**：首頁自動展示最新公告與消息。
- **活動導購連結**：公告內可直接關聯特定活動，點擊「查看詳情」自動導向報名頁面。

### 📅 活動管理 (CRUD)
- **自主建立活動**：管理員可新增、編輯、刪除活動。
- **靈活設定**：支援設定活動名稱、日期、金額、簡介，並具備防止誤刪的保護機制。

### 📝 智慧報名系統
- **步進式人數控制**：直覺的 +/- 按鈕調整報名人數，自動試算總金額。
- **需求備註**：支援填寫特殊需求（如素食、攜帶兒童等）。
- **個人資料自動帶入**：報名時自動鎖定並帶入會員資料，確保一致性。
- **狀態追蹤**：使用者可隨時查看「已報名」、「待付款」、「已付款」狀態。
- **防呆機制**：
  - 防止重複報名。
  - 過期活動自動關閉報名。

### 📧 自動化郵件通知系統
系統內建強大的背景郵件引擎，實現全自動化溝通：
1. **報名確認信**：報名成功後立即發送，包含費用明細與繳費截止日（報名日 +3 天）。
2. **自動催繳提醒 (Reminder)**：
   - 系統每日自動檢測即將到期的未付款名單。
   - 管理員可一鍵手動觸發當日催繳。
   - 郵件內含溫馨提示：「若已繳費請忽略」。
3. **新活動自動廣播 (New Event Broadcast)**：
   - 當建立新活動時，系統自動鎖定 **VIP 會員** 發送專屬邀請函，搶佔報名先機。
4. **精準行銷排程 (Marketing Scheduler)**：
   - 支援設定特定日期與時間（時:分）發送推廣郵件。
   - 具備背景自動檢測引擎，時間一到自動發送。
   - 支援對「未發送」的排程進行二次編輯。

### 👑 VIP 會員管理制度
- **新成員預設 VIP**：所有新註冊成員（Google 登入或匯入）預設標記為「好顧客」。
- **人工篩選**：管理員可在後台一鍵取消特定成員的 VIP 資格。
- **專屬權益**：VIP 會員享有新活動優先通知權。

### 📊 管理員後台 (Admin Dashboard)
- **深色專業模式**：進入管理後台介面自動切換為深色主題，區隔一般使用者視角。
- **成員活動分析**：
  - 檢視所有成員的活躍度（已參加次數、待處理次數）。
  - 無限層級展開查看詳細報名歷史。
  - **自動排除管理員**：統計數據自動過濾管理員帳號，確保數據純淨。
- **CSV 資料匯入**：支援批次匯入外部名單。
- **權限自動同步**：修改 `.env` 管理員名單後，網頁重新整理即生效，無需重新登入。

---

## 🛠️ 技術架構

- **Frontend**: React, Vite, TailwindCSS
- **Backend**: FastAPI, Python
- **Database**: SQLite (SQLAlchemy)
- **Auth**: Google OAuth 2.0 + JWT
- **Email**: SMTP (Gmail)
- **Task Queue**: Python `asyncio` BackgroundTasks

---

## 🚀 部署方式

### 方式一：本機開發

1. 複製 `.env.example` 為 `.env`，填入您的 Google OAuth 與郵件設定
2. 啟動系統：
```powershell
.\run.ps1
```
3. 訪問應用：
   - 前端：http://localhost:5173
   - API 文件：http://localhost:8000/docs

### 方式二：Zeabur 雲端部署（單服務模式）

本專案已整合為**單一服務**：後端自動提供前端頁面，只需部署一個服務即可。

1. **建立 PostgreSQL 服務**：在 Zeabur 專案中新增 PostgreSQL 資料庫
2. **連結 GitHub Repo**：選擇 `cloud-deploy` 分支，Zeabur 會自動偵測 Python 專案
3. **綁定 PostgreSQL**：將 PostgreSQL 服務綁定至後端，`DATABASE_URL` 會自動注入
4. **設定環境變數**：

| 變數名稱 | 說明 |
|----------|------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `https://your-app.zeabur.app/auth/callback` |
| `JWT_SECRET` | 自訂密鑰 |
| `FRONTEND_URL` | 您的 Zeabur 部署 URL |
| `MAIL_USERNAME` | Gmail 帳號 |
| `MAIL_PASSWORD` | Gmail 應用程式密碼 |
| `ADMIN_EMAILS` | 管理員信箱（逗號分隔） |

5. **設定 Google OAuth**：前往 [Google Cloud Console](https://console.cloud.google.com/) → API 和服務 → 憑證 → 您的 OAuth Client ID → 在「已授權的重新導向 URI」新增 `https://your-app.zeabur.app/auth/callback`

---

## 🧪 測試指南

1. **訪客模式**：不登入，瀏覽首頁與活動列表。
2. **會員模式**：使用一般 Google 帳號登入，嘗試報名活動並接收確認信。
3. **管理員模式**：使用 `ADMIN_EMAILS` 設定的信箱登入：
   - 測試建立新活動（檢查是否收到 VIP 通知）。
   - 進入「成員統計」查看數據。
   - 設定一行銷郵件排程並等待自動發送。

