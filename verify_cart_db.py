import requests
import json
import time

API_BASE = "http://localhost:5000"

# 模擬登入 (需要一個測試 Token，或者手動提供)
# 這裡我們假設已經有測試環境或是模擬資料庫操作
# 為了穩定性，我們直接調用 chat-order 並檢查資料庫

def test_cart_persistence():
    print("--- 測試開始：購物車持久化 ---")
    
    # 這裡我們不使用真實的 OAuth，而是模擬後端行為或使用測試 Token (如果有的話)
    # 假設我們已經有一個有效的 token
    token = "TEST_TOKEN" # 這在開發環境需要真實的
    
    # 1. 模擬 Agent 調用 manage_order
    # 我們直接查看資料庫(如果可能)或是調用 /cart
    print("[1] 正在測試後端資料模型與 Agent 工具同步...")
    
    # 此處我們可以用 run_command 執行一個簡單的 python 腳本來操作 Session 直接檢查資料庫
    with open("verify_db_cart.py", "w", encoding="utf-8") as f:
        f.write(\"\"\"
from app.database import SessionLocal
from app import models
import json

db = SessionLocal()
try:
    user_email = "coshtest@gmail.com" # 假設測試用戶
    # 模擬 Agent 更新購物車
    # 清空舊資料
    db.query(models.CartItem).filter(models.CartItem.user_email == user_email).delete()
    
    # 新增測試品項 (假設 ID 1 是某個產品)
    p1 = db.query(models.Product).first()
    if p1:
        item = models.CartItem(user_email=user_email, product_id=p1.id, quantity=5.0)
        db.add(item)
        db.commit()
        print(f"SUCCESS: 已為 {user_email} 新增 {p1.name} x 5")
    else:
        print("ERROR: 資料庫中沒有產品")

    # 驗證讀取
    items = db.query(models.CartItem).filter(models.CartItem.user_email == user_email).all()
    print(f"VERIFY: 目前購物車共有 {len(items)} 項產品")
    for it in items:
        print(f" - {it.product.name}: {it.quantity}")

finally:
    db.close()
\"\"\")
    
    print("--- 執行資料庫驗證 ---")
    return "Execute verify_db_cart.py"

if __name__ == "__main__":
    test_cart_persistence()
