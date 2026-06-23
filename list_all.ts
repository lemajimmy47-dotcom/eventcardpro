import * as fs from 'fs';
import * as path from 'path';

const componentsDir = path.join(process.cwd(), 'src', 'components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(componentsDir, file);
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const matches = lines
    .map((l, i) => `${i + 1}: ${l.trim()}`)
    .filter(l => /[A-Z]/.test(l) && /(Kamati|Tukio|Harusi|Wageni|Jina|Mgeni|Tarehe|Muda|Mahali|Hakuna|Jumla|Sitaweza|Asante|Ahadi|Kumbukumbu|Walio|Mchango|Malipo)/.test(l) && !l.includes('isEn') && !l.includes('//') && !l.includes('`'));
  if (matches.length > 0) {
    console.log(`\n--- Untranslated in ${file} ---`);
    console.log(matches.slice(0, 10).join('\n'));
  }
}
