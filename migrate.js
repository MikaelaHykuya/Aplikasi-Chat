const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("PRAGMA foreign_keys=off;");
  db.run("BEGIN TRANSACTION;");
  db.run("ALTER TABLE statuses RENAME TO _statuses_old;");
  db.run(`CREATE TABLE statuses (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'video')),
    mediaUrl TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );`);
  db.run("INSERT INTO statuses SELECT * FROM _statuses_old;");
  db.run("DROP TABLE _statuses_old;");
  db.run("COMMIT;");
  db.run("PRAGMA foreign_keys=on;", (err) => {
    if (err) console.error(err);
    else console.log("Migration successful");
  });
});
