import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import manifest from './game/manifest.json';
import {activePlayer, chooseAttack, chooseDefense, chooseTarget, createGame, drawAfterDuel, observe, revealDuel} from './game/engine';
import {botChoose} from './game/bots';
import {hero, spell, catalogFromManifest} from './game/catalog';
import {SeededRandom} from './game/random';
import {duelStats} from './game/stats';
import type {CardId, Catalog, Duel, Element, GameState, Hero, Level, PlayerSetup, PlayerState, Spell} from './game/types';

const catalog: Catalog=catalogFromManifest(manifest);
const icons:Record<Element,string>={fire:'🔥',water:'💧',air:'🌬',earth:'⛰'};
const elNames:Record<Element,string>={fire:'Огонь',water:'Вода',air:'Воздух',earth:'Земля'};
const levelNames:Record<Level,string>={novice:'Новичок',student:'Ученик',master:'Мастер'};
const asset=(path:string)=>`${import.meta.env.BASE_URL}art/${path}`;
const fullCard=(c:Spell)=>asset(c.image);
const shortCard=(c:Spell)=>asset(`spells/${c.id}_thumb.webp`);
const heroImage=(h:Hero)=>asset(h.image);
const heroThumb=(h:Hero)=>asset(`heroes/${h.image.split('/').at(-1)!.replace('.webp','_thumb.webp')}`);
const heroOf=(p:PlayerState)=>hero(catalog,p.studentId);

type Screen='home'|'hero'|'setup'|'battle'|'result';
type Panel='rules'|'history'|'elements'|'leave'|null;

function chooseOpponents(human:Hero,num:number,nonce:number):Hero[]{
  const rng=new SeededRandom(nonce||1);
  const sorted=[...catalog.students.filter(h=>h.id!==human.id)];
  const distinct:Hero[]=[];
  // Подбираем разные стихии; не выдаём боту скрытых бонусов.
  for(const elem of rng.shuffle((['fire','earth','water','air'] as Element[]).filter(x=>x!==human.element))){
    const match=rng.pick(sorted.filter(h=>h.element===elem));distinct.push(match);
  }
  return distinct.slice(0,num);
}
function explanation(d:Duel):string {
  const a=spell(catalog,d.attackerCard),b=spell(catalog,d.defenderCard);
  if(d.basis==='element'){
    const winning=d.verdict==='attacker'?a:b;
    const losing=d.verdict==='attacker'?b:a;
    return `${elNames[winning.element]} побеждает ${elNames[losing.element]} по Кругу стихий — сила не сравнивается.`;
  }
  const relation=a.element===b.element?'Одна стихия':'Нейтральные стихии';
  return `${relation}: сравниваем итоговую силу ${d.attackerStrength} и ${d.defenderStrength}.`;
}
function outcomeLabel(d:Duel){return d.verdict==='tie'?'Ничья':d.verdict==='attacker'?'Победил атакующий':'Победил защищающийся';}

function SmallEmblem({element}:{element:Element}){return <span className={`emblem emblem-${element}`} aria-label={elNames[element]} title={elNames[element]}>{icons[element]}</span>}
function SpellCard({cardId, selected=false, small=false, onClick, disabled=false, open=true, label}:{cardId?:CardId; selected?:boolean;small?:boolean;onClick?:()=>void;disabled?:boolean;open?:boolean;label?:string}){
  if(!open||!cardId)return <div className={`spell-card card-back ${small?'small-card':''}`} aria-label="Закрытая карта"><img src={asset('ui/card_back.webp')} alt="Рубашка заклинания"/></div>;
  const c=spell(catalog,cardId);
  const inner=<><img src={small?shortCard(c):fullCard(c)} alt="" loading="lazy"/><div className="card-vignette"/><div className="card-top"><SmallEmblem element={c.element}/><strong className="strength">{c.power}</strong></div><div className="card-bottom">{c.name}</div></>;
  if(onClick)return <button type="button" disabled={disabled} className={`spell-card clickable ${small?'small-card':''} ${selected?'selected':''}`} aria-pressed={selected} onClick={onClick} title={`${c.name}, ${elNames[c.element]}, сила ${c.power}`} aria-label={`Выбрать ${c.name}, ${elNames[c.element]}, сила ${c.power}`}>{inner}</button>;
  return <div className={`spell-card ${small?'small-card':''}`} title={`${c.name}, сила ${c.power}`} aria-label={label??`${c.name}, сила ${c.power}`}>{inner}</div>;
}
function PlayerBadge({player, active, selected, playable=false, onClick}:{player:PlayerState;active:boolean;selected?:boolean;playable?:boolean;onClick?:()=>void}){
 const h=heroOf(player);
 const content=<><div className="player-portrait"><img src={heroThumb(h)} alt=""/></div><span className="player-info"><strong>{h.name}</strong><span><SmallEmblem element={h.element}/> {elNames[h.element]} · {player.hand.length} карт{player.hand.length===1?'а':player.hand.length>=2&&player.hand.length<=4?'ы':''}</span></span>{active&&<span className="turn-marker">Ход</span>}{player.eliminated&&<span className="out-label">Выбыл</span>}</>;
 if(playable)return <button type="button" className={`player-badge playable ${selected?'chosen':''} ${active?'active':''}`} onClick={onClick} disabled={!onClick||player.eliminated}>{content}</button>;
 return <div className={`player-badge ${active?'active':''} ${player.eliminated?'eliminated':''}`}>{content}</div>;
}
function ElementRing({compact=false}:{compact?:boolean}){
 const flow:Element[]=['fire','earth','air','water'];
 return <div className={`ring ${compact?'ring-compact':''}`}>
   {flow.map((e,i)=><div key={e} className={`ring-step ring-${e}`}><span>{icons[e]}</span><strong>{elNames[e]}</strong>{i<3&&<b aria-hidden="true">→</b>}</div>)}
   <div className="ring-end">↺</div>
 </div>;
}
function Dialog({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Закрыть" type="button" onClick={onClose}>✕</button></header>{children}</section></div>;
}
function DuelDisplay({game}:{game:GameState}){
 const d=game.lastDuel;
 if(!d)return null;
 const attacker=game.players.find(p=>p.id===d.attackerId)!,defender=game.players.find(p=>p.id===d.defenderId)!;
 const winnerId=d.verdict==='attacker'?d.attackerId:d.verdict==='defender'?d.defenderId:null;
 return <div className="duel-result" key={d.index}>
   <div className="eyebrow">Поединок №{d.index}</div>
   <div className="duel-pair">
      <div className={`duel-side ${winnerId===attacker.id?'victorious':''}`}><div className="duel-label">{heroOf(attacker).name}<span>Атака</span></div><SpellCard cardId={d.attackerCard}/><span className="duel-strength">Сила {d.attackerStrength}</span></div>
      <div className="versus"><b>VS</b><span>⚔</span></div>
      <div className={`duel-side ${winnerId===defender.id?'victorious':''}`}><div className="duel-label">{heroOf(defender).name}<span>Защита</span></div><SpellCard cardId={d.defenderCard}/><span className="duel-strength">Сила {d.defenderStrength}</span></div>
   </div>
   <div className={`verdict ${d.verdict==='tie'?'tie':''}`}><strong>{d.verdict==='tie'?'Ничья!':`${heroOf(game.players.find(p=>p.id===winnerId)!).name} побеждает!`}</strong><span>{explanation(d)}</span><small>{d.verdict==='tie'?'Обе карты уходят в сброс.':'Победившая карта остаётся у владельца, проигравшая уходит в сброс.'}</small></div>
 </div>;
}

export default function App(){
 const [screen,setScreen]=useState<Screen>('home');
 const [heroId,setHeroId]=useState('oleshka');
 const [botCount,setBotCount]=useState(3);
 const [level,setLevel]=useState<Level>('student');
 const [nonce,setNonce]=useState(71092);
 const [game,setGame]=useState<GameState|null>(null);
 const [panel,setPanel]=useState<Panel>(null);
 const [selectedCard,setSelectedCard]=useState<CardId|null>(null);
 const [speed,setSpeed]=useState<'normal'|'fast'>('normal');
 const [notice,setNotice]=useState('');
 const botRngs=useRef<Map<string,SeededRandom>>(new Map());
 const chosenHero=hero(catalog,heroId);
 const opponents=useMemo(()=>chooseOpponents(chosenHero,botCount,nonce),[chosenHero,botCount,nonce]);
 const human=game?.players.find(p=>p.kind==='human')??null;
 const active=game?activePlayer(game):null;
 const activeHuman=active?.kind==='human';
 const participantId=game?.pending?(game.phase==='attack'?game.pending.attackerId:game.pending.defenderId):null;
 const humanCardAction=game&&((game.phase==='attack'&&participantId==='you')||(game.phase==='defense'&&participantId==='you'));
 const needTarget=game?.phase==='target'&&activeHuman;
 const currentPhase=game?.phase;
 const liveStats=useMemo(()=>duelStats(game?.history??[],game?.players.map(p=>p.id)??[]),[game]);

 const startGame=useCallback(()=>{
   const seed=(Date.now()&0xffffffff)>>>0;
   const setup:PlayerSetup[]=[{id:'you',studentId:heroId,kind:'human'},...opponents.map((h,i)=>({id:`bot-${i+1}`,studentId:h.id,kind:'bot' as const,level}))];
   const s=createGame(catalog,setup,seed);
   botRngs.current=new Map(opponents.map((_,i)=>[`bot-${i+1}`,new SeededRandom(seed+(i+1)*0x9e3779b1)]));
   setSelectedCard(null);setNotice('');setGame(s);setPanel(null);setScreen('battle');
 },[heroId,opponents,level]);

 const returnHome=()=>{setPanel(null);setSelectedCard(null);setGame(null);setScreen('home')};
 const confirmCard=()=>{
   if(!game||!selectedCard)return;
   try{
      if(game.phase==='attack'&&game.pending?.attackerId==='you')setGame(chooseAttack(game,'you',selectedCard));
      else if(game.phase==='defense'&&game.pending?.defenderId==='you')setGame(chooseDefense(game,'you',selectedCard));
      setSelectedCard(null);
   }catch(e){setNotice(e instanceof Error?e.message:'Не удалось сыграть карту')}
 };
 const selectTarget=(targetId:string)=>{
   if(!game||game.phase!=='target')return;
   try{setGame(chooseTarget(game,'you',targetId));setSelectedCard(null)}catch(e){setNotice(e instanceof Error?e.message:'Недопустимая цель')}
 };
 const backToTarget=()=>{
   if(!game||game.phase!=='attack'||game.pending?.attackerId!=='you'||game.pending.attackerCard)return;
   setGame({...game,phase:'target',pending:null});setSelectedCard(null);
 };
 const advanceAfterReveal=useCallback(()=>{
   setGame(prev=>{
      if(!prev||prev.phase!=='draw')return prev;
      return drawAfterDuel(prev,catalog);
   });
 },[]);

 // Контроллер ботов использует только ограниченное публичное наблюдение.
 useEffect(()=>{
   if(screen!=='battle'||!game||panel)return;
   if(game.phase==='gameOver'){
     const timer=window.setTimeout(()=>setScreen('result'),900);
     return()=>clearTimeout(timer);
   }
   if(game.phase==='reveal'){
     const timer=window.setTimeout(()=>setGame(s=>s?.phase==='reveal'?revealDuel(s,catalog):s),230);
     return()=>clearTimeout(timer);
   }
   // Результат дуэли остаётся видимым до осознанного действия человека.
   // Даже режим «Быстро» не подтверждает дуэль автоматически.
   if(game.phase==='draw')return;
   const actorId=game.phase==='target'?active?.id:game.phase==='attack'?game.pending?.attackerId:game.pending?.defenderId;
   const actor=game.players.find(p=>p.id===actorId);
   if(actor?.kind!=='bot')return;
   const timer=window.setTimeout(()=>{
     try{
       const rng=botRngs.current.get(actor.id);
       if(!rng)throw new Error('Не удалось найти генератор бота');
       const move=botChoose(observe(game,catalog,actor.id),catalog,actor.level??'novice',rng);
       setGame(prev=>{
         if(prev!==game)return prev;
         if(prev.phase==='target')return chooseTarget(prev,actor.id,move.targetId!);
         if(prev.phase==='attack')return chooseAttack(prev,actor.id,move.cardId!);
         if(prev.phase==='defense')return chooseDefense(prev,actor.id,move.cardId!);
         return prev;
       });
     }catch(e){setNotice(e instanceof Error?e.message:'Ошибка хода бота')}
   },speed==='fast'?220:600);
   return()=>clearTimeout(timer);
 },[game,screen,panel,speed,active,advanceAfterReveal]);

 const infoLabel=()=>{
  if(!game)return '';
  if(game.phase==='gameOver')return 'Поединки завершены';
  if(game.phase==='draw')return 'Карты раскрыты. Оцените исход дуэли.';
  if(game.phase==='reveal')return 'Раскрываем заклинания…';
  if(game.phase==='target')return activeHuman?'Твой ход: выбери соперника для атаки.':`${heroOf(active!).name} выбирает соперника…`;
  if(game.phase==='attack')return game.pending?.attackerId==='you'?'Выбери заклинание для атаки.':`${heroOf(game.players.find(p=>p.id===game.pending?.attackerId)!).name} выбирает заклинание…`;
  if(game.phase==='defense')return game.pending?.defenderId==='you'?`${heroOf(game.players.find(p=>p.id===game.pending?.attackerId)!).name} атакует тебя! Выбери защиту — атакующая карта скрыта.`:`${heroOf(game.players.find(p=>p.id===game.pending?.defenderId)!).name} выбирает защиту…`;
  return '';
 };
 const showResult=screen==='result'&&game;
 const inspect=selectedCard?spell(catalog,selectedCard):null;
 const playerHero=human?heroOf(human):chosenHero;

 return <div className="app-shell">
  <div className="grain" aria-hidden="true"/>
  <header className="site-header"><div className="brand" onClick={()=>{if(screen==='battle')setPanel('leave');else returnHome()}} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'){if(screen==='battle')setPanel('leave');else returnHome()}}}><div className="brand-symbol">✧</div><span><strong>ДУЭЛЬ СТИХИЙ</strong><small>Академия Светозара</small></span></div><div className="header-actions">{screen==='battle'?<><button className="header-button" onClick={()=>setPanel('rules')}>ⓘ <span>Правила</span></button><button className="header-button" onClick={()=>setPanel('leave')}>✕</button></>:<button className="header-button" onClick={()=>setPanel('rules')}>ⓘ Правила игры</button>}</div></header>

 {screen==='home'&&<main className="home-container"><div className="home-hero"><div className="intro-copy"><span className="eyebrow gold">КАРТОЧНАЯ ИГРА ПО МИРУ «КНЯЖИЧ»</span><h1>Стихии <em>сойдутся</em><br/>на арене</h1><p>Огонь против Земли, Воздух против Воды. Выбери ученика Академии, раскрой заклинания и останься последним в поединке.</p><div className="intro-actions"><button className="primary-button big" onClick={()=>setScreen('hero')}>Начать дуэль <span>↗</span></button><button className="secondary-button big" onClick={()=>setPanel('rules')}>Как играть</button></div><span className="subnote">Один игрок · 1–3 соперника · 4 стихии · 48 заклинаний</span></div><div className="hero-art" aria-hidden="true"><div className="hero-circle"/><div className="floating-spell left"><img src={asset('spells/F01.webp')} alt=""/></div><div className="floating-spell right"><img src={asset('spells/W01.webp')} alt=""/></div><div className="hero-center-icon">✦</div></div></div><div className="home-bottom"><span>Четыре стихии — одна победа</span><ElementRing compact/></div></main>}

 {screen==='hero'&&<main className="page-container"><div className="page-heading"><button className="text-back" onClick={()=>setScreen('home')}>← Назад</button><span className="eyebrow gold">ШАГ 1 ИЗ 2</span><h1>Выбери своего ученика</h1><p>Каждый герой владеет одной стихией особенно хорошо: его заклинания этой стихии получают удвоенную силу при сравнении.</p></div><div className="hero-grid">{catalog.students.map(h=><button type="button" key={h.id} className={`hero-choice ${heroId===h.id?'selected':''}`} onClick={()=>setHeroId(h.id)} aria-pressed={heroId===h.id}><img src={heroImage(h)} alt=""/><div className="hero-choice-caption"><strong>{h.name}</strong><span><SmallEmblem element={h.element}/>{elNames[h.element]}</span></div><div className="hero-check">✓</div></button>)}</div><div className="setup-footer"><span>Выбран: <strong>{chosenHero.name}</strong> · {elNames[chosenHero.element]}</span><button className="primary-button" onClick={()=>setScreen('setup')}>Продолжить →</button></div></main>}

 {screen==='setup'&&<main className="page-container narrow"><div className="page-heading"><button className="text-back" onClick={()=>setScreen('hero')}>← К выбору героя</button><span className="eyebrow gold">ШАГ 2 ИЗ 2</span><h1>Подготовка к дуэли</h1><p>Выбери, сколько учеников будут сражаться против тебя и насколько опытными окажутся соперники.</p></div><section className="settings-card"><div className="setting-group"><h3>Компьютерные соперники</h3><p>Рекомендуем три соперника — по одному на каждую из оставшихся стихий.</p><div className="segment">{[1,2,3].map(n=><button key={n} className={botCount===n?'current':''} onClick={()=>setBotCount(n)}>{n} {n===1?'бот':n===2?'бота':'бота'}</button>)}</div></div><div className="setting-group"><h3>Сложность</h3><div className="level-list">{(['novice','student','master'] as Level[]).map(l=><button className={`level-option ${level===l?'selected':''}`} key={l} onClick={()=>setLevel(l)}><span className="level-bullet">{level===l?'◉':'○'}</span><span><strong>{levelNames[l]}</strong><small>{l==='novice'?'Непредсказуемые ходы, без тактики':l==='student'?'Учитывает стихии и старается сберечь карты':'Помнит раскрытые карты и анализирует шансы'}</small></span></button>)}</div><p className="setting-note">Уровни «Ученик» и «Мастер» ещё настраиваются; честность закрытых карт соблюдается.</p></div><div className="setting-group"><div className="line-heading"><h3>Участники партии</h3><button className="tiny-button" onClick={()=>setNonce(n=>n+7919)}>↻ Перемешать</button></div><div className="lineup"><div><img src={heroThumb(chosenHero)} alt=""/><b>{chosenHero.name}</b><span>Ты</span></div>{opponents.map(h=><div key={h.id}><img src={heroThumb(h)} alt=""/><b>{h.name}</b><span>{elNames[h.element]}</span></div>)}</div></div><button className="primary-button big full" onClick={startGame}>На арену! ⚔</button></section></main>}

 {screen==='battle'&&game&&human&&<main className="battle-wrap">
  <div className="battle-topline"><div><span className="eyebrow gold">АРЕНА СТИХИЙ</span><span className="mini-subtitle">Поединок {game.phase==='draw'?game.rounds:game.rounds+1}</span></div><div className="battle-tools"><button className="tiny-button" onClick={()=>setSpeed(x=>x==='normal'?'fast':'normal')}>{speed==='fast'?'⏩ Быстро':'▶ Обычная скорость'}</button></div></div>
  <div className="game-layout"><section className="opponent-section"><h2>Соперники</h2><div className="opponents">{game.players.filter(p=>p.kind==='bot').map(p=><PlayerBadge key={p.id} player={p} active={p.id===active?.id} playable={!!needTarget&&!p.eliminated} onClick={needTarget?()=>selectTarget(p.id):undefined}/>)}</div><div className="opponent-hint">{needTarget?'Нажми на соперника, которого хочешь атаковать.':'Все дуэли видны каждому ученику, даже когда сражаются боты.'}</div>
  <div className="live-stats"><h3>Счёт дуэлей</h3><table aria-label="Текущая статистика дуэлей"><thead><tr><th scope="col">Ученик</th><th scope="col" title="Победы">П</th><th scope="col" title="Поражения">Пр</th><th scope="col" title="Ничьи">Н</th></tr></thead><tbody>{game.players.map(p=>{const st=liveStats[p.id];return <tr key={p.id} className={p.kind==='human'?'is-human':''}><th scope="row">{heroOf(p).name}{p.kind==='human'?' (ты)':''}</th><td title="Победы">{st?.wins??0}</td><td title="Поражения">{st?.losses??0}</td><td title="Ничьи">{st?.ties??0}</td></tr>})}</tbody></table><p>П — победы, Пр — поражения, Н — ничьи.</p></div></section>
  <section className="board-section"><div className="status-line"><span className={activeHuman?'status-icon your-turn':'status-icon'}>{activeHuman?'✦':'◈'}</span><span>{infoLabel()}</span></div><div className="board-table"><div className="table-top"><div className="deck-stack"><div className="deck-art"><img src={asset('ui/card_back.webp')} alt=""/></div><div><strong>{game.deck.length}</strong><small>Колодец знаний</small></div></div><div className="discard-status"><strong>{game.discard.length}</strong><small>В сбросе</small></div></div>
  {game.phase==='draw'&&game.lastDuel?<><DuelDisplay game={game}/><div className="draw-actions"><button className="primary-button" onClick={advanceAfterReveal}>Продолжить →</button><span>Карты останутся открытыми, пока не нажмёшь «Продолжить».</span></div></>:
  <div className="arena-wait"><div className="arena-seal">✧<span>⚔</span></div><h2>{needTarget?'Кого вызовешь на дуэль?':humanCardAction?'Выбери свою карту':game.phase==='reveal'?'Время раскрыть карты':'Дуэль готовится…'}</h2><p>{needTarget?'Нажми на портрет соперника выше.':humanCardAction?'Коснись заклинания в своей руке ниже и подтверди выбор.':game.phase==='defense'?'Защищающийся выбирает карту, не видя атакующей.':'Компьютерные противники делают свой ход.'}</p>{game.pending&&<div className="pending-duel"><div><strong>{heroOf(game.players.find(p=>p.id===game.pending?.attackerId)!).name}</strong><span>Атакует</span></div><span>⚔</span><div><strong>{heroOf(game.players.find(p=>p.id===game.pending?.defenderId)!).name}</strong><span>Защищается</span></div></div>}{inspect&&humanCardAction&&<div className="selected-description"><SmallEmblem element={inspect.element}/><strong>{inspect.name}</strong><span>Сила {inspect.power}{inspect.element===playerHero.element?' · твоя стихия ×2 при сравнении':''}</span></div>}</div>}
  </div><div className="bottom-board-actions"><button className="text-link" onClick={()=>setPanel('history')}>☷ История дуэлей ({game.history.length})</button><button className="text-link" onClick={()=>setPanel('elements')}>◉ Памятка стихий</button></div></section>
  </div>
  <section className="hand-section"><div className="hand-header"><div className="hand-owner"><img src={heroThumb(playerHero)} alt=""/><div><span>Твой ученик</span><strong>{playerHero.name} <SmallEmblem element={playerHero.element}/></strong></div></div><span className="hand-count">{human.hand.length} / 5 карт</span></div><div className="hand-body"><div className="hand-cards">{human.hand.map(id=><SpellCard key={id} cardId={id} onClick={humanCardAction?()=>setSelectedCard(id):undefined} disabled={!humanCardAction} selected={id===selectedCard}/>)}</div><div className="hand-action"><small>{human.eliminated?'Ты выбыл, но можешь досмотреть партию.':humanCardAction?'Выбери карту для '+(game.phase==='attack'?'атаки':'защиты'):'Жди своей очереди. Карты можно рассмотреть на игровом столе.'}</small>{humanCardAction&&<button className="primary-button" disabled={!selectedCard} onClick={confirmCard}>{game.phase==='attack'?'Атаковать ⚔':'Защититься 🛡'}</button>}{game.phase==='attack'&&game.pending?.attackerId==='you'&&<button className="text-link" onClick={backToTarget}>← Сменить цель</button>}</div></div></section>
  {notice&&<div className="notice" role="status" onClick={()=>setNotice('')}>{notice} ×</div>}
 </main>}

 {showResult&&<main className="result-page"><div className="result-card"><span className="eyebrow gold">ИСПЫТАНИЕ ЗАВЕРШЕНО</span><div className="result-emblem">{game.winnerId===null?'⚖':game.winnerId==='you'?'🏆':'⚔'}</div><h1>{game.winnerId===null?'Ничья!':game.winnerId==='you'?'Ты победил!':'Дуэль окончена'}</h1><p>{game.winnerId===null?'Ни у одного ученика не осталось заклинаний.':game.winnerId==='you'?'Ты остался последним учеником с заклинаниями.':`Победитель — ${heroOf(game.players.find(p=>p.id===game.winnerId)!).name}. В следующий раз удача может оказаться на твоей стороне.`}</p><div className="result-stats"><div><b>{game.rounds}</b><span>Поединков</span></div><div><b>{game.players.filter(p=>p.eliminated).length}</b><span>Выбыли</span></div><div><b>{game.winnerId?game.players.find(p=>p.id===game.winnerId)?.hand.length:0}</b><span>Карт у победителя</span></div></div><div className="result-duel-stats"><h2>Итог дуэлей</h2><table><thead><tr><th>Ученик</th><th>Победы</th><th>Поражения</th><th>Ничьи</th></tr></thead><tbody>{game.players.map(p=>{const st=liveStats[p.id];return <tr key={p.id}><th scope="row">{heroOf(p).name}{p.kind==='human'?' (ты)':''}</th><td>{st?.wins??0}</td><td>{st?.losses??0}</td><td>{st?.ties??0}</td></tr>})}</tbody></table></div><div className="result-buttons"><button className="primary-button big" onClick={startGame}>Сыграть ещё</button><button className="secondary-button big" onClick={()=>{setGame(null);setScreen('setup')}}>Изменить состав</button><button className="text-link" onClick={returnHome}>На главную</button></div></div></main>}

 <footer className="site-footer"><span>«Княжич» · Дуэль стихий</span><span>Браузерный прототип v0.5.2 · Одиночная игра</span></footer>
 {panel==='rules'&&<Dialog title="Как играть" onClose={()=>setPanel(null)}><div className="modal-body rules-body"><p>Останься последним учеником, у которого есть заклинания. Каждому участнику выдаётся по 5 карт из общего Колодца знаний.</p><h3>Круг стихий</h3><ElementRing/><p className="fine-text">Стрелка означает абсолютную победу стихии заклинания независимо от числа на карте. Огонь и Воздух нейтральны друг к другу; Вода и Земля — тоже.</p><h3>Если стихии одинаковы или нейтральны</h3><p>Сравниваются силы карт. Если стихия заклинания совпадает со стихией ученика — сила удваивается. При равных итоговых силах — ничья.</p><h3>После поединка</h3><p>Выигравшая карта остаётся у владельца, проигравшая уходит в сброс. При ничьей сбрасываются обе. Участники добирают по одной карте по очереди, первым — участник, чей следующий ход наступит раньше, пока в руках не станет по пять или Колодец не опустеет.</p><h3>Игра памяти</h3><p>Все видят раскрытые карты, даже когда сражаются два бота. Победившая карта известна другим, пока не уйдёт в сброс. Новые карты из Колодца остаются скрытыми.</p><button className="primary-button full" onClick={()=>setPanel(null)}>Понятно</button></div></Dialog>}
 {panel==='elements'&&<Dialog title="Памятка стихий" onClose={()=>setPanel(null)}><div className="modal-body rules-body"><ElementRing/><p className="fine-text">По стрелке — абсолютная победа стихии. Огонь и Воздух нейтральны друг к другу, как и Вода с Землёй. При равных или нейтральных стихиях сравнивается итоговая сила карт.</p><button className="primary-button full" onClick={()=>setPanel(null)}>Понятно</button></div></Dialog>}
 {panel==='history'&&<Dialog title="Журнал поединков" wide onClose={()=>setPanel(null)}><div className="modal-body history-body">{!game||game.history.length===0?<p>Поединков пока не было. Раскрытые карты появятся здесь.</p>:[...game.history].reverse().map(d=><div className="history-entry" key={d.index}><span className="history-number">№ {d.index}</span><div className="history-cards"><div><img src={shortCard(spell(catalog,d.attackerCard))} alt=""/><span><b>{heroOf(game.players.find(p=>p.id===d.attackerId)!).name}</b><small>{spell(catalog,d.attackerCard).name} · {d.attackerStrength}</small></span></div><span className="history-vs">×</span><div><img src={shortCard(spell(catalog,d.defenderCard))} alt=""/><span><b>{heroOf(game.players.find(p=>p.id===d.defenderId)!).name}</b><small>{spell(catalog,d.defenderCard).name} · {d.defenderStrength}</small></span></div></div><strong className="history-outcome">{outcomeLabel(d)}</strong><p>{explanation(d)}</p></div>)}</div></Dialog>}
 {panel==='leave'&&<Dialog title="Покинуть арену?" onClose={()=>setPanel(null)}><div className="modal-body"><p>Текущая партия завершится без сохранения. Вернуться в неё позже будет нельзя.</p><div className="dialog-actions"><button className="secondary-button" onClick={()=>setPanel(null)}>Продолжить игру</button><button className="primary-button" onClick={returnHome}>Выйти из партии</button></div></div></Dialog>}
 </div>;
}
