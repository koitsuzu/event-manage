import sqlite3
import os

# 資料庫路徑
db_path = 'event_manager.db'

def migrate():
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # 1. 幫 users 表新增 is_vip 欄位
        cursor.execute("ALTER TABLE users ADD COLUMN is_vip INTEGER DEFAULT 0")
        print("Column 'is_vip' added to 'users' table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column 'is_vip' already exists.")
        else:
            print(f"Error adding 'is_vip': {e}")

    try:
        # 2. 新增 marketing_mails 表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS marketing_mails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT,
                content TEXT,
                scheduled_date TEXT,
                is_sent INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Table 'marketing_mails' created.")
    except Exception as e:
        print(f"Error creating 'marketing_mails': {e}")

    conn.commit()
    conn.close()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
