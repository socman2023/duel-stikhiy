import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve(import.meta.dirname,'..');
const m=JSON.parse(fs.readFileSync(path.join(base,'src/game/manifest.json'),'utf8'));
if(m.cards.length!==48||m.students.length!==8)throw Error('Неверное число карт или учеников');
const check=(p)=>{if(!fs.existsSync(path.join(base,'public/art',p)))throw Error('Отсутствует: '+p)};
for(const c of m.cards){check(c.image);check(c.thumbnail)}
for(const s of m.students){check(s.image);check(s.thumbnail)}
check('ui/card_back.webp');check('ui/elements_reference.webp');
const other=JSON.parse(fs.readFileSync(path.join(base,'data/manifest.json'),'utf8'));
if(JSON.stringify(other)!==JSON.stringify(m))throw Error('data/manifest.json отличается от src/game/manifest.json');
console.log('OK: 48 карт × 2, 8 учеников × 2, фоновые ресурсы');
