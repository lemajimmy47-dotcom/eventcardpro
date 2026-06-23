import * as fs from 'fs';

const p = 'src/components/SaveTheDateManager.tsx';
let txt = fs.readFileSync(p, 'utf8');

txt = txt.replace(
  "const guestName = isString ? guest : (guest.name || 'Mgeni');",
  "const guestName = isString ? guest : (guest.name || (isEn ? 'Guest' : 'Mgeni'));"
);
txt = txt.replace(
  "\"Kumbuka: Una mabadiliko kwenye picha au template ambayo haujahifadhi. Wageni wataona picha ya zamani iliyopo kwenye database. Je, unataka kuendelea kutuma?\"",
  "isEn ? 'Note: You have unsaved changes to the image or template. Guests will see the old picture saved in the database. Do you want to continue sending?' : \"Kumbuka: Una mabadiliko kwenye picha au template ambayo haujahifadhi. Wageni wataona picha ya zamani iliyopo kwenye database. Je, unataka kuendelea kutuma?\""
);
txt = txt.replace(
  "showToast(\"Hakuna wageni kwenye orodha hii ya kutumiwa ujumbe!\", \"info\");",
  "showToast(isEn ? 'No guests in this list to send messages to!' : \"Hakuna wageni kwenye orodha hii ya kutumiwa ujumbe!\", \"info\");"
);
txt = txt.replace(
  "rsvpFilter === 'confirmed' ? 'Waliodhibiti RSVP' :",
  "rsvpFilter === 'confirmed' ? (isEn ? 'Confirmed RSVP' : 'Waliodhibiti RSVP') :"
);
txt = txt.replace(
  "rsvpFilter === 'pending' ? 'Bado hawajathibitisha' : 'Waliokataa';",
  "rsvpFilter === 'pending' ? (isEn ? 'Pending' : 'Bado hawajathibitisha') : (isEn ? 'Declined' : 'Waliokataa');"
);
txt = txt.replace(
  "placeholder=\"Save The Date - Harusi Maalum\"",
  "placeholder={isEn ? \"Save The Date - Special Wedding\" : \"Save The Date - Harusi Maalum\"}"
);
txt = txt.replace(
  "<h4 className=\"font-bold text-slate-300 text-[10px] uppercase font-mono tracking-wider\">Miamala na Kumbukumbu ya Kutuma (Logs)</h4>",
  "<h4 className=\"font-bold text-slate-300 text-[10px] uppercase font-mono tracking-wider\">{isEn ? 'Transactions and Send Logs' : 'Miamala na Kumbukumbu ya Kutuma (Logs)'}</h4>"
);
txt = txt.replace(
  "<h4 className=\"text-xs text-slate-400 italic\">Mgeni: <span className=\"font-extrabold text-white not-italic uppercase\">{viewGuestStd.name}</span></h4>",
  "<h4 className=\"text-xs text-slate-400 italic\">{isEn ? 'Guest' : 'Mgeni'}: <span className=\"font-extrabold text-white not-italic uppercase\">{viewGuestStd.name}</span></h4>"
);
txt = txt.replace(
  "<span>Ujumbe wa Mgeni Huyu ({viewGuestStd.phone})</span>",
  "<span>{isEn ? 'Message for this Guest' : 'Ujumbe wa Mgeni Huyu'} ({viewGuestStd.phone})</span>"
);

fs.writeFileSync(p, txt);
console.log('done std');
