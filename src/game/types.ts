export type Element = 'fire' | 'water' | 'air' | 'earth';
export type CardId = string;
export type PlayerId = string;
export type Phase = 'target' | 'attack' | 'defense' | 'reveal' | 'draw' | 'gameOver';
export type Level = 'novice' | 'student' | 'master';

export interface Spell { readonly id: CardId; readonly name: string; readonly element: Element; readonly power: number; readonly image: string; }
export interface Hero { readonly id: string; readonly name: string; readonly element: Element; readonly image: string; }
export interface Catalog { readonly cards: readonly Spell[]; readonly students: readonly Hero[]; }
export interface PlayerSetup { id: PlayerId; studentId: string; kind: 'human' | 'bot'; level?: Level; }
export interface PlayerState { id: PlayerId; studentId: string; kind: 'human' | 'bot'; level?: Level; hand: CardId[]; eliminated: boolean; }
export interface Pending { attackerId: PlayerId; defenderId: PlayerId; attackerCard?: CardId; defenderCard?: CardId; }
export type Verdict = 'attacker' | 'defender' | 'tie';
export type RuleBasis = 'element' | 'power';
export interface Duel {
  index: number;
  attackerId: PlayerId; defenderId: PlayerId;
  attackerCard: CardId; defenderCard: CardId;
  verdict: Verdict; basis: RuleBasis;
  attackerStrength: number; defenderStrength: number;
  discarded: CardId[];
  draws: Record<PlayerId, number>;
}
export interface GameState {
  phase: Phase;
  players: PlayerState[];
  deck: CardId[];
  discard: CardId[];
  activeSeat: number;
  pending: Pending | null;
  lastDuel: Duel | null;
  history: Duel[];
  publiclyKnown: Record<PlayerId, CardId[]>;
  winnerId: PlayerId | null;
  rounds: number;
  seed: number;
}
export interface VisiblePlayer {
  id: PlayerId;
  studentId: string;
  kind: 'human' | 'bot';
  level?: Level;
  element: Element;
  handCount: number;
  eliminated: boolean;
  knownCards: CardId[];
}
export interface Observation {
  phase: Phase;
  observerId: PlayerId;
  ownHand: CardId[];
  players: VisiblePlayer[];
  deckCount: number;
  discard: CardId[];
  activePlayerId: PlayerId;
  pending: { attackerId: PlayerId; defenderId: PlayerId; faceUp?: { attackerCard: CardId; defenderCard: CardId } } | null;
  history: Duel[];
  lastDuel: Duel | null;
  winnerId: PlayerId | null;
  rounds: number;
}
