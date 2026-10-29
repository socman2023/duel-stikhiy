import { hero, validateCatalog } from './catalog.js';
import { SeededRandom } from './random.js';
import { fight } from './rules.js';
import type { Catalog, CardId, Duel, GameState, Observation, Pending, PlayerId, PlayerSetup, PlayerState, VisiblePlayer } from './types.js';

function clone(s:GameState):GameState {
  return {...s,players:s.players.map(p=>({...p,hand:[...p.hand]})),deck:[...s.deck],discard:[...s.discard],
    pending:s.pending?{...s.pending}:null,
    lastDuel:s.lastDuel?{...s.lastDuel,discarded:[...s.lastDuel.discarded],draws:{...s.lastDuel.draws}}:null,
    history:s.history.map(x=>({...x,discarded:[...x.discarded],draws:{...x.draws}})),
    publiclyKnown:Object.fromEntries(Object.entries(s.publiclyKnown).map(([k,v])=>[k,[...v]]))};
}
function lookup(s: GameState,id:PlayerId):PlayerState {
  const p=s.players.find(x=>x.id===id);
  if(!p) throw new Error(`Нет игрока ${id}`);
  return p;
}
function requirePhase(s:GameState,phase:GameState['phase']):void {if(s.phase!==phase) throw new Error(`Неверная фаза: ожидалась ${phase}, сейчас ${s.phase}`);}
function containsCard(s:GameState,id:PlayerId,card:CardId):void {if(!lookup(s,id).hand.includes(card))throw new Error(`У ${id} нет выбранной карты`);}
function nextLiveSeat(s:GameState):number {
  for(let d=1;d<s.players.length;d++) {
    const index=(s.activeSeat+d)%s.players.length;
    if(!s.players[index]!.eliminated) return index;
  }
  throw new Error('Следующий ход невозможен без активного противника');
}
export function createGame(c:Catalog,setup:readonly PlayerSetup[],seed:number,firstSeat?:number):GameState {
  validateCatalog(c);
  if(setup.length<2||setup.length>6) throw new Error('Количество игроков должно быть 2–6');
  if(new Set(setup.map(x=>x.id)).size!==setup.length) throw new Error('Идентификатор игрока должен быть уникальным');
  if(new Set(setup.map(x=>x.studentId)).size!==setup.length) throw new Error('Ученик не может повторяться');
  if(setup.some(x=>x.kind==='bot' && !x.level)) throw new Error('Боту нужен уровень');
  const random=new SeededRandom(seed);
  const deck=random.shuffle(c.cards.map(x=>x.id));
  const players:PlayerState[]=setup.map(x=>({...x,hand:[],eliminated:false}));
  // Раздача по одной карте в порядке мест; колода извлекается с конца.
  for(let n=0;n<5;n++)for(const p of players)p.hand.push(deck.pop()!);
  const seat=firstSeat??random.index(players.length);
  if(!Number.isInteger(seat)||seat<0||seat>=players.length)throw new Error('Неверное место первого игрока');
  const game:GameState={phase:'target',players,deck,discard:[],activeSeat:seat,pending:null,lastDuel:null,history:[],
    publiclyKnown:Object.fromEntries(players.map(x=>[x.id,[]])),winnerId:null,rounds:0,seed};
  assertInvariants(game,c);
  return game;
}
export function activePlayer(s:GameState):PlayerState {return s.players[s.activeSeat]!;}
export function chooseTarget(s:GameState,attackerId:PlayerId,defenderId:PlayerId):GameState {
  requirePhase(s,'target');
  if(activePlayer(s).id!==attackerId)throw new Error('Сейчас ход другого участника');
  const attacker=lookup(s,attackerId),defender=lookup(s,defenderId);
  if(attacker.eliminated||defender.eliminated||!attacker.hand.length||!defender.hand.length||attackerId===defenderId)
    throw new Error('Недопустимая цель');
  const n=clone(s);n.pending={attackerId,defenderId};n.phase='attack';return n;
}
export function chooseAttack(s:GameState,attackerId:PlayerId,cardId:CardId):GameState {
  requirePhase(s,'attack');
  if(s.pending?.attackerId!==attackerId)throw new Error('Недопустимый атакующий');
  containsCard(s,attackerId,cardId);
  const n=clone(s);n.pending!.attackerCard=cardId;n.phase='defense';return n;
}
export function chooseDefense(s:GameState,defenderId:PlayerId,cardId:CardId):GameState {
  requirePhase(s,'defense');
  if(s.pending?.defenderId!==defenderId)throw new Error('Недопустимый защищающийся');
  containsCard(s,defenderId,cardId);
  const n=clone(s);n.pending!.defenderCard=cardId;n.phase='reveal';return n;
}
export function revealDuel(s:GameState,c:Catalog):GameState {
  requirePhase(s,'reveal');
  const b=s.pending;
  if(!b?.attackerCard||!b.defenderCard)throw new Error('Не выбраны обе карты');
  const n=clone(s),attacker=lookup(n,b.attackerId),defender=lookup(n,b.defenderId);
  const f=fight(c,attacker.studentId,defender.studentId,b.attackerCard,b.defenderCard);
  const discarded:CardId[]=[];
  if(f.verdict!=='attacker') discarded.push(b.attackerCard);
  if(f.verdict!=='defender') discarded.push(b.defenderCard);
  for(const [p,id] of [[attacker,b.attackerCard],[defender,b.defenderCard]] as const) {
    if(discarded.includes(id)) {
      p.hand=p.hand.filter(x=>x!==id);
      n.publiclyKnown[p.id]=n.publiclyKnown[p.id]!.filter(x=>x!==id);
    } else if(!n.publiclyKnown[p.id]!.includes(id))n.publiclyKnown[p.id]!.push(id);
  }
  n.discard.push(...discarded);
  const record:Duel={index:n.rounds+1,attackerId:b.attackerId,defenderId:b.defenderId,attackerCard:b.attackerCard,defenderCard:b.defenderCard,
    verdict:f.verdict,basis:f.basis,attackerStrength:f.attackerStrength,defenderStrength:f.defenderStrength,discarded,draws:{}};
  n.rounds++;
  n.lastDuel=record;
  n.history.push(record);
  n.phase='draw';
  assertInvariants(n,c);
  return n;
}
export function drawAfterDuel(s:GameState,c:Catalog):GameState {
  requirePhase(s,'draw');
  if(!s.pending||!s.lastDuel)throw new Error('Нет предыдущего поединка');
  const n=clone(s);
  const {defenderId,attackerId}=n.pending!;
  // Следующий ход защищавшегося всегда раньше следующего хода атакующего.
  // Порядок: защищавшийся, атакующий, затем снова защищавшийся.
  const order=[lookup(n,defenderId),lookup(n,attackerId)];
  while(n.deck.length>0 && order.some(p=>p.hand.length<5)) {
    for(const p of order) {
      if(!n.deck.length)break;
      if(p.hand.length<5) {
        p.hand.push(n.deck.pop()!);
        n.lastDuel!.draws[p.id]=(n.lastDuel!.draws[p.id]??0)+1;
      }
    }
  }
  n.history[n.history.length-1]={...n.lastDuel!,discarded:[...n.lastDuel!.discarded],draws:{...n.lastDuel!.draws}};
  for(const p of n.players)p.eliminated=p.hand.length===0;
  const survivors=n.players.filter(p=>!p.eliminated);
  n.pending=null;
  if(survivors.length<=1) {
    n.phase='gameOver';n.winnerId=survivors[0]?.id??null;
  } else {
    n.activeSeat=nextLiveSeat(n);
    n.phase='target';
  }
  assertInvariants(n,c);
  return n;
}
export function observe(s:GameState,c:Catalog,observerId:PlayerId):Observation {
  const self=lookup(s,observerId);
  const players:VisiblePlayer[]=s.players.map(p=>({id:p.id,studentId:p.studentId,kind:p.kind,level:p.level,
    element:hero(c,p.studentId).element,handCount:p.hand.length,eliminated:p.eliminated,knownCards:[...s.publiclyKnown[p.id]!]}));
  const pending=s.pending?{attackerId:s.pending.attackerId,defenderId:s.pending.defenderId,
    ...(s.phase==='reveal' && s.pending.attackerCard && s.pending.defenderCard?{faceUp:{attackerCard:s.pending.attackerCard,defenderCard:s.pending.defenderCard}}:{})}:null;
  return {observerId,phase:s.phase,ownHand:[...self.hand],players,deckCount:s.deck.length,discard:[...s.discard],
    activePlayerId:activePlayer(s).id,pending,history:s.history.map(x=>({...x,discarded:[...x.discarded],draws:{...x.draws}})),
    lastDuel:s.lastDuel?{...s.lastDuel,discarded:[...s.lastDuel.discarded],draws:{...s.lastDuel.draws}}:null,
    winnerId:s.winnerId,rounds:s.rounds};
}
export function assertInvariants(s:GameState,c:Catalog):void {
  const all=[...s.deck,...s.discard,...s.players.flatMap(p=>p.hand)];
  if(all.length!==48||new Set(all).size!==48 ||all.some(x=>!c.cards.some(k=>k.id===x)))throw new Error('Нарушена сохранность 48 карт');
  if(s.players.some(p=>p.hand.length>5||p.hand.length<0))throw new Error('Некорректный размер руки');
  if(!Number.isInteger(s.activeSeat)||s.activeSeat<0||s.activeSeat>=s.players.length)throw new Error('Некорректное место хода');
  for(const p of s.players) {
    const known=s.publiclyKnown[p.id];
    if(!known||new Set(known).size!==known.length||known.some(id=>!p.hand.includes(id)))throw new Error('Публичная память содержит несуществующую карту');
  }
  if(s.rounds!==s.history.length||s.rounds>48)throw new Error('Некорректное число дуэлей');
  if(s.phase==='gameOver') {
    const a=s.players.filter(p=>!p.eliminated);
    if(a.length>1||s.winnerId!==(a[0]?.id??null))throw new Error('Некорректный итог партии');
  }
}
