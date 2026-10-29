import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalogFromManifest,createGame,fight,chooseTarget,chooseAttack,chooseDefense,revealDuel,drawAfterDuel,observe,assertInvariants,SeededRandom,botChoose} from '../dist/index.js';
const catalog=catalogFromManifest(JSON.parse(fs.readFileSync(new URL('../data/manifest.json',import.meta.url),'utf8')));
const setup=[{id:'a',studentId:'ratsha',kind:'human'},{id:'b',studentId:'sanko',kind:'bot',level:'novice'}];
function game(seed=42,players=setup){return createGame(catalog,players,seed,0)};
function swapTo(s,playerId,card,position=0){
  const target=s.players.find(p=>p.id===playerId).hand;
  let src=s.deck;
  if(!src.includes(card))src=s.players.find(p=>p.hand.includes(card))?.hand;
  if(!src)throw new Error('not found');
  const i=src.indexOf(card),temp=target[position];
  src[i]=temp;target[position]=card;
}
function fightOnce(s,ac,dc){
  s=chooseTarget(s,'a','b');s=chooseAttack(s,'a',ac);s=chooseDefense(s,'b',dc);
  return revealDuel(s,catalog);
}
test('каталог: 48 уникальных заклинаний, 8 героев, профили сил',()=>{assert.equal(catalog.cards.length,48);assert.equal(catalog.students.length,8)});
test('правило светофора: Огонь 2 побеждает Землю 6 независимо от силы',()=>{
  let f=fight(catalog,'ratsha','sanko','F12','E01');
  assert.equal(f.verdict,'attacker');assert.equal(f.basis,'element');
  f=fight(catalog,'sanko','ratsha','E01','F12');assert.equal(f.verdict,'defender');
});
test('прочие стихии: строгий круг и нейтральные пары',()=>{
  assert.equal(fight(catalog,'sanko','oleshka','E12','A01').verdict,'attacker');
  assert.equal(fight(catalog,'oleshka','barnard','A12','W01').verdict,'attacker');
  assert.equal(fight(catalog,'barnard','ratsha','W12','F01').verdict,'attacker');
  assert.equal(fight(catalog,'ratsha','oleshka','F12','A01').basis,'power');
  assert.equal(fight(catalog,'sanko','barnard','E12','W01').basis,'power');
});
test('удвоение применяется только при сравнении по силе; ничья сбрасывает обе',()=>{
  const f=fight(catalog,'ratsha','oleshka','F12','A12');
  assert.equal(f.verdict,'tie');assert.equal(f.attackerStrength,4);assert.equal(f.defenderStrength,4);
});
test('раздача, отсутствие повторов, воспроизводимость',()=>{
  const a=game(303);const b=game(303);
  assert.deepEqual(a,b);assert.equal(a.deck.length,38);
  assert.equal(a.players[0].hand.length,5);assertInvariants(a,catalog);
});
test('запрет повтора ученика, некорректных целей и карт',()=>{
  assert.throws(()=>game(1,[...setup,{id:'c',studentId:'sanko',kind:'bot',level:'master'}]));
  const s=game();assert.throws(()=>chooseTarget(s,'a','a'));
  assert.throws(()=>chooseTarget(s,'b','a'));
  assert.throws(()=>chooseAttack(s,'a','F12'));
});
test('победившая карта сохраняется, проигравшая уходит в сброс',()=>{
  const s=game();swapTo(s,'a','F12');swapTo(s,'b','E01');
  const r=fightOnce(s,'F12','E01');
  assert.equal(r.lastDuel.verdict,'attacker');assert.equal(r.discard.includes('E01'),true);
  assert.equal(r.players[0].hand.includes('F12'),true);
  assert.equal(r.players[1].hand.includes('E01'),false);
  assert.equal(r.publiclyKnown.a.includes('F12'),true);
  assertInvariants(r,catalog);
});
test('скрытая атакующая карта не раскрывается до фазы reveal; видимость в дуэлях ботов',()=>{
  const players=[{id:'a',studentId:'ratsha',kind:'bot',level:'master'},{id:'b',studentId:'sanko',kind:'bot',level:'master'}];
  let s=game(77,players);swapTo(s,'a','F12');swapTo(s,'b','E01');
  s=chooseTarget(s,'a','b');s=chooseAttack(s,'a','F12');
  const defender=observe(s,catalog,'b');
  assert.equal(JSON.stringify(defender).includes('F12'),false);
  assert.equal(Object.hasOwn(defender,'deck'),false);
  assert.equal(Object.hasOwn(defender,'players')&&Object.hasOwn(defender.players[0],'hand'),false);
  s=chooseDefense(s,'b','E01');
  assert.deepEqual(observe(s,catalog,'a').pending.faceUp,{attackerCard:'F12',defenderCard:'E01'});
  s=revealDuel(s,catalog);
  assert.deepEqual(observe(s,catalog,'b').players.find(p=>p.id==='a').knownCards,['F12']);
});
test('поочерёдный добор: защищавшийся первым при одной карте в Колодце',()=>{
  let s=game();swapTo(s,'a','F12');swapTo(s,'b','E01');
  s.deck.length && s.discard.push(...s.deck.splice(0,s.deck.length-1));
  s=fightOnce(s,'F12','E01');
  assert.equal(s.deck.length,1);
  s=drawAfterDuel(s,catalog);
  assert.equal(s.players[1].hand.length,5);
  assert.equal(s.players[0].hand.length,5);
  assert.equal(s.lastDuel.draws.b,1);
  assert.equal(s.lastDuel.draws.a,undefined);
  assertInvariants(s,catalog);
});
test('добор при нехватке карт, пропуск заполненных рук',()=>{
  let s=game(7);swapTo(s,'a','F12');swapTo(s,'b','E01');
  s.deck.length && s.discard.push(...s.deck.splice(0,s.deck.length-1));
  s=fightOnce(s,'F12','E01');
  const d=drawAfterDuel(s,catalog);
  assert.equal(d.lastDuel.draws.b,1);
  assert.equal(d.lastDuel.draws.a,undefined);
});
test('память открытой карты очищается только после её сброса',()=>{
  let s=game();swapTo(s,'a','F12');swapTo(s,'b','E01');
  s=drawAfterDuel(fightOnce(s,'F12','E01'),catalog);
  assert.deepEqual(s.publiclyKnown.a,['F12']);
  // Следующий игрок b; сильная карта Воздуха нейтральна Огню, но выигрывает по числовой силе.
  swapTo(s,'b','A01');
  s=chooseTarget(s,'b','a');s=chooseAttack(s,'b','A01');s=chooseDefense(s,'a','F12');
  s=revealDuel(s,catalog);
  assert.equal(s.discard.includes('F12'),true);
  assert.equal(s.publiclyKnown.a.includes('F12'),false);
});
test('никто не добирает карты за чужую дуэль',()=>{
  const players=[...setup,{id:'c',studentId:'yarko',kind:'bot',level:'student'}];
  let s=game(55,players);const before=s.players[2].hand.slice();
  const a=s.players[0].hand[0],b=s.players[1].hand[0];
  s=drawAfterDuel(fightOnce(s,a,b),catalog);
  assert.deepEqual(s.players[2].hand,before);
});
test('одновременная потеря последних карт — ничья без победителя',()=>{
  let s=game(15,[{id:'a',studentId:'yarko',kind:'human'},{id:'b',studentId:'barnard',kind:'bot',level:'novice'}]);
  swapTo(s,'a','F08');swapTo(s,'b','A08');
  for(const p of s.players)s.discard.push(...p.hand.splice(1));
  s.discard.push(...s.deck.splice(0));
  s=fightOnce(s,'F08','A08');
  assert.equal(s.lastDuel.verdict,'tie');
  s=drawAfterDuel(s,catalog);
  assert.equal(s.phase,'gameOver');assert.equal(s.winnerId,null);
  assertInvariants(s,catalog);
});
test('все доступные наблюдения полностью исключают секреты карты противника и порядок колоды',()=>{
  let s=game(156,[{id:'a',studentId:'ratsha',kind:'bot',level:'master'},{id:'b',studentId:'sanko',kind:'bot',level:'master'}]);
  const obs=observe(s,catalog,'a');
  const swap=s.players[1].hand[0];s.players[1].hand[0]=s.deck[0];s.deck[0]=swap;
  assert.deepEqual(observe(s,catalog,'a'),obs);
  const v1=botChoose(obs,catalog,'master',new SeededRandom(17));
  const v2=botChoose(observe(s,catalog,'a'),catalog,'master',new SeededRandom(17));
  assert.deepEqual(v1,v2);
});
test('переход хода к следующему живому игроку после завершения боя',()=>{
  const s=game(101,[...setup,{id:'c',studentId:'yarko',kind:'bot',level:'novice'}]);
  const first=s.players[0].hand[0],second=s.players[1].hand[0];
  let t=chooseTarget(s,'a','b');t=chooseAttack(t,'a',first);t=chooseDefense(t,'b',second);
  t=revealDuel(t,catalog);
  t=drawAfterDuel(t,catalog);
  assert.equal(t.activeSeat,1);assert.equal(t.phase,'target');
});
test('проверка неизменяемости: ввод действия не мутирует исходное состояние',()=>{
  const s=game(300);const saved=structuredClone(s);
  const t=chooseTarget(s,'a','b');
  assert.deepEqual(s,saved);assert.notEqual(t,s);
  const p=chooseAttack(t,'a',t.players[0].hand[0]);
  assert.deepEqual(s,saved);assert.equal(t.phase,'attack');assert.equal(p.phase,'defense');
});
test('перед последним добором обе руки обновляются по очереди, без превышения пяти',()=>{
  let s=game();swapTo(s,'a','F08');swapTo(s,'b','A08');
  s.deck.length&&s.discard.push(...s.deck.splice(0,s.deck.length-3));
  s=fightOnce(s,'F08','A08');
  assert.equal(s.lastDuel.verdict,'attacker'); // Огонь 3×2 против Воздуха 3, стихии нейтральны
  s=drawAfterDuel(s,catalog);
  assert.equal(s.lastDuel.draws.b,1);
  assert.equal(s.deck.length,2);
});
test('после чужого поединка человек видит открытые карты ботов в истории',()=>{
  const p=[{id:'a',studentId:'ratsha',kind:'bot',level:'novice'},{id:'b',studentId:'sanko',kind:'bot',level:'novice'},{id:'c',studentId:'oleshka',kind:'human'}];
  let s=game(201,p);swapTo(s,'a','F12');swapTo(s,'b','E01');
  s=fightOnce(s,'F12','E01');const obs=observe(s,catalog,'c');
  assert.equal(obs.lastDuel.attackerCard,'F12');assert.equal(obs.lastDuel.defenderCard,'E01');
  assert.deepEqual(obs.players.find(x=>x.id==='a').knownCards,['F12']);
});
test('выбывшие участники пропускаются и не атакуют',()=>{
  const s=game(55,[...setup,{id:'c',studentId:'oleshka',kind:'bot',level:'novice'}]);
  const next=s.players[1];s.discard.push(...next.hand.splice(0));
  next.eliminated=true;
  s.deck.length&&s.discard.push(...s.deck.splice(0)); // Нет добора
  // Два оставшихся игрока имеют по пять карт, нужно провести допустимую дуэль с c.
  const t=chooseTarget(s,'a','c');const t1=chooseAttack(t,'a',s.players[0].hand[0]);
  let t2=chooseDefense(t1,'c',s.players[2].hand[0]);
  t2=revealDuel(t2,catalog);t2=drawAfterDuel(t2,catalog);
  assert.equal(t2.activeSeat,2);
  assert.equal(t2.players[1].eliminated,true);
});
