
import sys
import os
import json
from unittest.mock import MagicMock

# 假裝環境變數已設定
os.environ["GROQ_API_KEY"] = "gsk_test"
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

# 模擬資料庫與相關模型
from app.database import SessionLocal, engine, settings
from app import models
models.Base.metadata.create_all(bind=engine)

async def test_chat_logic():
    from app.main import chat_order, ChatMessage
    db = SessionLocal()
    
    # 建立測試資料
    if not db.query(models.User).filter(models.User.email == "test@example.com").first():
        user = models.User(email="test@example.com", display_name="Test User", birthday="1990-01-01", is_vip=0)
        db.add(user)
        db.commit()

    # 模擬 msg
    msg = ChatMessage(message="哈囉", history=[])
    
    print("Testing chat_order logic...")
    try:
        import app.main
        app.main.groq_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = '{"response": "你好！我是特助。"}'
        mock_completion.choices[0].message.tool_calls = None
        app.main.groq_client.chat.completions.create.return_value = mock_completion
        
        # 執行 chat_order (await it!)
        res = await app.main.chat_order(msg, db, "test@example.com")
        print("Result:", json.dumps(res, indent=2, ensure_ascii=False))
        
        # 測試 2: 模擬搜尋
        msg_search = ChatMessage(message="我想買水果", history=[])
        # 模擬第一輪回傳工具調用
        mock_tool_call = MagicMock()
        mock_tool_call.id = "call_123"
        mock_tool_call.function.name = "query_inventory"
        mock_tool_call.function.arguments = '{"search_query": "水果"}'
        
        mock_response_tc = MagicMock()
        mock_response_tc.tool_calls = [mock_tool_call]
        mock_response_tc.content = None
        
        # 設定側效果，確保足以支撐遞迴與最後的合成
        app.main.groq_client.chat.completions.create.side_effect = [
            MagicMock(choices=[MagicMock(message=mock_response_tc)]), # Round 1: Tool Call
            MagicMock(choices=[MagicMock(message=MagicMock(tool_calls=None, content="搜尋完成"))]), # Round 2: Done
            mock_completion # Final Synthesis
        ]
        
        res_search = await app.main.chat_order(msg_search, db, "test@example.com")
        print("Search Result:", json.dumps(res_search, indent=2, ensure_ascii=False))

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Test failed with error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_chat_logic())
