import test from 'node:test';
import assert from 'node:assert/strict';

const callbacks=new Map();
globalThis.Hooks={once(){},on(name,fn){const list=callbacks.get(name)??[];list.push(fn);callbacks.set(name,list);}};
globalThis.game={combats:[],get actors(){throw Error('Combat changes must not scan world actors');},get scenes(){throw Error('Combat changes must not scan world scenes');}};
const {inCombat}=await import('../scripts/main.js');
const combatant=(actorId,token)=>({actorId,token,get actor(){throw Error('Combat membership must not construct actors');}});
const base={id:'hero',uuid:'Actor.hero',isToken:false};
const token={uuid:'Scene.scene.Token.one',actorLink:false};

test('combat membership compares native IDs without materializing actors',()=>{
 game.combats=[{started:true,combatants:[combatant('hero',{...token,actorLink:true})]}];
 assert.equal(inCombat(base),true);
 game.combats=[{started:true,combatants:[combatant('hero',token)]}];
 assert.equal(inCombat(base),false);
 assert.equal(inCombat({...base,isToken:true,token}),true);
 assert.equal(inCombat({...base,isToken:true,token:{uuid:'Scene.scene.Token.two'}}),false);
 game.combats=[{started:true,combatants:[combatant('hero',null)]}];
 assert.equal(inCombat(base),true);
 game.combats=[{started:false,combatants:[combatant('hero',{...token,actorLink:true})]}];
 assert.equal(inCombat(base),false);
 game.combats=[{started:true,combatants:[{actorId:'other',get token(){throw Error('Unrelated token accessed');}}]}];
 assert.equal(inCombat(base),false);
});

test('combat start, turn changes and round changes do not inspect participants or the world',()=>{
 const combat={get combatants(){throw Error('Ordinary turns must not scan participants');}};
 for(const changes of [{round:1,turn:0},{round:2,turn:0},{turn:3},{active:true}])
  for(const fn of callbacks.get('updateCombat'))fn(combat,changes);
});

test('combat reset and deletion inspect only their own participants',()=>{
 let reads=0;
 const actor={uuid:'Actor.npc',isOfType:()=>false};
 const combat={combatants:[{get actor(){reads++;return actor;}},{get actor(){reads++;return actor;}}]};
 for(const fn of callbacks.get('updateCombat'))fn(combat,{round:0});
 assert.equal(reads,2);
 for(const fn of callbacks.get('deleteCombat'))fn(combat);
 assert.equal(reads,4);
});
