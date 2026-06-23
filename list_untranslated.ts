import * as fs from 'fs';
import * as path from 'path';

const file = 'CommitteeDashboard.tsx';
const filePath = path.join(process.cwd(), 'src', 'components', file);
if (fs.existsSync(filePath)) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const matches = lines
    .map((l, i) => `${i + 1}: ${l.trim()}`)
    .filter(l => /[A-Z]/.test(l) && /(Kamati|Tukio|Harusi|Wageni|Jina|Mgeni|Tarehe|Muda|Mahali|Hakuna|Jumla|Sitaweza|Asante|Ahadi|Kumbukumbu|Walio|Mchango|Malipo)/.test(l) && !l.includes('isEn') && !l.includes('//') && !l.includes('`'));
  console.log(`\n--- Untranslated in ${file} ---`);
  console.log(matches.slice(0, 30).join('\n'));
}
