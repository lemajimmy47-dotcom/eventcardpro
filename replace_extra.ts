import * as fs from 'fs';

function repl(p: string, from: string | RegExp, to: string) {
  let txt = fs.readFileSync(p, 'utf8');
  txt = txt.replace(from, to);
  fs.writeFileSync(p, txt);
}

// QRScanner
repl('src/components/QRScanner.tsx', '<span className="text-xl font-extrabold text-white">{countCheckedIn} <span className="text-xs text-slate-400">Wageni</span></span>', '<span className="text-xl font-extrabold text-white">{countCheckedIn} <span className="text-xs text-slate-400">{isEn ? "Guests" : "Wageni"}</span></span>');
repl('src/components/QRScanner.tsx', '<label className="font-bold text-slate-300 block mb-1" htmlFor="simulate-guest-scan-select">Hariri: Chagua Mgeni wa Kuskani</label>', '<label className="font-bold text-slate-300 block mb-1" htmlFor="simulate-guest-scan-select">{isEn ? "Edit: Select Guest to Scan" : "Hariri: Chagua Mgeni wa Kuskani"}</label>');
repl('src/components/QRScanner.tsx', '<p className="text-[8.5px] text-emerald-400 font-bold uppercase font-mono tracking-widest">Waliodhibitisha (RSVP)</p>', '<p className="text-[8.5px] text-emerald-400 font-bold uppercase font-mono tracking-widest">{isEn ? "Confirmed (RSVP)" : "Waliodhibitisha (RSVP)"}</p>');
repl('src/components/QRScanner.tsx', '<p className="text-[8.5px] text-blue-400 font-bold uppercase font-mono tracking-widest">Waliofika (Check-in)</p>', '<p className="text-[8.5px] text-blue-400 font-bold uppercase font-mono tracking-widest">{isEn ? "Arrived (Check-in)" : "Waliofika (Check-in)"}</p>');
repl('src/components/QRScanner.tsx', 'Muda uliopo sasa', '{isEn ? "Current Time" : "Muda uliopo sasa"}');
repl('src/components/QRScanner.tsx', '<p className="text-[10px] text-slate-450 italic">Tukio linaendelea...</p>', '<p className="text-[10px] text-slate-450 italic">{isEn ? "Event in progress..." : "Tukio linaendelea..."}</p>');
repl('src/components/QRScanner.tsx', 'Wageni Waliofika', '{isEn ? "Arrived Guests" : "Wageni Waliofika"}');
repl('src/components/QRScanner.tsx', 'Mtiririko wa Wageni (Arrival Pattern)', '{isEn ? "Guest Arrival Pattern" : "Mtiririko wa Wageni (Arrival Pattern)"}');
repl('src/components/QRScanner.tsx', 'Audit Logs: Orodha ya Muda wa Skani', '{isEn ? "Audit Logs: Scan Time List" : "Audit Logs: Orodha ya Muda wa Skani"}');
repl('src/components/QRScanner.tsx', '<th className="px-5 py-2.5 font-bold">Muda (Time)</th>', '<th className="px-5 py-2.5 font-bold">{isEn ? "Time" : "Muda (Time)"}</th>');

// EventReports
repl('src/components/EventReports.tsx', '<span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase font-mono">2. Walioitikia RSVP</span>', '<span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase font-mono">{isEn ? "2. RSVP Responded" : "2. Walioitikia RSVP"}</span>');
repl('src/components/EventReports.tsx', '<span className="text-[10px] font-black tracking-widest text-blue-400 uppercase font-mono">3. Waliofika / Checked In</span>', '<span className="text-[10px] font-black tracking-widest text-blue-400 uppercase font-mono">{isEn ? "3. Arrived / Checked In" : "3. Waliofika / Checked In"}</span>');
repl('src/components/EventReports.tsx', '<p className="text-2xl font-mono font-black text-blue-300 mt-1">{checkedInCount} Wageni ({arivedPercent()}% Ratio)</p>', '<p className="text-2xl font-mono font-black text-blue-300 mt-1">{checkedInCount} {isEn ? "Guests" : "Wageni"} ({arivedPercent()}% Ratio)</p>');
repl('src/components/EventReports.tsx', '<span>Waliofika / Arrived: <strong className="text-slate-300 font-bold">{checkedInCount}</strong></span>', '<span>{isEn ? "Arrived:" : "Waliofika / Arrived:"} <strong className="text-slate-300 font-bold">{checkedInCount}</strong></span>');
repl('src/components/EventReports.tsx', '<th className="py-3 px-3 font-black">Mgeni (Guest Full Name)</th>', '<th className="py-3 px-3 font-black">{isEn ? "Guest Full Name" : "Mgeni (Guest Full Name)"}</th>');
repl('src/components/EventReports.tsx', '<th className="py-3 px-3 font-black text-center">Muda wa Kufika</th>', '<th className="py-3 px-3 font-black text-center">{isEn ? "Arrival Time" : "Muda wa Kufika"}</th>');

// UploadGuests
repl('src/components/UploadGuests.tsx', 'const headers = "Jina la Mgeni,Namba ya Simu,Aina ya Kadi\\n";', 'const headers = isEn ? "Guest Name,Phone Number,Card Type\\n" : "Jina la Mgeni,Namba ya Simu,Aina ya Kadi\\n";');
repl('src/components/UploadGuests.tsx', 'Inapakia Wageni Kwenye Database...', '{isEn ? "Loading Guests into Database..." : "Inapakia Wageni Kwenye Database..."}');
repl('src/components/UploadGuests.tsx', 'Mgeni anayesajiliwa: {lastUploadedGuestName}', '{isEn ? "Registering guest:" : "Mgeni anayesajiliwa:"} {lastUploadedGuestName}');
repl('src/components/UploadGuests.tsx', '<span>Pakia na Simamia Wageni (Upload Guests)</span>', '<span>{isEn ? "Upload and Manage Guests" : "Pakia na Simamia Wageni (Upload Guests)"}</span>');
repl('src/components/UploadGuests.tsx', '<p className="text-[9px] uppercase font-mono tracking-wider text-blue-400 font-bold">Jumla Kadi</p>', '<p className="text-[9px] uppercase font-mono tracking-wider text-blue-400 font-bold">{isEn ? "Total Cards" : "Jumla Kadi"}</p>');
repl('src/components/UploadGuests.tsx', 'placeholder="Tafuta kwa Jina, Simu, au Code..."', 'placeholder={isEn ? "Search by Name, Phone, or Code..." : "Tafuta kwa Jina, Simu, au Code..."}');
repl('src/components/UploadGuests.tsx', '<title>EVENTCARD - Chapisha Kadi za Wageni</title>', '<title>EVENTCARD - {isEn ? "Print Guest Cards" : "Chapisha Kadi za Wageni"}</title>');
repl('src/components/UploadGuests.tsx', '<h1>Kadi za Wageni - EVENTCARD Designer Print</h1>', '<h1>{isEn ? "Guest Cards" : "Kadi za Wageni"} - EVENTCARD Designer Print</h1>');
repl('src/components/UploadGuests.tsx', '<p>Jumla ya kadi zinazochapishwa: <strong>${itemsToPrint.length}</strong></p>', '<p>{isEn ? "Total cards to print:" : "Jumla ya kadi zinazochapishwa:"} <strong>${itemsToPrint.length}</strong></p>');
repl('src/components/UploadGuests.tsx', ': "Hataza! Mgeni mwenye jina hili au namba hii ya simu tayari yupo kwenye mfumo (Duplicate information found).");', ': (isEn ? "Warning! A guest with this name or phone number already exists in the system (Duplicate information found)." : "Hataza! Mgeni mwenye jina hili au namba hii ya simu tayari yupo kwenye mfumo (Duplicate information found)."));');

console.log('done extra');
