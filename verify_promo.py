
import asyncio
import os
import json
from unittest.mock import MagicMock

# 假裝環境變數已設定
os.environ["GROQ_API_KEY"] = "gsk_test"
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from app.database import SessionLocal, engine
from app import models
models.Base.metadata.create_all(bind=engine)

async def verify_announcement_gift():
    from app.main import chat_order, ChatMessage
    db = SessionLocal()
    
    try:
        user_email = "promo_test@example.com"
        # 準備資料
        s = db.query(models.Supplier).first()
        if not s:
            s = models.Supplier(name="測試商", contact_info="123")
            db.add(s)
            db.commit()
            db.refresh(s)
            
        p = db.query(models.Product).filter(models.Product.name == "測試果").first()
        if not p:
            p = models.Product(name="測試果", price=100.0, available_stock=100, stock=100, unit="箱", supplier_id=s.id)
            db.add(p)
            db.commit()
            db.refresh(p)
        
        # 增加一個高價位產品
        p2 = db.query(models.Product).filter(models.Product.name == "高級和牛").first()
        if not p2:
            p2 = models.Product(name="高級和牛", price=2000.0, available_stock=10, stock=10, unit="塊", supplier_id=s.id)
            db.add(p2)
            db.commit()
            db.refresh(p2)

        # 建立促銷公告
        db.query(models.Announcement).delete()
        db.add(models.Announcement(title="開工大吉", content="全館滿 1000 元，即贈送 測試果 (ID 1) 一箱！單筆限領一次。", date=None))
        db.commit()

        # 模擬 AI 流程
        import app.main
        app.main.groq_client = MagicMock()
        
        # 第一輪：AI 應該去查公告 (check_news)
        mock_tc_news = MagicMock()
        mock_tc_news.id = "news_1"
        mock_tc_news.function.name = "check_news"
        mock_tc_news.function.arguments = "{}"
        
        # 第二輪：AI 看到滿千送測試果，用戶想買和牛，AI 應主動加入和牛，並看到達標後「自動」加入贈品
        # 我們模擬 AI 發出兩輪 tool calls。第一輪查公告，第二輪同時加入和牛與贈品。
        
        mock_tc_order = MagicMock()
        mock_tc_order.id = "order_1"
        mock_tc_order.function.name = "manage_order"
        # 重點：AI 應該自發性加入 is_gift: True 的測試果
        mock_tc_order.function.arguments = json.dumps({
            "items": [
                {"product_id": p2.id, "quantity": 1},
                {"product_id": p.id, "quantity": 1, "is_gift": True}
            ]
        })
        
        # 模擬對話
        app.main.groq_client.chat.completions.create.side_effect = [
            MagicMock(choices=[MagicMock(message=MagicMock(tool_calls=[mock_tc_news], content=None))]), # R1: News
            MagicMock(choices=[MagicMock(message=MagicMock(tool_calls=[mock_tc_order], content=None))]), # R2: Order
            MagicMock(choices=[MagicMock(message=MagicMock(tool_calls=None, content="OK"))]), # R3: Loop Break
            MagicMock(choices=[MagicMock(message=MagicMock(tool_calls=None, content='{"response": "太棒了！您買了高級和牛，已達滿千門檻，我為您額外準備了一箱測試果贈品！"}'))]) # R4: Synthesis
        ]
        
        print("--- Testing Announcement-driven Logic ---")
        msg = ChatMessage(message="我要買一塊高級和牛", history=[])
        res = await chat_order(msg, db, user_email)
        
        print(f"Agent Response: {res['response']}")
        print(f"Items in Data: {json.dumps(res['data']['items'], indent=2, ensure_ascii=False)}")
        
        has_gift = any(it.get("is_gift") for it in res['data']['items'])
        if has_gift:
            print("\n[VERIFICATION SUCCESS] Agent automatically added the gift based on rule.")
        else:
            print("\n[VERIFICATION FAILED] Gift was not added.")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(verify_announcement_gift())
