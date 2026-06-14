import fs from 'fs';
import path from 'path';

function walkDir(dir: string, callback: (path: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    content = content.replace(/INVITEPRO/g, 'EVENTCARD');
    content = content.replace(/InvitePro/g, 'EventCard');
    content = content.replace(/invitepro/g, 'eventcard');
    
    // Also consider INVITE PRO just in case
    // Wait, the search only showed exactly those words.
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
