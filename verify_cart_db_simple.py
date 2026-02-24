from app.database import SessionLocal
from app import models
import json

def verify():
    db = SessionLocal()
    user_email = "coshtest@gmail.com"
    try:
        print("--- 測試開始：購物車資料庫持久化 ---")
        # 1. 清空舊資料
        db.query(models.CartItem).filter(models.CartItem.user_email == user_email).delete()
        db.commit()
        
        # 2. 模擬 Agent 下單 (manage_order)
        p1 = db.query(models.Product).first()
        if not p1:
            print("ERROR: 資料庫中沒有產品，無法測試")
            return
            
        print(f"正在測試新增品項: {p1.name}")
        item = models.CartItem(user_email=user_email, product_id=p1.id, quantity=3.0)
        db.add(item)
        db.commit()
        
        # 3. 驗證資料是否存在
        items = db.query(models.CartItem).filter(models.CartItem.user_email == user_email).all()
        if len(items) == 1 and items[0].quantity == 3.0:
            print(f"SUCCESS: 購物車持久化成功！ {items[0].product.name} x {items[0].quantity}")
        else:
            print(f"FAILED: 預期 1 項，實際取得 {len(items)} 項")

        # 4. 模擬 API 回傳格式 (GET /cart)
        # 我們直接看模型關聯是否正常
        print(f"關聯產品名稱: {items[0].product.name}")
        print(f"關聯產品單價: {items[0].product.price}")
        
    finally:
        db.close()

if __name__ == "__main__":
    verify()
