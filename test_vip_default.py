from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models

# Use in-memory SQLite for testing
engine = create_engine("sqlite:///:memory:")
models.Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

u = models.User(email="test_vip@example.com", display_name="Test VIP")
db.add(u)
db.commit()
db.refresh(u)

print(f"User is_vip after commit: {u.is_vip}")

db.close()
