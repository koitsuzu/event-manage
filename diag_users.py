from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# 模擬 app.database 的連線
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./event_manager.db")
ADMIN_EMAILS = os.getenv("ADMIN_EMAILS", "")
admin_list = [email.strip() for email in ADMIN_EMAILS.split(",") if email.strip()]

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

print(f"Admin Emails in .env: {admin_list}")

# 執行查詢
from sqlalchemy import text
try:
    cols = db.execute(text("PRAGMA table_info(users)")).fetchall()
    print("Users table columns:", [c[1] for c in cols])
    
    users = db.execute(text("SELECT email, display_name FROM users")).fetchall()
    print(f"\nFound {len(users)} users in database:")
    for email, name in users:
        is_admin = email in admin_list
        print(f"- {email} ({name}) | Admin: {is_admin}")
        
    if len(users) > 0 and all(u[0] in admin_list for u in users):
        print("\nWARNING: All users in database are administrators! List will be empty.")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
