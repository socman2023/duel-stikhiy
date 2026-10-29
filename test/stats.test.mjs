import test from 'node:test';
import assert from 'node:assert/strict';
import {duelStats} from '../dist/stats.js';
const duel=(a,d,verdict)=>({attackerId:a,defenderId:d,verdict});
test('zero at start and no mutation',()=>{
 const ids=['a','b','c'];const entries=[duel('a','b','attacker')];
 assert.deepEqual(duelStats([],ids),{a:{wins:0,losses:0,ties:0},b:{wins:0,losses:0,ties:0},c:{wins:0,losses:0,ties:0}});
 const data=duelStats(entries,ids);assert.equal(data.a.wins,1);assert.equal(data.b.losses,1);assert.equal(data.c.wins,0);
 assert.equal(entries.length,1);
});
test('wins, losses and draws for bot-versus-bot',()=>{
 const ids=['you','bot1','bot2'];
 const results=[duel('bot1','bot2','attacker'),duel('bot2','you','defender'),duel('you','bot1','tie'),duel('bot1','you','defender')];
 const data=duelStats(results,ids);
 assert.deepEqual(data.you,{wins:2,losses:0,ties:1});
 assert.deepEqual(data.bot1,{wins:1,losses:1,ties:1});
 assert.deepEqual(data.bot2,{wins:0,losses:2,ties:0});
 assert.equal(Object.values(data).reduce((n,x)=>n+x.wins,0),3);
 assert.equal(Object.values(data).reduce((n,x)=>n+x.losses,0),3);
 assert.equal(Object.values(data).reduce((n,x)=>n+x.ties,0),2);
});
