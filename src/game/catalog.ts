import type { Catalog, CardId, Hero, Spell } from './types.js';

export function validateCatalog(c: Catalog): void {
  if (c.cards.length !== 48 || c.students.length !== 8) throw new Error('Ожидались 48 заклинаний и 8 учеников');
  if (new Set(c.cards.map(x => x.id)).size !== 48) throw new Error('Повторяющиеся cardId');
  if (new Set(c.students.map(x => x.id)).size !== 8) throw new Error('Повторяющиеся studentId');
  for (const element of ['fire','water','air','earth'] as const) {
    const powers = c.cards.filter(x=>x.element===element).map(x=>x.power).sort((a,b)=>a-b);
    if (JSON.stringify(powers)!==JSON.stringify([2,2,3,3,3,4,4,4,5,5,5,6])) throw new Error(`Неверный набор ${element}`);
    if (c.students.filter(x=>x.element===element).length!==2) throw new Error(`Не 2 героя: ${element}`);
  }
  for (const x of c.cards) if (!x.name || !x.image) throw new Error('Пустое поле карты');
}
export function spell(c: Catalog, id: CardId): Spell {
  const x=c.cards.find(z=>z.id===id);
  if (!x) throw new Error(`Неизвестная карта ${id}`);
  return x;
}
export function hero(c: Catalog, id: string): Hero {
  const x=c.students.find(z=>z.id===id);
  if (!x) throw new Error(`Неизвестный ученик ${id}`);
  return x;
}
/** Адаптер каталога ассетов без добавления логики карт. */
export function catalogFromManifest(source: {cards: Array<{id:string; name:string; element:string; power:number; image:string}>;students:Array<{id:string;name:string;element:string;image:string}>}):Catalog {
  const c={cards:source.cards as Spell[], students:source.students as Hero[]};
  validateCatalog(c);
  return c;
}
