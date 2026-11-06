import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEVELS,CHAPTERS} from '../src/levels.js';
import {createState,move,isSolved,solve,litCount,searchSolutions,walkable,posKey} from '../src/engine.js';
const solutions=JSON.parse(readFileSync(new URL('./solutions.json',import.meta.url)));
test('关卡地形与队伍有效，章节、标题和双星目标完整',()=>{
 assert.equal(solutions.length,LEVELS.length);
 assert.equal(new Set(LEVELS.map(l=>l.title)).size,LEVELS.length);
 for(const [i,level] of LEVELS.entries()){
  assert.ok(CHAPTERS[level.chapter],`第 ${i+1} 关的章节存在`);
  const state=createState(level),width=level.rows[0].length;
  assert.ok(level.rows.every(row=>row.length===width&&/^[~#.COE]+$/.test(row)));
  assert.ok(state.crates.length>0);assert.equal(state.crates.length,state.goals.length);
  assert.equal(state.exits.length,1);assert.ok(level.description&&level.hint);
  const actors=[...state.heroes,...state.crates];
  assert.equal(new Set(actors.map(p=>posKey(p.x,p.y))).size,actors.length);
  assert.ok(actors.every(p=>walkable(level,p.x,p.y)));
 }
 assert.ok(CHAPTERS.every((_,chapter)=>LEVELS.some(level=>level.chapter===chapter)));
});
for(const [i,level] of LEVELS.entries())test(`关卡 ${i+1}「${level.title}」存在完整通关路线`,()=>{
 let state=createState(level);assert.ok(solutions[i]?.length>0);
 for(const {hero,dir} of solutions[i]){const next=move(level,state,hero,dir);assert.ok(next,`${hero} ${dir} at step ${state.steps}`);state=next;}
 assert.equal(isSolved(state),true);assert.equal(litCount(state),state.goals.length);
});
const map={rows:['########','#......#','#......#','#......#','########'],heroes:[{type:'warrior',x:1,y:2}]};
test('战士可推动整列星晶，原状态保持不变',()=>{
 const s=createState(map);s.crates=[{x:2,y:2},{x:3,y:2}];const next=move(map,s,0,'right');assert.deepEqual(next.crates,[{x:3,y:2},{x:4,y:2}]);assert.deepEqual(s.crates,[{x:2,y:2},{x:3,y:2}]);assert.equal(s.steps,0);
});
test('墙壁和同伴会阻挡推动，失败的移动不计步',()=>{
 const s=createState(map);s.heroes[0].x=4;s.crates=[{x:5,y:2},{x:6,y:2}];assert.equal(move(map,s,0,'right'),null);s.crates=[{x:5,y:2}];s.heroes.push({type:'thief',x:6,y:2});assert.equal(move(map,s,0,'right'),null);assert.equal(s.steps,0);
});
test('盗贼自动拉动身后星晶，不能推动前方星晶',()=>{
 const s=createState(map);s.heroes=[{type:'thief',x:3,y:2}];s.crates=[{x:2,y:2}];const next=move(map,s,0,'right');assert.deepEqual(next.crates,[{x:3,y:2}]);assert.equal(move(map,s,0,'left'),null);
});
test('巫师交换视线中的首个对象，可与同伴换位',()=>{
 const s=createState(map);s.heroes=[{type:'wizard',x:1,y:2},{type:'warrior',x:3,y:2}];s.crates=[{x:5,y:2}];const next=move(map,s,0,'right');assert.equal(next.heroes[0].x,3);assert.equal(next.heroes[1].x,1);assert.equal(next.crates[0].x,5);
});
test('巫师的视线被墙壁阻挡，无目标时普通行走',()=>{
 const level={rows:['#######','#..#..#','#.....#','#######'],heroes:[{type:'wizard',x:1,y:1}]};const s=createState(level);s.crates=[{x:5,y:1}];const next=move(level,s,0,'right');assert.equal(next.heroes[0].x,2);assert.equal(next.crates[0].x,5);assert.equal(move(level,next,0,'right'),null);
});
test('通关需要全部星晶归位，并有同行者进入出口',()=>{
 const s=createState(LEVELS[0]);s.crates=s.goals.map(p=>({...p}));assert.equal(isSolved(s),false);s.heroes[0]={type:'warrior',...s.exits[0]};assert.equal(isSolved(s),true);s.crates[0]={x:2,y:2};assert.equal(isSolved(s),false);
});
test('求解器可从中间状态提供有效后续步骤',()=>{
 const level=LEVELS[3],initial=createState(level),s=move(level,initial,0,'right'),solution=solve(level,s,20000);assert.ok(solution.length);let current=s;for(const a of solution)current=move(level,current,a.hero,a.dir);assert.ok(isSolved(current));assert.equal(s.steps,1);
});

// Turning a role into a plain walker leaves every actor on the board and still
// allows walking, blocking and being swapped by another wizard. Only that role's
// special ability is removed. Exhausting this larger search proves its necessity.
for(const [i,level] of LEVELS.entries())for(const role of level.requiredRoles??[]){
 test(`协作关 ${i+1}「${level.title}」缺少 ${role} 的能力时穷举无解`,()=>{
  const state=createState(level);
  state.heroes=state.heroes.map(h=>h.type===role?{...h,type:'walker'}:h);
  const result=searchSolutions(level,state,100000);
  assert.equal(result.exhausted,true,'必须搜索完所有可达局面，不能将搜索上限视作无解');
  assert.equal(result.solution,null,'其他职业不能代替该职业的能力');
 });
}
test('搜索达到上限会明确标记未知，不会报告穷举无解',()=>{
 const result=searchSolutions(LEVELS[12],createState(LEVELS[12]),1);
 assert.equal(result.solution,null);assert.equal(result.exhausted,false);assert.equal(result.visited,1);
});
test('协作关的必需职业与实际队伍一致，路线包含每位角色的操作',()=>{
 for(const [i,level] of LEVELS.entries())if(level.requiredRoles){
  assert.deepEqual(level.requiredRoles,level.heroes.map(h=>h.type));
  const participants=new Set(solutions[i].map(a=>a.hero));
  assert.equal(participants.size,level.heroes.length);
 }
});
