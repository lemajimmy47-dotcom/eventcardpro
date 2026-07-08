const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('state.json', 'utf8'));
  const activeEventId = data.userAccount ? data.userAccount.activeEventId : 'unknown';
  console.log('Active event ID:', activeEventId);
  const guests = data.guests || [];
  console.log('Total guests:', guests.length);
  const sent = guests.filter(g => 
    (g.smsStatus && g.smsStatus.toLowerCase() === 'imetumia') || 
    (g.whatsappStatus && g.whatsappStatus.toLowerCase() === 'imetumia') ||
    g.smsCount > 0 || g.whatsappCount > 0
  );
  console.log('Sent cards calculated:', sent.length);
  console.log('First 5 guests:');
  console.log(JSON.stringify(guests.slice(0, 5).map(g => ({name: g.name, sms: g.smsStatus, wa: g.whatsappStatus, smsC: g.smsCount, waC: g.whatsappCount})), null, 2));
} catch (e) {
  console.error(e);
}
