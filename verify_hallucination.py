import json
import urllib.request
from app import auth, database, models

# 1. 產生一個有效的測試 Token
db = next(database.get_db())
user_email = "qui0507for@gmail.com"
token = auth.create_access_token(data={"sub": user_email})

def call_chat(message, history=[]):
    print(f"\n>>> [用戶要求]: {message}")
    url = "http://localhost:5000/chat-order"
    data = json.dumps({"message": message, "history": history}).encode('utf-8')
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            ai_resp = res_data["response"]
            print(f"<<< [農小助回覆]: {ai_resp}")
            data_payload = res_data.get("data")
            if data_payload:
                print(f"!!! [偵測到訂單數據]: {json.dumps(data_payload, ensure_ascii=False)}")
            
            history.append({"role": "user", "content": message})
            history.append({"role": "assistant", "content": ai_resp})
            return ai_resp, history
    except Exception as e:
        print(f"!!! Error: {e}")
        return None, history

# --- 測試流程 ---
hist = []
# 步驟 1: 推薦
call_chat("推薦一些好吃的商品吧", hist)

# 步驟 2: 確認並下單 (模擬用戶說「好，加一」)
# 這裡我們預期 AI 會看到之前的推薦（即使包含「抱歉」詞彙），並且調用 manage_order
call_chat("好，幫我把推薦的都加入購物車", hist)

print("\n--- 自動下單意圖鎖定驗證結束 ---")
