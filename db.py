import os
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
DB_FILE = 'parkospace.db'

def get_database_connection():
    """
    Establishes and returns a database connection based on configuration.
    Returns: (connection, db_type_string)
    """
    # 1. Check for Supabase / PostgreSQL
    if DATABASE_URL and ("postgres" in DATABASE_URL or "postgresql" in DATABASE_URL):
        try:
            conn = psycopg2.connect(DATABASE_URL, sslmode='require', cursor_factory=RealDictCursor)
            return conn, "supabase"
        except Exception as e:
            print(f" [ERROR] Could not connect to Supabase: {e}")
            return None, None

    # 2. Check for Local SQLite
    elif os.path.exists(DB_FILE):
        try:
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row # Return dict-like objects
            return conn, "sqlite"
        except Exception as e:
            print(f" [ERROR] Could not connect to SQLite: {e}")
            return None, None

    else:
        print(" [NONE] No active database found (File missing or URL not set).")
        return None, None

def get_database_info():
    print("="*60)
    print(" 🔍 DATABASE INFO")
    print("="*60)
    if DATABASE_URL and "postgres" in DATABASE_URL:
        safe_url = DATABASE_URL.split('@')[-1]
        print(f" [TYPE] Remote (Supabase)\n [HOST] {safe_url}")
    elif os.path.exists(DB_FILE):
        print(f" [TYPE] Local (SQLite)\n [PATH] {os.path.abspath(DB_FILE)}")
    else:
        print(" [STATUS] No Database Found")

def fetch_all_data():
    """
    Fetches and prints all data from tables.
    """
    conn, db_type = get_database_connection()
    if not conn: return

    print("\n" + "="*60)
    print(" 📊 DATA DUMP")
    print("="*60)

    try:
        cur = conn.cursor()

        # --- OWNERS ---
        print("\n--- [ OWNERS TABLE ] ---")
        try:
            cur.execute("SELECT * FROM owners")
            rows = cur.fetchall()
            if not rows:
                print(" (Table is empty)")
            else:
                for row in rows:
                    # Convert row to dict for printing
                    print(dict(row))
                print(f" Total: {len(rows)} owners")
        except Exception as e:
            print(f" (Error querying owners: {e})")

        # --- LISTINGS ---
        print("\n--- [ LISTINGS TABLE ] ---")
        try:
            cur.execute("SELECT * FROM listings")
            rows = cur.fetchall()
            if not rows:
                print(" (Table is empty)")
            else:
                for row in rows:
                    # Convert row to dict for printing
                    print(dict(row))
                print(f" Total: {len(rows)} listings")
        except Exception as e:
            print(f" (Error querying listings: {e})")

        conn.close()

    except Exception as e:
        print(f" [FATAL ERROR] {e}")

def clear_database():
    """
    Wipes all data and drops tables.
    """
    print("\n" + "-"*60)
    print(" ⚠  WARNING: DESTRUCTIVE ACTION")
    print(" This will DELETE ALL DATA and DROP ALL TABLES.")
    print("-"*60)

    confirm = input(" Type 'yes' to confirm database wipe: ")
    if confirm.lower() != 'yes':
        print(" Operation cancelled.")
        return

    conn, db_type = get_database_connection()
    if not conn: return

    try:
        cur = conn.cursor()
        if db_type == "supabase":
            cur.execute("DROP TABLE IF EXISTS listings CASCADE;")
            cur.execute("DROP TABLE IF EXISTS owners CASCADE;")
            print(" [SUCCESS] Supabase tables dropped.")
        else:
            # SQLite: Close connection first to release file lock, then delete file
            conn.close()
            try:
                os.remove(DB_FILE)
                print(f" [SUCCESS] Deleted local file: {DB_FILE}")
                return # Exit since connection is closed
            except Exception as e:
                print(f" [ERROR] Could not delete file: {e}")
                return

        conn.commit()
        conn.close()
    except Exception as e:
        print(f" [ERROR] Clear failed: {e}")

    print("\n [NEXT STEP] Run 'python3 main.py' to recreate empty tables.")

if __name__ == "__main__":
    print("\nSelect Action:")
    print(" 1. Show Database Info")
    print(" 2. Fetch/Dump All Data")
    print(" 3. Clear/Reset Database")

    choice = input("\n Enter choice (1-3): ")

    if choice == '1':
        get_database_info()
    elif choice == '2':
        fetch_all_data()
    elif choice == '3':
        clear_database()
    else:
        print(" Invalid choice.")
