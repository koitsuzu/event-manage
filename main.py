import uvicorn
import sys
import traceback

print("=== Event Manager Starting ===", flush=True)
print(f"Python version: {sys.version}", flush=True)

try:
    from app.main import app
    print("=== App imported successfully ===", flush=True)
except Exception as e:
    print(f"=== FATAL: Failed to import app ===", flush=True)
    traceback.print_exc()
    sys.exit(1)

if __name__ == "__main__":
    print("=== Starting uvicorn on port 8080 ===", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=8080)
