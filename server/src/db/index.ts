import { Database } from "bun:sqlite";

const DB_PATH = `${process.cwd()}/neko.db`;
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.exec("PRAGMA journal_mode = WAL;");

// Initialize Schema
db.run(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    type TEXT,
    iv TEXT,
    salt TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'active', 'trashed')),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    size INTEGER NOT NULL,
    url TEXT,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE,
    UNIQUE(file_id, idx)
  );
`);

// Performance indexes
db.run("CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);");
db.run("CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at);");
db.run("CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id);");
db.run("CREATE INDEX IF NOT EXISTS idx_chunks_message_id ON chunks(message_id);");

// Initialize FTS5 for search
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
    id UNINDEXED,
    name,
    content='files',
    content_rowid='rowid'
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
    INSERT INTO files_fts(rowid, id, name) VALUES (new.rowid, new.id, new.name);
  END;

  CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
    INSERT INTO files_fts(files_fts, rowid, id, name) VALUES('delete', old.rowid, old.id, old.name);
  END;

  CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
    INSERT INTO files_fts(files_fts, rowid, id, name) VALUES('delete', old.rowid, old.id, old.name);
    INSERT INTO files_fts(rowid, id, name) VALUES (new.rowid, new.id, new.name);
  END;
`);

export default db;
