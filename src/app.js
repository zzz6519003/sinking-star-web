import {LEVELS,CHAPTERS,HEROES} from './levels.js';
import {createState,move,isSolved,litCount,walkable,at,DIRS} from './engine.js';
import {WorldRenderer} from './render.js';
import {Ambience,describeSound} from './audio.js';
const $=id=>document.getElementById(id),storageKey='sinking-star-v1';
const renderer=new WorldRenderer($('world')),audio=new Ambience();
let save={level:0,completed:{},session:null},levelIndex=0,state,selected=0,history=[],busy=false,toastTimer,winTimer,hintWorker=null,actionToken=0;
let storageAvailable=true;
try{const data=JSON.parse(localStorage.getItem(storageKey));if(data&&typeof data==='object'){save.level=Number.isInteger(data.level)?Math.max(0,Math.min(LEVELS.length-1,data.level)):0;if(data.completed&&typeof data.completed==='object')for(const [key,value] of Object.entries(data.completed)){if(Number.isInteger(+key)&&+key>=0&&+key<LEVELS.length&&Number.isInteger(value)&&value>=0)save.completed[key]=value;}save.session=data.session;}}catch{storageAvailable=false;}
function validState(s,level){const base=createState(level);if(!s||!Array.isArray(s.heroes)||!Array.isArray(s.crates)||s.heroes.length!==base.heroes.length||s.crates.length!==base.crates.length||!Number.isSafeInteger(s.steps)||s.steps<0)return false;const occupied=new Set();for(const [i,h]of s.heroes.entries()){if(h.type!==base.heroes[i].type)return false;}for(const o of [...s.heroes,...s.crates]){if(!Number.isInteger(o.x)||!Number.isInteger(o.y)||!walkable(level,o.x,o.y))return false;const key=`${o.x},${o.y}`;if(occupied.has(key))return false;occupied.add(key);}return true;}
function restoreState(raw,level){const base=createState(level);return {...base,heroes:raw.heroes.map(h=>({type:h.type,x:h.x,y:h.y})),crates:raw.crates.map(c=>({x:c.x,y:c.y})),steps:raw.steps};}
function persist(){save.level=levelIndex;save.session={state,selected,history:history.slice(-300)};try{localStorage.setItem(storageKey,JSON.stringify(save));}catch{storageAvailable=false;}$('save-status').innerHTML=storageAvailable?'本地自动保存 <i></i>':'当前浏览器无法保存进度';}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2900);}
function stopHint(){hintWorker?.terminate();hintWorker=null;}
function loadLevel(index,restore=false){actionToken++;busy=false;clearTimeout(winTimer);stopHint();levelIndex=Math.max(0,Math.min(LEVELS.length-1,index));const level=LEVELS[levelIndex];state=createState(level);selected=0;history=[];
 if(restore&&save.session&&validState(save.session.state,level)) {state=restoreState(save.session.state,level);selected=Math.max(0,Math.min(state.heroes.length-1,Number.isInteger(save.session.selected)?save.session.selected:0));history=(Array.isArray(save.session.history)?save.session.history:[]).filter(h=>validState(h.state,level)).slice(-300).map(h=>({state:restoreState(h.state,level),selected:Number.isInteger(h.selected)?Math.max(0,Math.min(state.heroes.length-1,h.selected)):0}));}
 renderer.setLevel(level,state);renderer.selected=selected;$('hint').hidden=true;$('hint').textContent='';
 const ch=CHAPTERS[level.chapter];$('chapter-label').textContent=`${['第一章','第二章','第三章','第四章','第五章','终章'][level.chapter]} · ${ch.name}`;$('level-number').innerHTML=`${String(levelIndex+1).padStart(2,'0')} <span>/ ${LEVELS.length}</span>`;$('level-title').textContent=level.title;$('level-description').textContent=level.description;$('location-label').textContent=ch.en;
 $('chapter-progress').innerHTML=LEVELS.map((entry,i)=>entry.chapter===level.chapter?`<button class="${i===levelIndex?'current':Object.hasOwn(save.completed,i)?'done':''}" aria-label="前往第 ${i+1} 关" data-level="${i}"></button>`:'').join('');
 document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>loadLevel(+b.dataset.level));
 const badge=$('coop-badge');badge.hidden=!level.requiredRoles;badge.textContent=level.requiredRoles?level.requiredRoles.map(role=>HEROES[role].role).join(' × ')+' · 缺一不可':'';
 $('cooperation-note').hidden=!level.cooperation;$('cooperation-note').textContent=level.cooperation||'';
 updateUI();persist();if(isSolved(state))winTimer=setTimeout(showWin,500);
}
function updateUI(){renderer.update(state,selected);$('steps').textContent=String(state.steps).padStart(3,'0');const lit=litCount(state),allLit=lit===state.goals.length;$('goal-count').textContent=`${lit} / ${state.goals.length}`;$('goal-count').classList.toggle('complete',allLit);$('exit-state').textContent=allLit?'已开启':'待开启';$('exit-state').classList.toggle('complete',allLit);$('undo').disabled=history.length===0;
 $('heroes').innerHTML=state.heroes.map((h,i)=>{const info=HEROES[h.type];return `<button class="hero-card ${selected===i?'selected':''}" data-hero="${i}" aria-pressed="${selected===i}" title="${info.role}：${info.ability}"><span class="portrait ${h.type}">${info.icon}</span><span><strong>${info.name}</strong><small>${info.role} · ${['推','拉','换位'][['warrior','thief','wizard'].indexOf(h.type)]}</small></span><kbd>${i+1}</kbd>${selected===i?'<span class="selected-mark">◆</span>':''}</button>`;}).join('');
 document.querySelectorAll('[data-hero]').forEach(b=>b.onclick=()=>selectHero(+b.dataset.hero));$('hero-shortcut').textContent=state.heroes.length>1?'1 — '+state.heroes.length+' 切换':'独行，也有星光相伴';
}
function selectHero(i){if(i<0||i>=state.heroes.length||busy)return;if(selected!==i)audio.select(state.heroes[i].type);selected=i;updateUI();persist();}
function takeStep(dir,quiet=false){if(isSolved(state)||document.querySelector('dialog[open]'))return false;const next=move(LEVELS[levelIndex],state,selected,dir);if(!next){if(!quiet)toast(state.heroes[selected].type==='thief'?'盗贼无法推动星晶，试着从另一侧牵引。':'前方无法通行，试试另一条路。');return false;}
 stopHint();history.push({state,selected});const oldLit=litCount(state);audio.action(describeSound(state,next,selected),state.heroes[selected].type);state=next;updateUI();persist();if(litCount(state)>oldLit){audio.goal(litCount(state)===state.goals.length);toast(litCount(state)===state.goals.length?'星晶已全部归位。星之门正在等待。':'一枚星晶，找到了归处。');}
 if(isSolved(state)){audio.win();winTimer=setTimeout(showWin,650);}return true;
}
function undo(){actionToken++;busy=false;clearTimeout(winTimer);stopHint();if(!history.length)return;const prev=history.pop();audio.undo();state=prev.state;selected=prev.selected;updateUI();persist();}
function reset(){if(state.steps===0)return;loadLevel(levelIndex);audio.undo();toast('庭院回到了最初的模样。');}
function openDialog(id){actionToken++;busy=false;stopHint();const d=$(id);if(!d.open)d.showModal();}
function buildMap(){const completed=Object.keys(save.completed).length;$('map-intro').textContent=`${LEVELS.length} 道谜题，三种力量。新增 8 道职业协作试炼。`;$('level-map').innerHTML=CHAPTERS.map((ch,c)=>`<section class="map-chapter"><div><h3>${['I','II','III','IV','V','VI'][c]} · ${ch.name}</h3><p>${ch.subtitle}</p></div><div class="map-levels">${LEVELS.map((level,i)=>level.chapter===c?`<button class="map-level ${i===levelIndex?'current':''}" data-map-level="${i}" aria-label="第 ${i+1} 关 ${level.title}${Object.hasOwn(save.completed,i)?' 已完成':''}"><b>${String(i+1).padStart(2,'0')}</b><span>${level.title}</span>${level.requiredRoles?`<small>${level.requiredRoles.map(role=>HEROES[role].role).join(' × ')}</small>`:''}${Object.hasOwn(save.completed,i)?'<i>✦</i>':''}</button>`:'').join('')}</div></section>`).join('');$('total-progress').textContent=`已点亮 ${completed} / ${LEVELS.length} 片星光`;document.querySelectorAll('[data-map-level]').forEach(b=>b.onclick=()=>{$('map-dialog').close();loadLevel(+b.dataset.mapLevel);});}
function openMap(){buildMap();openDialog('map-dialog');}
function showWin(){if(!isSolved(state))return;const previous=save.completed[levelIndex];save.completed[levelIndex]=previous===undefined?state.steps:Math.min(previous,state.steps);persist();$('win-steps').textContent=state.steps;$('win-best').textContent=save.completed[levelIndex];$('win-progress').textContent=`${Object.keys(save.completed).length} / ${LEVELS.length}`;const last=levelIndex===LEVELS.length-1;$('win-title').textContent=last?'沉落的星辰，终将重逢':'一片星光，重新亮起';$('win-description').textContent=last?`${LEVELS.length} 片星光已汇成归途。\n感谢你，陪他们走过这一程。`:`「${LEVELS[levelIndex].title}」的回响已被铭记。\n未知的庭院，还在星光深处等待。`;$('next-level').innerHTML=last?'重新探索 <span>↗</span>':'继续旅程 <span>→</span>';openDialog('win-dialog');}
function hint(){const el=$('hint');if(!el.hidden){el.hidden=true;stopHint();return;}el.hidden=false;el.textContent=LEVELS[levelIndex].hint;if(state.steps===0)return;
 stopHint();const worker=new Worker(new URL('./hint-worker.js',import.meta.url),{type:'module'});hintWorker=worker;worker.onmessage=({data})=>{if(worker!==hintWorker)return;const first=data.solution?.[0];if(first){el.textContent=`此刻的一缕指引：选择${HEROES[state.heroes[first.hero].type].role}，向${{up:'北 ↗',down:'南 ↙',left:'西 ↖',right:'东 ↘'}[first.dir]}移动。`;}else if(data.solution===null){el.textContent+=' 若星晶被困在角落，可以用 Z 回溯，或 R 重新出发。';}stopHint();};worker.onerror=()=>stopHint();worker.postMessage({level:LEVELS[levelIndex],state});}
function pathTo(tx,ty){const level=LEVELS[levelIndex],h=state.heroes[selected];const queue=[{x:h.x,y:h.y,path:[]}],seen=new Set([`${h.x},${h.y}`]);for(let i=0;i<queue.length;i++){const n=queue[i];if(n.x===tx&&n.y===ty)return n.path;for(const[dir,[dx,dy]]of Object.entries(DIRS)){const x=n.x+dx,y=n.y+dy,key=`${x},${y}`;if(seen.has(key)||!walkable(level,x,y)||at(state.crates,x,y)>=0||at(state.heroes,x,y)>=0)continue;seen.add(key);queue.push({x,y,path:[...n.path,dir]});}}return null;}
$('world').addEventListener('pointermove',e=>{const p=renderer.hit(e.clientX,e.clientY);renderer.hover=p&&walkable(LEVELS[levelIndex],p.x,p.y)?p:null;});$('world').addEventListener('pointerleave',()=>renderer.hover=null);
$('world').addEventListener('click',async e=>{if(busy||isSolved(state))return;const picked=renderer.pickHero(e.clientX,e.clientY);if(picked>=0){selectHero(picked);return;}const tile=renderer.hit(e.clientX,e.clientY);if(!tile||!walkable(LEVELS[levelIndex],tile.x,tile.y))return;const hi=at(state.heroes,tile.x,tile.y);if(hi>=0){selectHero(hi);return;}const h=state.heroes[selected],dx=tile.x-h.x,dy=tile.y-h.y;
 if(Math.abs(dx)+Math.abs(dy)===1||(h.type==='wizard'&&(dx===0||dy===0))){takeStep(dx>0?'right':dx<0?'left':dy>0?'down':'up');return;}
 if(h.type==='wizard'){toast('巫师会自动沿视线换位，建议使用方向键控制。');return;}
 const path=pathTo(tile.x,tile.y);if(!path){toast('暂时无法直接抵达。试着移动星晶，打开道路。');return;}busy=true;const token=++actionToken;for(const dir of path){if(token!==actionToken||!takeStep(dir,true))break;await new Promise(r=>setTimeout(r,155));}if(token===actionToken)busy=false;
});
const keyDirs={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
let lastKeyAt=0;
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(e.metaKey||e.ctrlKey||e.altKey||['INPUT','TEXTAREA'].includes(e.target.tagName))return;const key=e.key;if(keyDirs[key]){e.preventDefault();if(e.repeat&&performance.now()-lastKeyAt<140)return;actionToken++;busy=false;takeStep(keyDirs[key]);lastKeyAt=performance.now();}else if(key==='z'||key==='Z'){e.preventDefault();undo();}else if(key==='r'||key==='R'){if(!e.repeat)reset();}else if(key==='h'||key==='H'){if(!e.repeat)hint();}else if(key==='Tab'){e.preventDefault();selectHero((selected+1)%state.heroes.length);}else if(['1','2','3'].includes(key)){selectHero(+key-1);}});
$('undo').onclick=undo;$('reset').onclick=reset;$('hint-button').onclick=hint;$('map-button').onclick=openMap;$('brand').onclick=e=>{e.preventDefault();openMap();};$('help').onclick=()=>openDialog('help-dialog');
function updateSoundUI(){
 $('sound').classList.toggle('active',audio.enabled);$('sound').textContent=audio.enabled?'♫':'♪';
 $('sound').setAttribute('aria-label',audio.enabled?'静音游戏声音':'开启游戏声音');$('sound').setAttribute('aria-pressed',String(audio.enabled));
 $('sound').title=audio.enabled?'声音已开启 · 点击静音，指南中可调音量':'点击开启脚步与互动音效';
 $('sound-volume').value=String(Math.round(audio.volume*100));$('volume-value').textContent=`${Math.round(audio.volume*100)}%`;$('ambient-enabled').checked=audio.ambientEnabled;
}
$('sound').onclick=async()=>{try{const enabled=await audio.toggle();updateSoundUI();toast(enabled?'声音已开启 · 脚步轻一点，旅途慢一点。':'已静音');}catch{toast('当前浏览器暂不支持游戏声音。');}};
$('sound-volume').oninput=e=>{audio.setVolume(Number(e.target.value)/100);updateSoundUI();};
$('sound-volume').onchange=()=>{audio.unlock();audio.step();};
$('ambient-enabled').onchange=e=>audio.setAmbient(e.target.checked);
// Browser audio starts with the first intentional game interaction, never on load.
window.addEventListener('pointerdown',()=>{audio.unlock();},{capture:true});
window.addEventListener('keydown',e=>{if(!e.metaKey&&!e.ctrlKey&&!e.altKey&&(keyDirs[e.key]||['1','2','3','z','Z','r','R','Tab','Enter',' '].includes(e.key)))audio.unlock();},{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.suspend();else if(audio.ctx)audio.unlock();});
updateSoundUI();
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('此窗口不支持全屏，可在独立浏览器中打开。');}};
$('next-level').onclick=()=>{$('win-dialog').close();if(levelIndex===LEVELS.length-1)openMap();else loadLevel(levelIndex+1);};$('win-map').onclick=()=>{$('win-dialog').close();openMap();};
for(const b of document.querySelectorAll('.close-dialog,.close-help'))b.onclick=()=>b.closest('dialog').close();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
for(const b of document.querySelectorAll('[data-dir]'))b.onclick=()=>{actionToken++;busy=false;takeStep(b.dataset.dir);};
loadLevel(save.level,true);function frame(t){renderer.draw(t);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.addEventListener('pagehide',persist);
