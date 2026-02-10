import sqlite3

def migrate():
    conn = sqlite3.connect('event_manager.db')
    cursor = conn.cursor()
    
    try:
        # 檢查欄位是否存在
        cursor.execute("PRAGMA table_info(marketing_mails)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'scheduled_time' not in columns:
            print("Adding 'scheduled_time' column to 'marketing_mails' table...")
            cursor.execute("ALTER TABLE marketing_mails ADD COLUMN scheduled_time TEXT DEFAULT '09:00'")
            conn.commit()
            print("Migration successful.")
        else:
            print("Column 'scheduled_time' already exists.")
            
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
