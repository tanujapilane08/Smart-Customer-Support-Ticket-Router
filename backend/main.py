import io
import csv
import uuid
from datetime import datetime, timedelta

import docx
import jwt
import ollama
import pypdf
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from langchain_text_splitters import RecursiveCharacterTextSplitter
from passlib.context import CryptContext
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)
from sqlalchemy import Column, DateTime, String, create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# --- CONFIGURATION ---
MYSQL_URL = "mysql+pymysql://root:password@localhost:3307/support_db"
QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "company_documents"
EMBEDDING_MODEL = "nomic-embed-text"
LLM_MODEL = "llama3.2:1b"

# --- SECURITY SETUP ---
SECRET_KEY = "my_super_secret_key_for_btech_project"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120  # Wristband expires in 2 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_password_hash(password):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials. Please log in again.",
        )


app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# --- MYSQL SETUP ---
engine = create_engine(MYSQL_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Document(Base):
    __tablename__ = "documents"
    id = Column(String(36), primary_key=True)
    filename = Column(String(255))
    upload_date = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)

# --- QDRANT SETUP ---
q_client = QdrantClient(url=QDRANT_URL, timeout=60)
try:
    q_client.get_collection(COLLECTION_NAME)
except Exception:
    q_client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=768, distance=Distance.COSINE),
    )


# --- HELPER FUNCTIONS ---
def get_embedding(content: str):
    response = ollama.embeddings(model=EMBEDDING_MODEL, prompt=content)
    return response["embedding"]


def extract_text_from_file(filename: str, contents: bytes) -> str:
    ext = filename.lower().split(".")[-1]
    extracted_text = ""

    if ext == "pdf":
        pdf_reader = pypdf.PdfReader(io.BytesIO(contents))
        extracted_text = "\n".join(
            [(page.extract_text() or "") for page in pdf_reader.pages]
        )

    elif ext == "docx":
        doc = docx.Document(io.BytesIO(contents))
        extracted_text = "\n".join(
            [para.text for para in doc.paragraphs if para.text.strip()]
        )

    elif ext == "csv":
        decoded = contents.decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(decoded))
        rows = []
        for i, row in enumerate(reader):
            if i >= 100:  # Cap browser uploads at 100 rows for speed
                break
            row_text = " | ".join(f"{k}: {v}" for k, v in row.items() if v)
            if row_text:
                rows.append(row_text)
        extracted_text = "\n".join(rows)

    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a .pdf, .docx, or .csv file.",
        )

    return extracted_text


# --- PYDANTIC MODELS ---
class UserRegister(BaseModel):
    username: str
    password: str
    role: str  # Must be 'Employee' or 'Engineer'


class TicketCreate(BaseModel):
    query: str


class UserLogin(BaseModel):
    username: str
    password: str


# --- API ENDPOINTS ---
@app.get("/documents")
def get_documents(current_user: dict = Depends(get_current_user)):
    db = SessionLocal()
    try:
        docs = db.query(Document).order_by(Document.upload_date.desc()).all()
        return [
            {
                "id": d.id,
                "filename": d.filename,
                "file_type": (
                    d.filename.split(".")[-1].upper() if "." in d.filename else "FILE"
                ),
                "uploaded_at": d.upload_date.isoformat() if d.upload_date else None,
            }
            for d in docs
        ]
    finally:
        db.close()


@app.get("/documents/{doc_id}/content")
def view_document_content(doc_id: str, current_user: dict = Depends(get_current_user)):
    points, _ = q_client.scroll(
        collection_name=COLLECTION_NAME,
        scroll_filter=Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
        ),
        limit=100,
        with_payload=True,
    )
    if not points:
        raise HTTPException(status_code=404, detail="Document content not found.")

    full_text = "\n\n".join([p.payload.get("text", "") for p in points])
    return {
        "filename": points[0].payload.get("filename", "Document"),
        "content": full_text,
    }


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...), current_user: dict = Depends(get_current_user)
):
    # 1. Read and extract text from PDF, DOCX, or CSV
    contents = await file.read()
    extracted_text = extract_text_from_file(file.filename, contents)

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No readable text found in file.")

    # 2. Chunk text
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_text(extracted_text)

    # 3. Batch embed and store in Qdrant
    doc_id = str(uuid.uuid4())
    vectors = ollama.embed(model=EMBEDDING_MODEL, input=chunks)["embeddings"]

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vec,
            payload={
                "doc_id": doc_id,
                "filename": file.filename,
                "text": chunk,
            },
        )
        for chunk, vec in zip(chunks, vectors)
    ]

    q_client.upsert(collection_name=COLLECTION_NAME, points=points)

    # 4. Save metadata to MySQL
    db = SessionLocal()
    try:
        new_doc = Document(id=doc_id, filename=file.filename)
        db.add(new_doc)
        db.commit()
    finally:
        db.close()

    return {"message": f"Successfully uploaded and indexed {file.filename}"}


@app.post("/chat")
async def chat(request: dict):
    user_query = request.get("query")
    if not user_query:
        raise HTTPException(status_code=400, detail="Query required")

    # 1. Retrieve context from Qdrant
    query_vector = get_embedding(user_query)
    search_result = q_client.query_points(
        collection_name=COLLECTION_NAME, query=query_vector, limit=3
    ).points

    context = "\n".join([hit.payload["text"] for hit in search_result])

    # 2. Generate response with Ollama
    system_prompt = f"""You are a helpful Company AI Assistant. Answer the user's question based ONLY on the following context. If you don't know the answer, say "I don't have information about that in the company documents."
    Context: {context}"""

    response = ollama.chat(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query},
        ],
        options={"num_predict": 150},
    )

    return {"response": response["message"]["content"]}


@app.post("/register")
def register_user(user: UserRegister):
    hashed_pw = get_password_hash(user.password)
    db = SessionLocal()

    try:
        db.execute(
            text(
                "INSERT INTO users (username, password_hash, role) VALUES (:u, :p, :r)"
            ),
            {"u": user.username, "p": hashed_pw, "r": user.role},
        )
        db.commit()
        return {"message": f"Successfully registered {user.username} as an {user.role}!"}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username might already exist.")
    finally:
        db.close()


@app.post("/login")
def login_user(form_data: OAuth2PasswordRequestForm = Depends()):
    db = SessionLocal()
    try:
        result = db.execute(
            text("SELECT * FROM users WHERE username = :u"),
            {"u": form_data.username},
        ).fetchone()
    finally:
        db.close()

    if not result or not verify_password(form_data.password, result.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    expire_time = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {
        "sub": result.username,
        "role": result.role,
        "id": result.id,
        "exp": expire_time,
    }

    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": result.role,
        "username": result.username,
    }


@app.post("/tickets")
def create_ticket(
    ticket: TicketCreate, current_user: dict = Depends(get_current_user)
):
    # ---------------------------------------------------------
    # AGENT 1: THE ROUTER
    # ---------------------------------------------------------
    prompt_text = (
        "Categorize this support issue into exactly one of these departments: "
        "Network, Software, Hardware, HR, Identity. Reply with ONLY the single word. "
        f"Issue: {ticket.query}"
    )

    router_response = ollama.chat(
        model=LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a ticket routing AI. Output only one word from the allowed list.",
            },
            {"role": "user", "content": prompt_text},
        ],
        options={"num_predict": 5},
    )

    department = router_response["message"]["content"].strip()
    valid_departments = ["Network", "Software", "Hardware", "HR", "Identity"]
    if department not in valid_departments:
        department = "Software"

    # ---------------------------------------------------------
    # AGENT 2: THE SUPPORT TECH (RAG SEARCH)
    # ---------------------------------------------------------
    query_vector = get_embedding(ticket.query)

    search_result = q_client.query_points(
        collection_name=COLLECTION_NAME, query=query_vector, limit=3
    ).points

    context = "\n".join([hit.payload["text"] for hit in search_result])

    support_prompt = f"""You are a helpful IT Support AI. Based ONLY on the company context provided, write a short, friendly suggested fix for the user's problem. If the context is empty or doesn't contain the answer, politely say a human agent will review the ticket soon. Do not invent a solution.
    Context: {context}"""

    support_response = ollama.chat(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": support_prompt},
            {"role": "user", "content": ticket.query},
        ],
        options={"num_predict": 150},
    )

    suggested_fix = support_response["message"]["content"]

    # ---------------------------------------------------------
    # SAVE TO DATABASE
    # ---------------------------------------------------------
    db = SessionLocal()
    try:
        db.execute(
            text(
                "INSERT INTO tickets (user_id, original_query, department) VALUES (:uid, :q, :d)"
            ),
            {"uid": current_user["id"], "q": ticket.query, "d": department},
        )
        db.commit()

        return {
            "message": "Ticket routed successfully!",
            "user": current_user["sub"],
            "assigned_department": department,
            "ai_suggested_fix": suggested_fix,
            "query": ticket.query,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/admin/tickets")
def view_all_tickets(current_user: dict = Depends(get_current_user)):
    db = SessionLocal()
    try:
        result = db.execute(text("SELECT * FROM tickets ORDER BY id DESC"))
        return [dict(row) for row in result.mappings()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)