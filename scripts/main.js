export const ID='pf2e-reload-assistant';
const socket=`module.${ID}`,queues=new Map(),timers=new Map(),busy=new Set(),pending=new Map(),seen=new Set();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=v=>foundry.utils.deepClone(v);
export const ignored=()=>game.settings.get(ID,'ignoreAmmunition');
export const eligible=w=>w?.isOfType?.('weapon')&&w.quantity>0&&w.actor?.isOfType('character')&&w.isRanged&&!w.isThrown&&!w.system.ammo?.builtIn&&Number(w.system.ammo?.capacity)>0;
const needsButton=w=>eligible(w)&&Number(w.reload)>0;
export const inCombat=a=>game.combats.some(c=>c.started&&c.combatants.some(t=>{
 if(t.actorId!==a.id)return false;
 const token=t.token;
 return a.isToken?token?.uuid===a.token.uuid:!token||token.actorLink;
}));
const authority=a=>{const primary=a.primaryUpdater;return primary?.active?primary:game.users.filter(u=>u.active&&a.testUserPermission(u,'OWNER')).sort((a,b)=>a.id.localeCompare(b.id))[0];};
const owned=a=>a?.isOwner;
const nativeAmmo=w=>w.subitems.filter(i=>i.isOfType('ammo','weapon')&&i.isAmmoFor(w));
const usable=a=>a.quantity>0&&(!a.isOfType('ammo')||a.uses.value>0);
export const loaded=w=>nativeAmmo(w).filter(usable);
export const compatible=w=>[...w.actor.itemTypes.ammo,...w.actor.itemTypes.weapon.filter(a=>a.system.usage.canBeAmmo)].filter(a=>!a.isStowed&&a.isAmmoFor(w)&&usable(a));
const capacity=w=>Number(w.system.ammo?.capacity??0);
const count=w=>loaded(w).reduce((n,a)=>n+a.quantity,0);
const cost=w=>w.system.traits.value.includes('repeating')?'3':String(w.reload??'1');
const stable=v=>JSON.stringify((function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;})(v));
export function identity(ammo){
 const data=ammo.toObject(),system=data.system;
 for(const key of ['quantity','equipped','containerId','_migration'])delete system[key];
 if(system.uses)delete system.uses.value;
 return stable({type:data.type,name:data.name,system,flags:data.flags??{}});
}
const preference=w=>w.getFlag(ID,'defaultAmmo');
export const defaultAmmo=w=>{const p=preference(w);return p?compatible(w).find(a=>identity(a)===p.identity)??null:null;};
const serialize=(actor,fn)=>{const prior=queues.get(actor.uuid)??Promise.resolve();const next=prior.catch(()=>{}).then(fn);queues.set(actor.uuid,next);next.finally(()=>{if(queues.get(actor.uuid)===next)queues.delete(actor.uuid);}).catch(()=>{});return next;};

async function remember(w,ammo){await w.setFlag(ID,'defaultAmmo',{id:ammo.id,name:ammo.name,identity:identity(ammo)});}
async function exhaustion(w){
 const existing=game.messages.find(m=>m.getFlag(ID,'exhaustion')?.weapon===w.uuid&&!m.getFlag(ID,'resolved'));
 if(existing)return existing;
 const p=preference(w),users=game.users.filter(u=>u.isGM||w.actor.testUserPermission(u,'OWNER')).map(u=>u.id);
 return ChatMessage.create({speaker:ChatMessage.getSpeaker({actor:w.actor}),whisper:users,content:`<section class="reload-assistant-empty"><h3>Ammunition needed</h3><p><strong>${esc(w.name)}</strong>: ${p?`${esc(p.name)} is unavailable.`:'Choose default ammunition.'}</p><p>Choose compatible ammunition to set as default and reload.</p></section>`,flags:{[ID]:{exhaustion:{weapon:w.uuid}}}});
}

async function load(w,{all=false,notify=true}={}){
 if(!eligible(w)||ignored())return {status:'ignored'};
 if(count(w)>=capacity(w))return {status:'full'};
 let ammo=defaultAmmo(w);
 if(!preference(w)&&compatible(w).length===1){ammo=compatible(w)[0];await remember(w,ammo);}
 if(!ammo){if(notify)await exhaustion(w);return {status:'empty'};}
 const amount=Math.min(ammo.quantity,all?capacity(w)-count(w):1);
 if(amount>0)await w.attach(ammo,{quantity:amount,stack:true});
 return {status:'loaded',quantity:amount};
}

async function setDefault(w,ammoId,{reload=false}={}){
 if(ignored())return {status:'ignored'};
 const ammo=compatible(w).find(a=>a.id===ammoId);
 if(!ammo)throw Error('That ammunition is no longer available or compatible.');
 const previous=preference(w),nextIdentity=identity(ammo);
 await remember(w,ammo);
 if(!inCombat(w.actor)){
  // Native detach returns every still-usable old round; spent rounds must never be refunded.
  if(previous?.identity!==nextIdentity)for(const old of [...loaded(w)])await old.detach({skipConfirm:true});
  return load(w,{all:true});
 }
 return reload?load(w):{status:'selected'};
}

async function autoLoad(actor){
 if(!actor?.isOfType('character')||ignored()||inCombat(actor))return;
 for(const w of actor.itemTypes.weapon.filter(eligible))await load(w,{all:true,notify:!!preference(w)});
}
export function schedule(actor){
 if(!actor?.isOfType?.('character')||authority(actor)!==game.user||busy.has(actor.uuid)||ignored())return;
 clearTimeout(timers.get(actor.uuid));timers.set(actor.uuid,setTimeout(()=>{timers.delete(actor.uuid);serialize(actor,async()=>{busy.add(actor.uuid);try{await autoLoad(actor);}catch(e){console.error(ID,e);ui.notifications.error(e.message);}finally{busy.delete(actor.uuid);}});},150));
}

async function execute(request){
 const w=await fromUuid(request.weapon),actor=w?.actor,user=game.users.get(request.user);
 if(!eligible(w)||!user?.active||!actor.testUserPermission(user,'OWNER'))throw Error('You do not own this weapon.');
 return serialize(actor,async()=>{
  busy.add(actor.uuid);
  try{
   let response;
   if(request.action==='default')response=await setDefault(w,request.ammo,{reload:request.reload});
   else if(request.action==='reload')response=await load(w,{all:!inCombat(actor)});
   else throw Error('Unknown reload action.');
   if(request.card&&response.status==='loaded'){
    const card=game.messages.get(request.card);
    if(card?.getFlag(ID,'exhaustion')?.weapon===w.uuid)await card.setFlag(ID,'resolved',true);
   }
   return response;
  }finally{busy.delete(actor.uuid);}
 });
}
export async function request(action,w,extra={}){
 if(!owned(w.actor))throw Error('You do not own this weapon.');
 const updater=authority(w.actor);if(!updater)throw Error('No active owner is available.');
 const data={...extra,action,weapon:w.uuid,user:game.user.id,id:foundry.utils.randomID(),to:updater.id};
 if(updater===game.user)return execute(data);
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(data.id);reject(Error('Reload request timed out. Try again.'));},15000);
  pending.set(data.id,{resolve,reject,timer});game.socket.emit(socket,{request:data});
 });
}

// Keep the ammunition fired by each attack available for that attack's later damage roll.
let snapshotDepth=0;
function shotFor(actor,weapon,params){
 const explicit=params.reloadAssistantShot;if(explicit)return explicit;
 const context=params.checkContext;if(!context)return null;
 return game.messages.contents.slice().reverse().find(m=>m.flags.pf2e?.context===context&&m.getFlag(ID,'shot')?.weapon===weapon.uuid)?.getFlag(ID,'shot')??null;
}
function snapshotStrike(actor,weapon,shot){
 const items=actor.toObject().items;
 const source=items.find(i=>i._id===weapon.id);if(!source)return null;
 source.system.subitems=copy(shot.subitems);
 snapshotDepth++;
 try{
  const clone=actor.clone({items},{keepId:true});
  const actions=clone.system.actions.flatMap(s=>[s,...(s.altUsages??[])]);
  return actions.find(s=>s.item.id===weapon.id&&s.item.isRanged===weapon.isRanged&&s.type==='strike')??null;
 }finally{snapshotDepth--;}
}
function installStrikes(){
 const Character=CONFIG.PF2E.Actor.documentClasses.character,original=Character.prototype.prepareStrike;
 Character.prototype.prepareStrike=function(...args){
  const strike=original.apply(this,args);if(snapshotDepth)return strike;
  const weapon=strike.item;
  for(const v of strike.variants){const roll=v.roll;v.roll=(params={})=>roll({...params,...(ignored()&&weapon.system.ammo?{consumeAmmo:false}:{})});}
  strike.attack=strike.roll=strike.variants[0].roll;
  for(const method of ['damage','critical']){
   const originalDamage=strike[method];if(!originalDamage)continue;
   strike[method]=params=>{
    params??={};const shot=shotFor(this,weapon,params);
    const restored=shot?snapshotStrike(this,weapon,shot):null;
    return restored?restored[method](params):originalDamage(params);
   };
  }
  return strike;
 };
 // Native chat damage uses _attack; leave attack variants live, wrap only its damage methods.
 const Message=CONFIG.ChatMessage.documentClass,descriptor=Object.getOwnPropertyDescriptor(Message.prototype,'_attack');
 if(descriptor?.get)Object.defineProperty(Message.prototype,'_attack',{...descriptor,get(){
  const attack=descriptor.get.call(this),shot=this.getFlag(ID,'shot');if(!attack||!shot)return attack;
  const wrapped=Object.create(attack);
  for(const method of ['damage','critical'])if(attack[method])wrapped[method]=(params={})=>attack[method]({...params,reloadAssistantShot:shot});
  return wrapped;
 }});
}

function renderSheet(sheet,html){
 const root=html instanceof HTMLElement?html:html[0],actor=sheet.actor;if(!actor?.isOfType('character'))return;
 for(const row of root.querySelectorAll('[data-strike][data-action-index]')){
  if(row.querySelector('.reload-assistant-default'))continue;
  const w=actor.system.actions[Number(row.dataset.actionIndex)]?.item?.realItem;
  if(!eligible(w))continue;
  const panel=row.querySelector('.ammo');if(!panel)continue;
  const p=preference(w),choices=compatible(w),selected=defaultAmmo(w),label=document.createElement('label');label.className='reload-assistant-default';
  label.innerHTML=`<span>Default ammo</span><select aria-label="Default ammunition for ${esc(w.name)}" ${!owned(actor)||ignored()?'disabled':''}><option value="" ${p?'disabled':''}>${p&&!selected?`${esc(p.name)} (no reserve)`:'Choose ammunition'}</option>${choices.map(a=>`<option value="${esc(a.id)}" ${a.id===selected?.id?'selected':''}>${esc(a.name)} (${a.quantity}${a.isOfType('ammo')&&a.isMagazine?` × ${a.uses.value}/${a.uses.max}`:''})</option>`).join('')}</select>`;
  label.querySelector('select').addEventListener('change',async e=>{if(!e.target.value)return;try{await request('default',w,{ammo:e.target.value});}catch(e){ui.notifications.error(e.message);}actor.sheet.render(false);});
  panel.append(label);
 }
}
function renderMessage(message,html){
 const root=html instanceof HTMLElement?html:html[0];
 const exhaustion=message.getFlag(ID,'exhaustion');
 if(exhaustion){
  const w=fromUuidSync(exhaustion.weapon);if(!eligible(w)||!owned(w.actor)||ignored()||root.querySelector('.reload-assistant-choices'))return;
  const section=document.createElement('div');section.className='reload-assistant-choices';
  if(message.getFlag(ID,'resolved'))section.innerHTML='<p>Ammunition selected and loaded.</p>';
  else{const choices=compatible(w);section.innerHTML=choices.length?`<select aria-label="Replacement ammunition">${choices.map(a=>`<option value="${esc(a.id)}">${esc(a.name)} (${a.quantity})</option>`).join('')}</select><button type="button">Set default &amp; reload</button>`:'<p>No compatible ammunition remains in inventory.</p>';
   section.querySelector('button')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await request('default',w,{ammo:section.querySelector('select').value,reload:true,card:message.id});}catch(err){ui.notifications.error(err.message);}finally{e.target.disabled=false;}});
  }
  root.querySelector('.reload-assistant-empty')?.append(section);return;
 }
 if(ignored()||!message.isContentVisible||root.querySelector('.reload-assistant-controls'))return;
 const shot=message.getFlag(ID,'shot'),w=shot?fromUuidSync(shot.weapon):null;
 if(!needsButton(w)||!owned(w.actor))return;
 const controls=document.createElement('div');controls.className='reload-assistant-controls';
 const full=count(w)>=capacity(w);
 controls.innerHTML=`<button type="button" ${full?'disabled':''}><i class="fa-solid fa-rotate-right" inert></i> ${full?'Loaded':`Reload <span class="action-glyph">${esc(cost(w))}</span>`}</button><small>Default: ${esc(preference(w)?.name??'not selected')} · Loaded ${count(w)}/${capacity(w)}</small>`;
 controls.querySelector('button').addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{await request('reload',w);}catch(err){ui.notifications.error(err.message);}finally{button.disabled=false;}});
 (root.querySelector('.message-content')??root).append(controls);
}
function refreshCards(actor){
 if(!actor)return;
 for(const el of document.querySelectorAll('.message[data-message-id]')){
  const message=game.messages.get(el.dataset.messageId),flags=message?.flags[ID];
  const uuid=flags?.shot?.weapon??flags?.exhaustion?.weapon;
  if(!uuid?.startsWith(actor.uuid+'.'))continue;
  el.querySelector('.reload-assistant-controls')?.remove();el.querySelector('.reload-assistant-choices')?.remove();renderMessage(message,el);
 }
}

Hooks.once('init',()=>{
 game.settings.register(ID,'ignoreAmmunition',{name:'Ignore reloading and ammunition',hint:'Allow attacks without loaded rounds or inventory ammunition. No automatic consumption, loading, or reload prompts. Players handle any tracking themselves.',scope:'world',config:true,type:Boolean,default:false,onChange:()=>{
  for(const a of game.actors){a.reset();for(const app of Object.values(a.apps))if(app.rendered)app.render(false);}
  for(const el of document.querySelectorAll('.message[data-message-id]')){el.querySelector('.reload-assistant-controls')?.remove();el.querySelector('.reload-assistant-choices')?.remove();const message=game.messages.get(el.dataset.messageId);if(message)renderMessage(message,el);}
 }});
 installStrikes();
});
Hooks.once('ready',()=>{
 game.socket.on(socket,async data=>{
  if(data.reply&&data.to===game.user.id){const wait=pending.get(data.id);if(wait){clearTimeout(wait.timer);pending.delete(data.id);data.error?wait.reject(Error(data.error)):wait.resolve(data.result);}return;}
  const r=data.request;if(!r||r.to!==game.user.id||seen.has(r.id))return;
  const w=await fromUuid(r.weapon);if(!w?.actor||authority(w.actor)!==game.user)return;
  seen.add(r.id);if(seen.size>500)seen.delete(seen.values().next().value);
  try{const result=await execute(r);game.socket.emit(socket,{reply:true,to:r.user,id:r.id,result});}catch(e){game.socket.emit(socket,{reply:true,to:r.user,id:r.id,error:e.message});}
 });
 game.modules.get(ID).api={request,loaded,compatible,defaultAmmo,identity,inCombat,schedule,eligible,ignored,snapshotStrike};
 for(const a of game.actors)schedule(a);
});
Hooks.on('renderCharacterSheetPF2e',renderSheet);
Hooks.on('renderChatMessageHTML',renderMessage);
Hooks.on('preCreateChatMessage',message=>{
 if(ignored()||message.flags.pf2e?.context?.type!=='attack-roll')return;
 const w=message.item?.realItem??message.item;
 if(!eligible(w))return;
 message.updateSource({flags:{[ID]:{shot:{weapon:w.uuid,subitems:copy(w.toObject().system.subitems??[])}}}});
});
for(const hook of ['createItem','updateItem','deleteItem'])Hooks.on(hook,item=>{schedule(item.actor);refreshCards(item.actor);});
Hooks.on('updateActor',actor=>schedule(actor));
function scheduleCombatParticipants(combat){
 const actors=new Map();for(const c of combat.combatants){const actor=c.actor;if(actor)actors.set(actor.uuid,actor);}
 for(const actor of actors.values())schedule(actor);
}
Hooks.on('deleteCombat',scheduleCombatParticipants);
Hooks.on('updateCombat',(combat,changes)=>{if(changes.round===0)scheduleCombatParticipants(combat);});
