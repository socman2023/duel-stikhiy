import type {Duel, PlayerId} from './types.js';

export interface DuelScore {wins:number;losses:number;ties:number}
/** Статистика считается из журнала, а не из текущей руки и не из статуса выбывания. */
export function duelStats(duels:readonly Duel[],playerIds:readonly PlayerId[]):Record<PlayerId,DuelScore>{
  const out:Record<PlayerId,DuelScore>=Object.fromEntries(playerIds.map(id=>[id,{wins:0,losses:0,ties:0}]));
  for(const duel of duels){
    const a=out[duel.attackerId],d=out[duel.defenderId];
    if(!a||!d)throw new Error('В журнале поединок с неизвестным участником');
    if(duel.verdict==='tie'){a.ties++;d.ties++}
    else if(duel.verdict==='attacker'){a.wins++;d.losses++}
    else {d.wins++;a.losses++}
  }
  return out;
}
