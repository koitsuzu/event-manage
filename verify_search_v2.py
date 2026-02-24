
from app.database import SessionLocal
from app import models
import json

def verify_search_logic():
    db = SessionLocal()
    try:
        # 測試 1: 驗證 Snapshot 中的類別辨識邏輯
        products = db.query(models.Product).all()
        print("--- Snapshot Category Verification ---")
        for p in products:
            cat = "蔬菜" if any(k in p.name for k in ["菜", "瓜", "豆"]) else "水果" if any(k in p.name or (p.description and k in p.description) for k in ["果", "莓", "桃"]) else "其他"
            print(f"Product: {p.name} -> Detected Category: {cat}")

        # 測試 2: 驗證多詞搜尋邏輯
        from sqlalchemy import or_, and_
        kw_str = "草莓 日本"
        keywords = kw_str.split()
        filters = []
        for kw in keywords:
            filters.append(or_(
                models.Product.name.contains(kw),
                models.Product.description.contains(kw),
                models.Supplier.name.contains(kw)
            ))
        results = db.query(models.Product).join(models.Supplier).filter(and_(*filters)).all()
        print(f"\n--- Search Verification (Query: '{kw_str}') ---")
        for r in results:
            print(f"Found: {r.name} (Supplier: {r.supplier.name})")

    finally:
        db.close()

if __name__ == "__main__":
    verify_search_logic()
