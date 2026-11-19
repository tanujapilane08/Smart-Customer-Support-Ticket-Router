import csv
import time
import uuid
from datetime import datetime
import ollama
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from sqlalchemy import create_engine, text

# --- CONFIG (Matches your main.py) ---
CSV_FILE_PATH = r"C:\Users\tanuj\Downloads\all_tickets_processed_improved_v3.csv"
MYSQL_URL = "mysql+pymysql://root:password@localhost:3307/support_db"
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "company_documents"
EMBEDDING_MODEL = "nomic-embed-text"

START_ROW = 26500    # Resumes right where it stopped
MAX_ROWS = None      # Loads the rest of the 47,837 rows
BATCH_SIZE = 50

engine = create_engine(MYSQL_URL)
q_client = QdrantClient(url=QDRANT_URL, timeout=60)  # 60s timeout prevents crash

doc_id = str(uuid.uuid4())
filename = CSV_FILE_PATH.split("\\")[-1].split("/")[-1]

# 1. Read remaining CSV rows
chunks = []
with open(CSV_FILE_PATH, mode="r", encoding="utf-8", errors="ignore") as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader):
        if i < START_ROW:
            continue
        if MAX_ROWS and i >= MAX_ROWS:
            break
        row_text = " | ".join(f"{k}: {v}" for k, v in row.items() if v)
        if row_text:
            chunks.append(row_text)

print(f"Resuming from row {START_ROW}. Remaining rows: {len(chunks)}")

# 2. Batch embed and push to Qdrant (with auto-retry)
for i in range(0, len(chunks), BATCH_SIZE):
    batch = chunks[i : i + BATCH_SIZE]
    vectors = ollama.embed(model=EMBEDDING_MODEL, input=batch)["embeddings"]

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vec,
            payload={"doc_id": doc_id, "filename": filename, "text": chunk},
        )
        for chunk, vec in zip(batch, vectors)
    ]

    for attempt in range(3):
        try:
            q_client.upsert(collection_name=COLLECTION_NAME, points=points)
            break
        except Exception:
            print(f"Timeout on batch, retrying ({attempt + 1}/3)...")
            time.sleep(3)

    print(f"Indexed {START_ROW + min(i + BATCH_SIZE, len(chunks))}/{START_ROW + len(chunks)} rows...")

# 3. Register in MySQL so it shows up in your React UI
with engine.connect() as conn:
    conn.execute(
        text("INSERT INTO documents (id, filename, upload_date) VALUES (:id, :fn, :dt)"),
        {"id": doc_id, "fn": filename, "dt": datetime.utcnow()},
    )
    conn.commit()

print(f"Done! Refresh your Upload page to see '{filename}'.")