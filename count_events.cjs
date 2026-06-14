const db = require('./database.json');
const ids = new Set(db.guests.map(g => g.eventId));
console.log("Event IDs in guests:", Array.from(ids));
console.log("Events in eventsList:", db.eventsList.map(e => e.id));
console.log("Event details ID:", db.eventDetails?.id);
