from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from langchain_text_splitters import RecursiveCharacterTextSplitter
import pypdf
import ollama
import uuid
import datetime

# --- CONFIGURATION ---
# --- CONFIGURATION ---
MYSQL_URL = "mysql+pymysql://root:password@localhost:3307/company_ai_db"
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "company_documents"
EMBEDDING_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3"

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- MYSQL SETUP ---
engine = create_engine(MYSQL_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"
    id = Column(String(36), primary_key=True)
    filename = Column(String(255))
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

# --- QDRANT SETUP ---
q_client = QdrantClient(url=QDRANT_URL)
try:
    q_client.get_collection(COLLECTION_NAME)
except:
    q_client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=768, distance=Distance.COSINE), # nomic-embed-text size is 768
    )

# --- HELPER FUNCTIONS ---
def get_embedding(text):
    response = ollama.embeddings(model=EMBEDDING_MODEL, prompt=text)
    return response["embedding"]

# --- API ENDPOINTS ---
@app.get("/documents")
def get_documents():
    db = SessionLocal()
    docs = db.query(Document).all()
    db.close()
    return [{"id": d.id, "filename": d.filename} for d in docs]

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    # 1. Save metadata to MySQL
    doc_id = str(uuid.uuid4())
    db = SessionLocal()
    new_doc = Document(id=doc_id, filename=file.filename)
    db.add(new_doc)
    db.commit()
    db.close()

    # 2. Extract Text from PDF
    pdf_reader = pypdf.PdfReader(file.file)
    text = "\n".join([page.extract_text() for page in pdf_reader.pages])

    # 3. Chunk Text
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_text(text)

    # 4. Embed and store in Qdrant
    points = []
    for i, chunk in enumerate(chunks):
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=get_embedding(chunk),
                payload={"doc_id": doc_id, "filename": file.filename, "text": chunk}
            )
        )
    
    q_client.upsert(collection_name=COLLECTION_NAME, points=points)
    return {"message": "Document uploaded and processed successfully"}

@app.post("/chat")
async def chat(request: dict):
    user_query = request.get("query")
    if not user_query:
        raise HTTPException(status_code=400, detail="Query required")


    # 1. Retrieve context from Qdrant
    query_vector = get_embedding(user_query)
    search_result = q_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=3
    ).points
    
    context = "\n".join([hit.payload["text"] for hit in search_result])

    # 2. Generate response with Ollama
    system_prompt = f"""You are a helpful Company AI Assistant. Answer the user's question based ONLY on the following context. If you don't know the answer, say "I don't have information about that in the company documents."
    Context: {context}"""

    response = ollama.chat(model=LLM_MODEL, messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_query}
    ])

    return {"response": response["message"]["content"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)