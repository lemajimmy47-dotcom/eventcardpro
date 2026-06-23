import * as fs from 'fs';

const p = 'src/components/CommitteeDashboard.tsx';
let txt = fs.readFileSync(p, 'utf8');

txt = txt.replace(
  "Jumla SMS Zilizotumwa:",
  "{isEn ? 'Total SMS Sent:' : 'Jumla SMS Zilizotumwa:'}"
);
txt = txt.replace(
  "Jumla WA Zilizotumwa:",
  "{isEn ? 'Total WA Sent:' : 'Jumla WA Zilizotumwa:'}"
);
txt = txt.replace(
  "<th className=\"py-3.5 px-4 font-black\">Tarehe</th>",
  "<th className=\"py-3.5 px-4 font-black\">{isEn ? 'Date' : 'Tarehe'}</th>"
);
txt = txt.replace(
  "<p className=\"mt-2\">Hakuna malipo yaliyosajiliwa bado kwenye mfumo.</p>",
  "<p className=\"mt-2\">{isEn ? 'No payments registered in the system yet.' : 'Hakuna malipo yaliyosajiliwa bado kwenye mfumo.'}</p>"
);
txt = txt.replace(
  "Mungu ni mwema! Hakuna mtu anayedaiwa sasa hivi.",
  "{isEn ? 'God is good! No one owes anything right now.' : 'Mungu ni mwema! Hakuna mtu anayedaiwa sasa hivi.'}"
);
txt = txt.replace(
  "<h4 className=\"font-extrabold text-xs uppercase text-slate-300 font-mono\">4. Orodha ya Waliotimiza Ahadi Kikamilifu</h4>",
  "<h4 className=\"font-extrabold text-xs uppercase text-slate-300 font-mono\">{isEn ? '4. List of Fully Paid Members' : '4. Orodha ya Waliotimiza Ahadi Kikamilifu'}</h4>"
);
txt = txt.replace(
  "<h4 className=\"font-extrabold text-xs uppercase text-slate-300 font-mono\">5. Orodha Kuu ya Ahadi Zote zilizowekwa</h4>",
  "<h4 className=\"font-extrabold text-xs uppercase text-slate-300 font-mono\">{isEn ? '5. Master List of All Pledges' : '5. Orodha Kuu ya Ahadi Zote zilizowekwa'}</h4>"
);
txt = txt.replace(
  "{g.phone || 'Hakuna simu'}",
  "{g.phone || (isEn ? 'No phone' : 'Hakuna simu')}"
);

fs.writeFileSync(p, txt);
console.log('done');
