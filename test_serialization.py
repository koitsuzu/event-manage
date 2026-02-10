from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models
import json
from datetime import datetime

engine = create_engine("sqlite:///./event_manager.db")
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

user = db.query(models.User).filter(models.User.email == 'tiffany910724@gmail.com').first()

def alchemy_to_dict(obj):
    if obj is None: return None
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}

print("Raw User Object:", user)
print("Serialized Dict:", alchemy_to_dict(user))

# 模擬 FastAPI 可能的行為
try:
    from fastapi.encoders import jsonable_encoder
    print("FastAPI Encoder Result:", jsonable_encoder(user))
except:
    print("FastAPI not available for testing encoder")

db.close()
