import * as fs from 'fs';

const p = 'src/components/EventReports.tsx';
let txt = fs.readFileSync(p, 'utf8');

txt = txt.replace(
  "subTitleText = \"Ripoti ya Jumla na Muhtasari wa Mahudhurio ya Kadi\";",
  "subTitleText = isEn ? \"General Report and Card Attendance Summary\" : \"Ripoti ya Jumla na Muhtasari wa Mahudhurio ya Kadi\";"
);
txt = txt.replace(
  "subTitleText = \"Orodha Kamili ya Wageni Waliothibitisha Majibu\";",
  "subTitleText = isEn ? \"Complete List of Guests with Confirmed RSVP\" : \"Orodha Kamili ya Wageni Waliothibitisha Majibu\";"
);
txt = txt.replace(
  "subTitleText = \"Wageni Ambapo RSVP Bado haijajibiwa\";",
  "subTitleText = isEn ? \"Guests with Pending RSVP Responses\" : \"Wageni Ambapo RSVP Bado haijajibiwa\";"
);
txt = txt.replace(
  "subTitleText = \"Waliolipa Ahadi Kikamilifu\";",
  "subTitleText = isEn ? \"Fully Paid Members\" : \"Waliolipa Ahadi Kikamilifu\";"
);
txt = txt.replace(
  "subTitleText = \"Orodha ya Wageni Waliosajili Ahadi za Michango\";",
  "subTitleText = isEn ? \"List of Guests with Registered Contribution Pledges\" : \"Orodha ya Wageni Waliosajili Ahadi za Michango\";"
);
txt = txt.replace(
  "subTitleText = \"Wasioonyesha Ahadi au Mapokezi ya Mchango\";",
  "subTitleText = isEn ? \"Guests Without Pledges or Received Contributions\" : \"Wasioonyesha Ahadi au Mapokezi ya Mchango\";"
);
txt = txt.replace(
  "const dateLabel = \" • Tarehe: \";",
  "const dateLabel = isEn ? \" • Date: \" : \" • Tarehe: \";"
);
txt = txt.replace(
  "head: [['S/N', 'Muda (Time Arrived)', 'Mgeni (Guest Full Name)', 'Simu / Mobile', 'Aina ya Kadi', 'Scan Status', 'SMS', 'WA']],",
  "head: [['S/N', isEn ? 'Time Arrived' : 'Muda (Time Arrived)', isEn ? 'Guest Full Name' : 'Mgeni (Guest Full Name)', isEn ? 'Mobile' : 'Simu / Mobile', isEn ? 'Card Type' : 'Aina ya Kadi', 'Scan Status', 'SMS', 'WA']],"
);

fs.writeFileSync(p, txt);
console.log('done reports');
