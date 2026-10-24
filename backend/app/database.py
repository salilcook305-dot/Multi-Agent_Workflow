import os
import json
import time
from typing import Dict, Any, List, Optional
from pathlib import Path
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError
from app.config import settings

class DatabaseManager:
    def __init__(self, uri: Optional[str] = None, db_name: Optional[str] = None):
        self.uri = uri or settings.mongodb_uri
        self.db_name = db_name or settings.mongodb_db_name
        self.client: Optional[MongoClient] = None
        self.db = None
        self.is_connected = False
        self.local_data_dir = settings.data_dir
        self._init_connection()

    def _init_connection(self):
        if not self.uri:
            print("[Database] No MONGODB_URI provided. Running in local JSON persistence mode.")
            self.is_connected = False
            return

        try:
            # Short timeout so it doesn't hang if offline
            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=3000)
            self.client.admin.command('ping')
            self.db = self.client[self.db_name]
            self.is_connected = True
            print(f"[Database] Successfully connected to MongoDB Atlas database: {self.db_name}")
            self._ensure_indexes()
        except (ConnectionFailure, PyMongoError) as e:
            print(f"[Database] MongoDB Atlas connection failed ({e}). Falling back to local persistence.")
            self.is_connected = False
            self.client = None
            self.db = None

    def update_uri(self, new_uri: str, db_name: Optional[str] = None):
        self.uri = new_uri
        if db_name:
            self.db_name = db_name
        self._init_connection()
        return self.is_connected

    def _ensure_indexes(self):
        if not self.is_connected or self.db is None:
            return
        try:
            self.db.runs.create_index("run_id", unique=True)
            self.db.steps.create_index([("run_id", 1), ("timestamp", 1)])
            self.db.documents.create_index("file_id", unique=True)
        except Exception as e:
            print(f"[Database] Notice creating indexes: {e}")

    # Local fallback file helper
    def _get_local_file(self, collection_name: str) -> Path:
        return self.local_data_dir / f"{collection_name}.json"

    def _read_local_collection(self, collection_name: str) -> List[Dict[str, Any]]:
        path = self._get_local_file(collection_name)
        if not path.exists():
            return []
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _write_local_collection(self, collection_name: str, items: List[Dict[str, Any]]):
        path = self._get_local_file(collection_name)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[Database] Error writing to local file {collection_name}: {e}")

    # Run collection operations
    def save_run(self, run_data: Dict[str, Any]):
        if self.is_connected and self.db is not None:
            try:
                self.db.runs.update_one(
                    {"run_id": run_data["run_id"]},
                    {"$set": run_data},
                    upsert=True
                )
                return
            except Exception as e:
                print(f"[Database] MongoDB save_run error: {e}. Writing locally.")

        # Local fallback
        runs = self._read_local_collection("runs")
        existing_idx = next((i for i, r in enumerate(runs) if r.get("run_id") == run_data.get("run_id")), None)
        if existing_idx is not None:
            runs[existing_idx] = run_data
        else:
            runs.insert(0, run_data)
        self._write_local_collection("runs", runs)

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        if self.is_connected and self.db is not None:
            try:
                doc = self.db.runs.find_one({"run_id": run_id}, {"_id": 0})
                if doc:
                    return doc
            except Exception as e:
                print(f"[Database] MongoDB get_run error: {e}")

        # Local fallback
        runs = self._read_local_collection("runs")
        return next((r for r in runs if r.get("run_id") == run_id), None)

    def list_runs(self, limit: int = 50) -> List[Dict[str, Any]]:
        if self.is_connected and self.db is not None:
            try:
                cursor = self.db.runs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
                return list(cursor)
            except Exception as e:
                print(f"[Database] MongoDB list_runs error: {e}")

        runs = self._read_local_collection("runs")
        runs.sort(key=lambda x: x.get("created_at", 0), reverse=True)
        return runs[:limit]

    # Step event operations
    def log_step(self, event_data: Dict[str, Any]):
        if self.is_connected and self.db is not None:
            try:
                self.db.steps.insert_one(event_data.copy())
                return
            except Exception as e:
                print(f"[Database] MongoDB log_step error: {e}")

        steps = self._read_local_collection("steps")
        steps.append(event_data)
        self._write_local_collection("steps", steps)

    def get_run_steps(self, run_id: str) -> List[Dict[str, Any]]:
        if self.is_connected and self.db is not None:
            try:
                cursor = self.db.steps.find({"run_id": run_id}, {"_id": 0}).sort("timestamp", 1)
                return list(cursor)
            except Exception as e:
                print(f"[Database] MongoDB get_run_steps error: {e}")

        steps = self._read_local_collection("steps")
        return [s for s in steps if s.get("run_id") == run_id]

    # Document operations (Uploaded PPT files metadata)
    def save_document(self, doc_data: Dict[str, Any]):
        if self.is_connected and self.db is not None:
            try:
                self.db.documents.update_one(
                    {"file_id": doc_data["file_id"]},
                    {"$set": doc_data},
                    upsert=True
                )
                return
            except Exception as e:
                print(f"[Database] MongoDB save_document error: {e}")

        docs = self._read_local_collection("documents")
        existing_idx = next((i for i, d in enumerate(docs) if d.get("file_id") == doc_data.get("file_id")), None)
        if existing_idx is not None:
            docs[existing_idx] = doc_data
        else:
            docs.insert(0, doc_data)
        self._write_local_collection("documents", docs)

    def list_documents(self) -> List[Dict[str, Any]]:
        if self.is_connected and self.db is not None:
            try:
                cursor = self.db.documents.find({}, {"_id": 0}).sort("uploaded_at", -1)
                return list(cursor)
            except Exception as e:
                print(f"[Database] MongoDB list_documents error: {e}")

        return self._read_local_collection("documents")

    def get_document(self, file_id: str) -> Optional[Dict[str, Any]]:
        if self.is_connected and self.db is not None:
            try:
                doc = self.db.documents.find_one({"file_id": file_id}, {"_id": 0})
                if doc:
                    return doc
            except Exception as e:
                print(f"[Database] MongoDB get_document error: {e}")

        docs = self._read_local_collection("documents")
        return next((d for d in docs if d.get("file_id") == file_id), None)

    def delete_document(self, file_id: str):
        if self.is_connected and self.db is not None:
            try:
                self.db.documents.delete_one({"file_id": file_id})
            except Exception as e:
                print(f"[Database] MongoDB delete_document error: {e}")

        docs = self._read_local_collection("documents")
        docs = [d for d in docs if d.get("file_id") != file_id]
        self._write_local_collection("documents", docs)

db_manager = DatabaseManager()
