import * as fs from 'fs';

const p = 'src/components/QRScanner.tsx';
let txt = fs.readFileSync(p, 'utf8');

txt = txt.replace(
  ": [\"ID\", \"Namba ya Kadi (Code)\", \"Jina la Mgeni\", \"Namba ya Simu\", \"Aina ya Kadi (Card Type)\", \"Muda wa Kuingia (Check-in Time)\", \"RSVP Status\", \"Idadi ya Wageni (Companions)\"];",
  ": isEn ? [\"ID\", \"Code\", \"Guest Name\", \"Phone Number\", \"Card Type\", \"Check-in Time\", \"RSVP Status\", \"Companions\"] : [\"ID\", \"Namba ya Kadi (Code)\", \"Jina la Mgeni\", \"Namba ya Simu\", \"Aina ya Kadi (Card Type)\", \"Muda wa Kuingia (Check-in Time)\", \"RSVP Status\", \"Idadi ya Wageni (Companions)\"];"
);
txt = txt.replace(
  "triggerScanResult(target || null, !target, !target ? 'Mgeni huyu hajapatikana kwenye orodha!' : '');",
  "triggerScanResult(target || null, !target, !target ? (isEn ? 'This guest was not found in the list!' : 'Mgeni huyu hajapatikana kwenye orodha!') : '');"
);
txt = txt.replace(
  "swahiliMessage = 'Kifaa cha Kamera Hakipatikani (NotFoundError)! Hakuna kamera inayofanya kazi iliyotambuliwa kwenye kifaa hiki kwa sasa.';",
  "swahiliMessage = isEn ? 'Camera Device Not Found (NotFoundError)! No working camera detected on this device right now.' : 'Kifaa cha Kamera Hakipatikani (NotFoundError)! Hakuna kamera inayofanya kazi iliyotambuliwa kwenye kifaa hiki kwa sasa.';"
);
txt = txt.replace(
  "Wageni & Hakiki ({countConfirmedGuests})",
  "{isEn ? 'Guests & Check-in' : 'Wageni & Hakiki'} ({countConfirmedGuests})"
);
txt = txt.replace(
  "<span>Pakua Walioingia ({countCheckedIn}) - CSV</span>",
  "<span>{isEn ? 'Download Checked-in' : 'Pakua Walioingia'} ({countCheckedIn}) - CSV</span>"
);
txt = txt.replace(
  "<h4 className=\"font-bold text-lg leading-tight uppercase font-sans\">Mgeni Amekubaliwa!</h4>",
  "<h4 className=\"font-bold text-lg leading-tight uppercase font-sans\">{isEn ? 'Guest Admitted!' : 'Mgeni Amekubaliwa!'}</h4>"
);
txt = txt.replace(
  "<span>Piga Picha ya Mgeni</span>",
  "<span>{isEn ? 'Take Guest Photo' : 'Piga Picha ya Mgeni'}</span>"
);
txt = txt.replace(
  "<strong>Njia Mbadala ya Haraka:</strong> Hakuna shida kabisa! Kwenye upande wa kulia, gusa tu kitufe cha <strong className=\"text-blue-300\">Tafuta kwa Jina</strong> au orodha ya wageni uwa-check in kwa kubofya mara moja tu bila kuhitaji kamera!",
  "isEn ? <><strong>Quick Alternative:</strong> No problem at all! On the right side, just tap the <strong className=\"text-blue-300\">Search by Name</strong> button or the guest list to check them in with one click without needing a camera!</> : <><strong>Njia Mbadala ya Haraka:</strong> Hakuna shida kabisa! Kwenye upande wa kulia, gusa tu kitufe cha <strong className=\"text-blue-300\">Tafuta kwa Jina</strong> au orodha ya wageni uwa-check in kwa kubofya mara moja tu bila kuhitaji kamera!</>"
);
txt = txt.replace(
  "<span>Walioingia (Scanned)</span>",
  "<span>{isEn ? 'Checked-in (Scanned)' : 'Walioingia (Scanned)'}</span>"
);
txt = txt.replace(
  "<span>Waliothibitisha (Confirmed RSVP)</span>",
  "<span>{isEn ? 'Confirmed (RSVP)' : 'Waliothibitisha (Confirmed RSVP)'}</span>"
);

fs.writeFileSync(p, txt);
console.log('done qr');
