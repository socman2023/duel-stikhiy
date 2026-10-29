import {spell, hero} from './catalog.js';
import type {Catalog, CardId, Element, RuleBasis, Verdict} from './types.js';

export const beats: Readonly<Record<Element,Element>>={fire:'earth',earth:'air',air:'water',water:'fire'};
export function beatsElement(a: Element,b:Element): boolean {return beats[a]===b;}
export interface FightResult {verdict: Verdict; basis:RuleBasis; attackerStrength:number; defenderStrength:number;}
export function fight(c:Catalog, attackerHeroId:string, defenderHeroId:string, attackerCard:CardId, defenderCard:CardId):FightResult {
  const a=spell(c,attackerCard),d=spell(c,defenderCard);
  const attackerStrength=a.power*(a.element===hero(c,attackerHeroId).element?2:1);
  const defenderStrength=d.power*(d.element===hero(c,defenderHeroId).element?2:1);
  if(beatsElement(a.element,d.element)) return{verdict:'attacker',basis:'element',attackerStrength,defenderStrength};
  if(beatsElement(d.element,a.element)) return{verdict:'defender',basis:'element',attackerStrength,defenderStrength};
  return {verdict:attackerStrength>defenderStrength?'attacker':attackerStrength<defenderStrength?'defender':'tie', basis:'power',attackerStrength,defenderStrength};
}
