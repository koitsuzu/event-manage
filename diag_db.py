from app.database import engine
from sqlalchemy import inspect

def diag():
    inspector = inspect(engine)
    if "users" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("users")]
        print(f"USERS_COLUMNS: {columns}")
    else:
        print("USERS_TABLE_MISSING")

if __name__ == "__main__":
    diag()
