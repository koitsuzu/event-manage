import sqlite3
import os

db_path = "event_manager.db"

def migrate():
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Add reminder_date column to events
    try:
        cursor.execute("ALTER TABLE events ADD COLUMN reminder_date TEXT")
        print("Added reminder_date to events table.")
    except sqlite3.OperationalError:
        print("reminder_date column already exists.")

    # Add reminder_deadline column to events
    try:
        cursor.execute("ALTER TABLE events ADD COLUMN reminder_deadline TEXT")
        print("Added reminder_deadline to events table.")
    except sqlite3.OperationalError:
        print("reminder_deadline column already exists.")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
