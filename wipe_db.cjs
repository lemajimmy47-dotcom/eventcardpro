const fs = require('fs');
const dbPath = './database.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

db.eventsList = [];
db.eventDetails = null; // Wait, reading `server.ts` they expect `{}` or similar.
db.guests = [];
db.saveTheDates = [];
db.saveTheDateRecipients = [];
db.templateSettings = {};

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log("DB wiped.");
