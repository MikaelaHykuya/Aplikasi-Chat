const { initDatabase } = require('./src/database');
initDatabase();
console.log('Database initialized successfully');

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) console.error(err);
  else console.log('Tables:', tables.map(t => t.name));
  db.close();
});
