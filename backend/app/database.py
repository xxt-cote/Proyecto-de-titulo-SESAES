from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")
# Conservar opciones de conexión (p. ej., search_path de pruebas aisladas).
opciones_postgres = {}
if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
    opciones_previas = make_url(DATABASE_URL).query.get("options", "")
    opciones_postgres["options"] = f"{opciones_previas} -c timezone=America/Santiago".strip()

engine = create_engine(
    DATABASE_URL,
    connect_args=opciones_postgres,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
