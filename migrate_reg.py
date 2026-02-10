import sqlite3
import os

db_path = "event_manager.db"

def migrate():
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Add participant_count column to registrations
    try:
        cursor.execute("ALTER TABLE registrations ADD COLUMN participant_count INTEGER DEFAULT 1")
        print("Added participant_count to registrations table.")
    except sqlite3.OperationalError:
        print("participant_count column already exists.")

    # Add notes column to registrations
    try:
        cursor.execute("ALTER TABLE registrations ADD COLUMN notes TEXT")
        print("Added notes to registrations table.")
    except sqlite3.OperationalError:
        print("notes column already exists.")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
