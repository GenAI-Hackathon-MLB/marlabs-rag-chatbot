CREATE TABLE conversation_history (id TEXT PRIMARY KEY, session_id TEXT, type TEXT, content TEXT, role TEXT, name TEXT, additional_kwargs TEXT);
CREATE INDEX id_index ON conversation_history (id);
CREATE INDEX session_id_index ON conversation_history (session_id);
CREATE TABLE joblistings (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), url TEXT NOT NULL UNIQUE, role TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, vids TEXT);
CREATE TABLE knowledge_base (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), url TEXT NOT NULL UNIQUE, title TEXT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, vids TEXT);