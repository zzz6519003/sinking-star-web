export const DIRS = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
export const posKey=(x,y)=>`${x},${y}`;
export function createState(level) {
 const crates=[],goals=[],exits=[];
 level.rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='C')crates.push({x,y});if(c==='O')goals.push({x,y});if(c==='E')exits.push({x,y});}));
 return {heroes:structuredClone(level.heroes),crates,goals,exits,steps:0};
}
export const walkable=(level,x,y)=>!!level.rows[y]?.[x]&&!['#','~',' '].includes(level.rows[y][x]);
export const at=(items,x,y)=>items.findIndex(o=>o.x===x&&o.y===y);
export function litCount(state){return state.goals.filter(g=>at(state.crates,g.x,g.y)>=0).length;}
export function isSolved(state){return litCount(state)===state.goals.length&&state.exits.some(e=>at(state.heroes,e.x,e.y)>=0);}
export function move(level,state,heroIndex,dir) {
 const d=DIRS[dir]; if(!d||!state.heroes[heroIndex])return null;
 const next={...state,heroes:state.heroes.map(h=>({...h})),crates:state.crates.map(c=>({...c}))},h=next.heroes[heroIndex],[dx,dy]=d;
 const nx=h.x+dx,ny=h.y+dy,old={x:h.x,y:h.y};
 if(h.type==='wizard') {
  let x=nx,y=ny;
  while(walkable(level,x,y)) {
   const ci=at(next.crates,x,y),hi=at(next.heroes,x,y);
   if(ci>=0||hi>=0){ const o=ci>=0?next.crates[ci]:next.heroes[hi];h.x=x;h.y=y;o.x=old.x;o.y=old.y;next.steps++;return next; }
   x+=dx;y+=dy;
  }
 }
 if(!walkable(level,nx,ny)||at(next.heroes,nx,ny)>=0)return null;
 const ci=at(next.crates,nx,ny);
 if(ci>=0) {
  if(h.type!=='warrior')return null;
  const chain=[];let x=nx,y=ny,i=ci;
  while(i>=0){chain.push(i);x+=dx;y+=dy;i=at(next.crates,x,y);}
  if(!walkable(level,x,y)||at(next.heroes,x,y)>=0)return null;
  chain.forEach(i=>{next.crates[i].x+=dx;next.crates[i].y+=dy;});
 }
 h.x=nx;h.y=ny;
 if(h.type==='thief') {
  const behind=at(next.crates,old.x-dx,old.y-dy);
  if(behind>=0){next.crates[behind].x=old.x;next.crates[behind].y=old.y;}
 }
 next.steps++;return next;
}
export function stateKey(s){return s.heroes.map(h=>`${h.x},${h.y}`).join(';')+'|'+s.crates.map(c=>`${c.x},${c.y}`).sort().join(';');}
// Bounded breadth-first search powers contextual hints and validates the handcrafted puzzles.
export function searchSolutions(level,initial,limit=150000) {
 let truncated=false;
 const queue=[{state:initial,parent:-1,action:null}],seen=new Set([stateKey(initial)]);
 for(let head=0;head<queue.length&&head<limit;head++) {
  const node=queue[head];
  if(isSolved(node.state)){const path=[];let i=head;while(queue[i].parent>=0){path.push(queue[i].action);i=queue[i].parent;}return {solution:path.reverse(),exhausted:false,visited:seen.size};}
  for(let hero=0;hero<initial.heroes.length;hero++)for(const dir of Object.keys(DIRS)){
   const next=move(level,node.state,hero,dir);if(!next)continue;const key=stateKey(next);if(seen.has(key))continue;
   if(queue.length>=limit){truncated=true;continue;}
   seen.add(key);queue.push({state:next,parent:head,action:{hero,dir}});
  }
 }
 return {solution:null,exhausted:!truncated,visited:seen.size};
}

export function solve(level,initial,limit=150000){return searchSolutions(level,initial,limit).solution;}
