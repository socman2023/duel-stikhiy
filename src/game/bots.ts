import {fight} from './rules.js';
import {spell,hero} from './catalog.js';
import {SeededRandom} from './random.js';
import type {Catalog,CardId,Element,Level,Observation,PlayerId,Verdict,VisiblePlayer} from './types.js';

export interface BotAction { targetId?:PlayerId; cardId?:CardId; }
/** Вход политики — только Observation: закрытые чужие руки и колода не передаются. */
function candidateCards(c:Catalog,o:Observation,target:VisiblePlayer):Array<{id:string;weight:number}> {
  const allIds=c.cards.map(x=>x.id);
  const knownAcross=o.players.flatMap(p=>p.knownCards);
  const unseen=allIds.filter(x=>!o.ownHand.includes(x)&&!o.discard.includes(x)&&!knownAcross.includes(x));
  const unknownCount=Math.max(0,target.handCount-target.knownCards.length);
  const entries=target.knownCards.map(id=>({id,weight:1}));
  if(unknownCount>0&&unseen.length>0)entries.push(...unseen.map(id=>({id,weight:unknownCount/unseen.length})));
  return entries;
}
function estimatedScore(c:Catalog,o:Observation,card:CardId,target:VisiblePlayer,level:Level):number {
  const me=o.players.find(p=>p.id===o.observerId)!;
  const choices=candidateCards(c,o,target);
  if(choices.length===0)return 0;
  let w=0,win=0,lose=0,tie=0;
  for(const enemy of choices) {
    const f=o.pending?.defenderId===o.observerId
      ?fight(c,target.studentId,me.studentId,enemy.id,card)
      :fight(c,me.studentId,target.studentId,card,enemy.id);
    const result:Verdict=o.pending?.defenderId===o.observerId?
      f.verdict==='attacker'?'defender':f.verdict==='defender'?'attacker':'tie':f.verdict;
    w+=enemy.weight;
    if(result==='attacker')win+=enemy.weight;
    else if(result==='defender')lose+=enemy.weight;
    else tie+=enemy.weight;
  }
  const chanceWin=win/w,chanceLose=lose/w,chanceTie=tie/w;
  const mine=spell(c,card);
  const personal=(mine.element===me.element)?mine.power*2:mine.power;
  const conservation=(o.deckCount>0 ? 0.13 : 0.21)*(personal/12);
  // Очки без подглядывания: ожидаемая потеря карт противника минус риск потерять собственную.
  let score=chanceWin*1.0-chanceLose*1.0-chanceTie*0.28;
  if(level==='student')return score-conservation;
  // Мастер: учитывает риск потери последней карты, конец колоды и известную карту цели.
  const late=o.deckCount===0 || me.handCount<=2;
  score=(chanceWin*(late?1.45:1.08))-(chanceLose*(late?1.6:1.13))-(chanceTie*(late?0.7:0.35));
  score-=conservation*(late?0.10:1.55);
  score+=chanceWin*(target.handCount<=2?0.28:0);
  score-=chanceLose*(me.handCount<=2?0.35:0);
  return score;
}
export function botChoose(input:Observation,c:Catalog,level:Level,rng:SeededRandom):BotAction {
  // Ученик использует только заметные высокие раскрытые заклинания;
  // Мастер анализирует все публично известные карты.
  const o = level==='student' ? { ...input, players:input.players.map(p=>({...p,knownCards:p.knownCards.filter(id=>spell(c,id).power>=5)})) } : input;
  const me=o.players.find(x=>x.id===o.observerId);
  if(!me || me.kind!=='bot')throw new Error('Политика запускается только ботом');
  const isActor=o.phase==='target'&&o.activePlayerId===me.id;
  if(isActor){
    const choices=o.players.filter(x=>x.id!==me.id&&!x.eliminated&&x.handCount>0);
    if(!choices.length)throw new Error('Нет цели');
    if(level==='novice')return{targetId:rng.pick(choices).id};
    let best=Number.NEGATIVE_INFINITY;const scores:VisiblePlayer[]=[];
    for(const p of choices) {
      let peak=-Infinity;
      const list=(level==='master' && o.deckCount>3) ? o.ownHand.filter(id=>spell(c,id).power===Math.min(...o.ownHand.map(k=>spell(c,k).power))) : o.ownHand;
      for(const myCard of list) peak=Math.max(peak,estimatedScore(c,o,myCard,p,level));
      const threat=level==='master'?0.08*p.handCount/5:0;
      const weak=level==='master'?(p.handCount<3?0.16:0):0;
      const result=peak+threat+weak;
      if(result>best+1e-9){best=result;scores.length=0;scores.push(p)}
      else if(Math.abs(result-best)<1e-9)scores.push(p);
    }
    return{targetId:rng.pick(scores).id};
  }
  const choosingCard=(o.phase==='attack'&&o.pending?.attackerId===me.id)||(o.phase==='defense'&&o.pending?.defenderId===me.id);
  if(!choosingCard)throw new Error('Бот не должен действовать в этой фазе');
  if(level==='novice')return{cardId:rng.pick(o.ownHand)};
  // Ученик ещё ошибается: не всякий ход — оптимальный.
  if(level==='student' && rng.next()<0.30)return{cardId:rng.pick(o.ownHand)};
  // Пока Колодец знаний полон, попытка выиграть каждый бой сильнейшей картой
  // истощает собственную руку хуже, чем обмен слабых заклинаний на новые.
  if(o.deckCount>3) {
    const minPower=Math.min(...o.ownHand.map(id=>spell(c,id).power));
    const sacrificial=o.ownHand.filter(id=>spell(c,id).power===minPower);
    if(level==='student')return {cardId:rng.pick(sacrificial)};
    // Выбрасываем дешёвые карты до опустошения колодца, но из равных
    // предпочтём наиболее перспективную против конкретной цели: это не
    // требует доступа к скрытым рукам.
    const targetId=o.pending!.attackerId===me.id?o.pending!.defenderId:o.pending!.attackerId;
    const target=o.players.find(x=>x.id===targetId)!;
    const valuations=sacrificial.map(id=>({id,score:estimatedScore(c,o,id,target,'master')}));
    const maximum=Math.max(...valuations.map(v=>v.score));
    return {cardId:rng.pick(valuations.filter(v=>Math.abs(v.score-maximum)<1e-9).map(v=>v.id))};
  }
  const targetId=o.pending!.attackerId===me.id?o.pending!.defenderId:o.pending!.attackerId;
  const target=o.players.find(x=>x.id===targetId)!;
  let best=Number.NEGATIVE_INFINITY;const bestCards:CardId[]=[];
  for(const id of o.ownHand) {
    const val=estimatedScore(c,o,id,target,level);
    if(val>best+1e-9){best=val;bestCards.length=0;bestCards.push(id)}
    else if(Math.abs(val-best)<1e-9)bestCards.push(id);
  }
  return{cardId:rng.pick(bestCards)};
}
