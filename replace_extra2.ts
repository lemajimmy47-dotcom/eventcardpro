import * as fs from 'fs';

function repl(p: string, from: string | RegExp, to: string) {
  let txt = fs.readFileSync(p, 'utf8');
  txt = txt.replace(from, to);
  fs.writeFileSync(p, txt);
}

// GuestPledgeSubmissionPage
repl('src/components/GuestPledgeSubmissionPage.tsx', 'Ndugu <strong>{displayGuestName}</strong>, unakaribishwa kuweka ahadi yako ya mchango ili kuunga mkono shughuli hii. Ahadi yako itawekwa mara moja kwenye kadi yako maalum.', '{isEn ? <>Dear <strong>{displayGuestName}</strong>, you are welcome to make your contribution pledge to support this event. Your pledge will be immediately recorded on your special card.</> : <>Ndugu <strong>{displayGuestName}</strong>, unakaribishwa kuweka ahadi yako ya mchango ili kuunga mkono shughuli hii. Ahadi yako itawekwa mara moja kwenye kadi yako maalum.</>}');

// LandingPage (which doesn't have isEn, it uses language directly)
repl('src/components/LandingPage.tsx', '<p>• <strong>{language === \'sw\' ? \'Tarehe:\' : \'Date:\'}</strong> 26/11/2026</p>', '<p>• <strong>{language === \'sw\' ? \'Tarehe:\' : \'Date:\'}</strong> 26/11/2026</p>');
repl('src/components/LandingPage.tsx', '<strong>Swahili:</strong> Kila ujumbe wa WhatsApp unaotumwa kutoka kwenye mfumo wetu unajumuisha mwongozo wa jinsi ya KUKATAA (Exit/Opt-out). Mgeni anaweza kuandika neno <strong>"STOP"</strong> au <strong>"KANSILA"</strong> kurudisha jibu la kiotomatiki linalofuta mara moja namba yake kwenye vikumbusho vya baadae. Hii inahakikisha utii wetu kamili kwa sera za WhatsApp Business.', '{language === "en" ? <><strong>English:</strong> Every WhatsApp message sent from our system includes an opt-out guide. A guest can reply with the word <strong>"STOP"</strong> or <strong>"CANCEL"</strong> to trigger an automated response that immediately removes their number from future reminders. This ensures our full compliance with WhatsApp Business policies.</> : <><strong>Swahili:</strong> Kila ujumbe wa WhatsApp unaotumwa kutoka kwenye mfumo wetu unajumuisha mwongozo wa jinsi ya KUKATAA (Exit/Opt-out). Mgeni anaweza kuandika neno <strong>"STOP"</strong> au <strong>"KANSILA"</strong> kurudisha jibu la kiotomatiki linalofuta mara moja namba yake kwenye vikumbusho vya baadae. Hii inahakikisha utii wetu kamili kwa sera za WhatsApp Business.</>}');

// Login
repl('src/components/Login.tsx', "? 'Jina la mtumiaji au nenosiri si sahihi! Kwa mlinzi mlangoni, weka username kuelekezwa \"scanner\" na password kuwa ID ya tukio.'", "? (language === 'en' ? 'Invalid username or password! For gate security, use username \"scanner\" and event ID as password.' : 'Jina la mtumiaji au nenosiri si sahihi! Kwa mlinzi mlangoni, weka username kuelekezwa \"scanner\" na password kuwa ID ya tukio.')");

console.log('done extra2');
