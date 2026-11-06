import {at,litCount,walkable} from './engine.js';
const rand=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const mix=(a,b,t)=>a+(b-a)*t;
export class WorldRenderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.hover=null;this.prev=null;this.changedAt=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.resize();window.addEventListener('resize',()=>this.resize());}
 resize(){this.w=innerWidth;this.h=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=this.w*dpr;this.canvas.height=this.h*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 setLevel(level,state){this.level=level;this.state=state;this.prev=null;this.selected=0;this.hover=null;}
 update(state,selected){if(this.state!==state){this.prev=this.state;this.changedAt=performance.now();}this.state=state;this.selected=selected;}
 layout(){const mobile=this.w<=760;const cols=Math.max(...this.level.rows.map(r=>r.length)),rows=this.level.rows.length;
 const maxWidth=mobile?this.w*.97:Math.min(this.w*.66,1100);this.tw=Math.min(53,maxWidth/(cols+rows));this.th=this.tw*.49;
 this.ox=this.w*(mobile?.5:.51)-(cols-rows)*this.tw/2;this.oy=this.h*(mobile?.51:.52)-(cols+rows-2)*this.th/2;
 if(mobile)this.oy=Math.max(265,this.oy);this.unit=this.tw/40;
 }
 iso(x,y,z=0){return {x:this.ox+(x-y)*this.tw,y:this.oy+(x+y)*this.th-z*this.unit};}
 pickHero(clientX,clientY){
  if(!this.state)return -1;
  this.layout();const candidates=[];
  this.state.heroes.forEach((hero,index)=>{const p=this.iso(hero.x,hero.y);if(Math.abs(clientX-p.x)<19*this.unit&&clientY>p.y-70*this.unit&&clientY<p.y+9*this.unit)candidates.push({index,depth:hero.x+hero.y});});
  candidates.sort((a,b)=>b.depth-a.depth);return candidates[0]?.index??-1;
 }
 hit(clientX,clientY){if(!this.level)return null;this.layout();const a=(clientX-this.ox)/this.tw,b=(clientY-this.oy)/this.th;return {x:Math.floor((a+b)/2+.5),y:Math.floor((b-a)/2+.5)};}
 poly(points,fill,stroke,width=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 line(points,color,width=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
 ellipse(x,y,rx,ry,fill,stroke,width=1){const c=this.ctx;c.beginPath();c.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
 diamond(p,rx,ry,fill,stroke){this.poly([[p.x,p.y-ry],[p.x+rx,p.y],[p.x,p.y+ry],[p.x-rx,p.y]],fill,stroke);}
 glow(x,y,r,color){const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
 background(t){const c=this.ctx,w=this.w,h=this.h,ch=this.level.chapter % 4;
 const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,['#132c2b','#292e29','#1c2636','#132a32'][ch]);g.addColorStop(.5,['#1a3937','#293b34','#263543','#1c3b43'][ch]);g.addColorStop(1,'#0b202b');c.fillStyle=g;c.fillRect(0,0,w,h);
 this.glow(w*.54,h*.43,w*.46,['#94b99b13','#d4b26913','#b19be81a','#7cbcc71a'][ch]);
 // A quiet distant shore and its reflected light.
 for(let layer=0;layer<3;layer++){let points=[[0,0],[w,0],[w,h*(.18+layer*.055)]];for(let i=18;i>=0;i--)points.push([w*i/18,h*(.17+layer*.055)+rand(i+layer*40)*55]);this.poly(points,['#10252365','#10282655','#18312c45'][layer]);}
 const moonX=w*.55,moonY=h*.19;this.glow(moonX,moonY,110,'#c1dbb115');this.ellipse(moonX,moonY,29,29,'#bdc7ac0b','#bbcaab18');this.ellipse(moonX,moonY,37,37,null,'#b5c5a810');this.line([[moonX,moonY-47],[moonX,moonY+47]],'#a2bda51b');
 for(let i=0;i<100;i++){let x=rand(i+20)*w,y=rand(i+320)*h;const alpha=.08+rand(i+51)*.13;c.fillStyle=`rgba(144,188,167,${alpha})`;const length=10+rand(i+180)*57;c.fillRect(x+Math.sin(t*.00015+i)*8,y,length,.6);}
 // Long water currents, drawn without external textures.
 for(let i=0;i<25;i++){const y=h*.35+i*h*.028;const x=rand(i+98)*w;c.beginPath();c.moveTo(x-100,y);c.bezierCurveTo(x,y-7,x+50,y+7,x+170,y-1);c.strokeStyle='#a2c4ab0a';c.lineWidth=1;c.stroke();}
 for(let i=0;i<48;i++){const x=(rand(i+900)*w+Math.sin(t*.0001+i)*25),y=rand(i+1400)*h+Math.cos(t*.00023+i)*14;const a=(Math.sin(t*.001+i)+1)*.15;this.glow(x,y,4,`rgba(206,224,151,${a})`);this.ellipse(x,y,1,1,`rgba(225,229,171,${a+.1})`);}
 }
 block(x,y,height,top,left,right,inset=0){const p=this.iso(x,y),w=this.tw-inset,h=this.th-inset*.49,z=height*this.unit;
 this.poly([[p.x-w,p.y],[p.x,p.y+h],[p.x,p.y+h-z],[p.x-w,p.y-z]],left);
 this.poly([[p.x,p.y+h],[p.x+w,p.y],[p.x+w,p.y-z],[p.x,p.y+h-z]],right);
 this.poly([[p.x,p.y-h-z],[p.x+w,p.y-z],[p.x,p.y+h-z],[p.x-w,p.y-z]],top,'#d4ddba0d');return this.iso(x,y,height);}
 base(){const rows=this.level.rows;for(let sum=0;sum<rows.length+rows[0].length;sum++)for(let y=0;y<rows.length;y++){const x=sum-y;if(!rows[y]?.[x]||rows[y][x]==='~')continue;const p=this.iso(x,y),r=rand(x*17+y*98),depth=(56+r*24)*this.unit,w=this.tw,h=this.th;
 if(!rows[y+1]?.[x]||rows[y+1][x]==='~'){this.poly([[p.x-w,p.y+8],[p.x,p.y+h+8],[p.x,p.y+h+depth],[p.x-w*.75,p.y+depth]],'#1d3635');this.line([[p.x-w*.6,p.y+20],[p.x-w*.55,p.y+depth*.8]],'#42605240',2);}
 if(!rows[y]?.[x+1]||rows[y][x+1]==='~'){this.poly([[p.x,p.y+h+8],[p.x+w,p.y+8],[p.x+w*.7,p.y+depth],[p.x,p.y+h+depth]],'#122e33');this.line([[p.x+w*.45,p.y+28],[p.x+w*.4,p.y+depth*.9]],'#4c69613d',2);}
 const colors=['#576b59','#5b6c55','#556474','#516f70'];this.block(x,y,0,colors[this.level.chapter % 4],'#334a43','#283f3e',0);
 }}
 tile(x,y){const c=this.ctx,p=this.iso(x,y),r=rand(x*17+y*29),u=this.unit;
 const tones=[['#748171','#7d8874','#6a7d70','#81907a'],['#7d826b','#8b8b70','#76826c','#8a8970'],['#74818a','#7e8990','#6a7a83','#829093'],['#6c8783','#7c9490','#607e7d','#849a91']][this.level.chapter % 4];
 this.diamond(p,this.tw-1.5,this.th-1,tones[Math.floor(r*4)],'#b8c1a12b');
 // Fine worn stone joints and chips keep the tiles legible.
 if(r>.3)this.line([[p.x-this.tw*.6,p.y+this.th*.07],[p.x-this.tw*.37,p.y+this.th*.2],[p.x-this.tw*.42,p.y+this.th*.37]],'#394e464d',.7);
 if(r>.65)this.line([[p.x+this.tw*.36,p.y-this.th*.46],[p.x+this.tw*.5,p.y-this.th*.24],[p.x+this.tw*.7,p.y-this.th*.23]],'#c3c6a833',.7);
 for(let i=0;i<3;i++){const px=p.x+(rand(x*42+y*29+i)-.5)*this.tw,py=p.y+(rand(x*22+y*54+i)-.5)*this.th;c.fillStyle='#dae0bc18';c.fillRect(px,py,1.5*u,.6*u);}
 if(this.hover?.x===x&&this.hover?.y===y){this.diamond(p,this.tw-3,this.th-2,'#d9d49f1a','#d6c99486');}
 }
 moss(x,y,seed=0){const p=this.iso(x,y),u=this.unit;for(let i=0;i<7;i++){let dx=(rand(seed+i*7)-.5)*this.tw*1.7,dy=(rand(seed+i*3)-.5)*this.th*1.6;this.ellipse(p.x+dx,p.y+dy,3+rand(seed+i)*7,1+rand(seed+i*2)*3,['#6d8556','#80935a','#4b704d'][i%3]);}}
 wall(x,y){const r=rand(x*47+y*8),u=this.unit;const p=this.block(x,y,22+r*8,'#7c8972','#4a6253','#3f594f',1);
 this.line([[p.x-this.tw*.8,p.y],[p.x,p.y+this.th*.8],[p.x+this.tw*.8,p.y]],'#bac3a652',1);if(r>.35)this.line([[p.x+this.tw*.15,p.y-this.th*.7],[p.x+this.tw*.07,p.y-this.th*.1],[p.x+this.tw*.32,p.y+this.th*.25]],'#4a5b4880');
 this.moss(x,y,x*7+y*90);
 }
 tree(x,y,size=1,seed=0){const p=this.iso(x,y),u=this.unit*size,c=this.ctx;
 this.ellipse(p.x+15*u,p.y+7*u,32*u,10*u,'#09241f48');
 this.poly([[p.x-5*u,p.y],[p.x-3*u,p.y-52*u],[p.x+4*u,p.y-58*u],[p.x+6*u,p.y-1*u]],'#4a4d38');
 this.line([[p.x+1*u,p.y-29*u],[p.x-18*u,p.y-53*u]],'#646148',4*u);
 this.line([[p.x+2*u,p.y-35*u],[p.x+19*u,p.y-61*u]],'#5a5c42',3*u);
 const colors=[['#244e3b','#315f42','#3f6e48','#527b4c','#739157'],['#4d6140','#6b7947','#7d8550','#92955d','#a5a866'],['#344f4b','#3b6155','#506f5c','#70885e','#8f9e70'],['#2b5951','#3a7061','#53846b','#74987a','#8dab7e']][this.level.chapter % 4];
 for(let i=0;i<18;i++){const dx=(rand(seed+i*9)-.5)*52,dy=-48-rand(seed+i*3)*32;const radius=13+rand(seed+i*6)*13;
 this.poly(Array.from({length:7},(_,j)=>{const a=j/7*Math.PI*2;return[p.x+(dx+Math.cos(a)*radius)*u,p.y+(dy+Math.sin(a)*radius*.68)*u];}),colors[Math.min(4,Math.floor((i/18)*5))]);}
 for(let i=0;i<12;i++){const dx=(rand(seed+i*5)-.5)*60,dy=-43-rand(seed+i*11)*47;this.ellipse(p.x+dx*u,p.y+dy*u,2*u,1*u,'#b7c37c45');}
 }
 pillar(x,y,height=80,broken=false){const p=this.iso(x,y),u=this.unit,w=12*u,h=height*u;
 this.poly([[p.x-w,p.y-4*u],[p.x,p.y+4*u],[p.x+w,p.y-4*u],[p.x+w,p.y-12*u],[p.x,p.y-19*u],[p.x-w,p.y-12*u]],'#586e5b');
 this.poly([[p.x-8*u,p.y-11*u],[p.x,p.y-6*u],[p.x,p.y-h],[p.x-8*u,p.y-h-4*u]],'#81917b');this.poly([[p.x,p.y-6*u],[p.x+8*u,p.y-11*u],[p.x+8*u,p.y-h-4*u],[p.x,p.y-h]],'#5f7967');
 this.line([[p.x-4*u,p.y-15*u],[p.x-4*u,p.y-h+5*u]],'#a7b29750',u);
 this.diamond({x:p.x,y:p.y-h-4*u},12*u,6*u,'#a0ac8d','#ccd2ad40');
 this.line([[p.x+2*u,p.y-h*.6],[p.x+7*u,p.y-h*.7],[p.x+3*u,p.y-h*.8]],'#3e5d4e',u);
 if(!broken){this.diamond({x:p.x,y:p.y-h-9*u},11*u,5*u,'#879b80');this.ellipse(p.x,p.y-h-10*u,4*u,2*u,'#d6c68d');}
 }
 rune(x,y,lit,t){const p=this.iso(x,y),u=this.unit;this.glow(p.x,p.y,37*u,lit?'#e5c77f40':'#b5ae6a12');
 this.ellipse(p.x,p.y,25*u,12*u,lit?'#d5b96916':null,lit?'#e2c884':'#b9a66b8c',1.1*u);this.ellipse(p.x,p.y,20*u,9.5*u,null,lit?'#e5c988a6':'#ac9b6e60',.8*u);
 this.diamond(p,12*u,6*u,lit?'#d3ba7b':'#a69d6a66');this.diamond(p,6*u,3*u,'#5c7765');
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;this.line([[p.x+Math.cos(a)*27*u,p.y+Math.sin(a)*13*u],[p.x+Math.cos(a)*30*u,p.y+Math.sin(a)*15*u]],'#c9b781a0',u);}
 }
 crystal(x,y,onGoal,t,index){const bob=this.reduced?0:Math.sin(t*.002+index)*2;const p=this.iso(x,y,19+bob),u=this.unit;this.ellipse(p.x,p.y+(21+bob)*u,16*u,7*u,'#0c2c3260');
 this.glow(p.x,p.y-10*u,44*u,onGoal?'#f5d88855':'#73cbbd38');
 const top=p.y-28*u,mid=p.y-7*u,bottom=p.y+19*u;
 this.poly([[p.x,top],[p.x-16*u,mid],[p.x,bottom]],onGoal?'#d8cb89':'#8bd1bb','#d5ebc790');
 this.poly([[p.x,top],[p.x+15*u,mid],[p.x,bottom]],onGoal?'#a99b62':'#459e9b','#d5ebc750');
 this.poly([[p.x,top],[p.x+4*u,mid],[p.x,bottom],[p.x-6*u,mid]],onGoal?'#eee0a0':'#bce3c6');
 this.line([[p.x-16*u,mid],[p.x+15*u,mid]],'#d9e9c177',u*.8);
 this.ellipse(p.x-3*u,p.y-13*u,2*u,5*u,'#effad4c0');
 for(let i=0;i<3;i++){const a=t*.0007+i*2.1+index;this.ellipse(p.x+Math.cos(a)*21*u,p.y+Math.sin(a)*8*u+10*u,1*u,1*u,'#ccdfa591');}
 }
 portal(x,y,open,t){const p=this.iso(x,y),u=this.unit,c=this.ctx;
 this.ellipse(p.x,p.y,29*u,14*u,'#26473e','#a6b99a5c');this.ellipse(p.x,p.y,23*u,10*u,null,open?'#e2d2a3':'#869f8a',1.5*u);
 this.glow(p.x,p.y-29*u,65*u,open?'#c9e0a52b':'#82c5b51a');
 c.save();c.translate(p.x,p.y);c.scale(u,u);
 c.beginPath();c.moveTo(-24,0);c.lineTo(-24,-44);c.bezierCurveTo(-24,-82,24,-82,24,-44);c.lineTo(24,0);c.lineWidth=11;c.strokeStyle='#3e5b50';c.stroke();
 c.beginPath();c.moveTo(-24,-1);c.lineTo(-24,-44);c.bezierCurveTo(-24,-82,24,-82,24,-44);c.lineTo(24,-1);c.lineWidth=7;c.strokeStyle='#8a9e82';c.stroke();
 c.beginPath();c.moveTo(-18,0);c.lineTo(-18,-44);c.bezierCurveTo(-18,-73,18,-73,18,-44);c.lineTo(18,0);c.lineWidth=1.5;c.strokeStyle=open?'#e6d49c':'#8fb7a1';c.stroke();
 const grad=c.createLinearGradient(0,-65,0,0);grad.addColorStop(0,open?'#e0d89755':'#83bca529');grad.addColorStop(1,'#9cbcaf00');c.fillStyle=grad;c.beginPath();c.ellipse(0,-30,16,34,0,0,Math.PI*2);c.fill();
 for(let i=0;i<7;i++){const yy=-((t*.018+i*10)%65);c.fillStyle=open?'#e9e0a7a0':'#a3d2bb50';c.fillRect(Math.sin(i*9+t*.0005)*12,yy,1,3);}
 this.poly([[0,-86],[5,-77],[0,-69],[-5,-77]],'#d9c88d');c.restore();
 }
 hero(hero,index,t){const old=this.prev?.heroes[index];const progress=this.reduced?1:Math.min(1,(performance.now()-this.changedAt)/145),ease=1-Math.pow(1-progress,3);const x=old?mix(old.x,hero.x,ease):hero.x,y=old?mix(old.y,hero.y,ease):hero.y;const p=this.iso(x,y),u=this.unit,c=this.ctx,active=index===this.selected;
 this.ellipse(p.x+5*u,p.y+3*u,16*u,7*u,'#12302b70');
 if(active){this.glow(p.x,p.y,32*u,'#d9c68827');this.ellipse(p.x,p.y,20*u,9*u,null,'#d4c289',1.2*u);this.ellipse(p.x,p.y,24*u,11*u,null,'#d4c28944',.7*u);}
 c.save();c.translate(p.x,p.y-4*u);c.scale(u,u);const idle=this.reduced?0:Math.sin(t*.002+index)*.5;c.translate(0,idle);
 this.line([[-4,-4],[-5,-15]],'#26332c',6);this.line([[5,-4],[5,-15]],'#26332c',6);this.ellipse(-5,0,5,2,'#373d32');this.ellipse(5,0,5,2,'#373d32');
 if(hero.type==='warrior'){
  this.poly([[-11,-34],[9,-34],[13,-13],[2,-10],[-11,-15]],'#a56743');this.poly([[-10,-31],[-4,-34],[-1,-12],[-10,-15]],'#cf9560');
  this.poly([[-11,-34],[-3,-38],[9,-34],[7,-22],[-7,-22]],'#9caa9a','#d8d4ab50');this.line([[-6,-26],[7,-26]],'#e5d6a68a');
  this.poly([[-16,-30],[-5,-31],[-5,-14],[-11,-8],[-17,-14]],'#486e68','#adbba1',1.5);this.line([[-11,-27],[-11,-14]],'#c1b77d');
  this.poly([[13,-39],[15,-10],[18,-9],[18,-38],[15,-45]],'#cbd5bc');this.line([[10,-16],[22,-16]],'#c3a875',2);
  this.ellipse(0,-42,8,9,'#c6a27b');this.poly([[-9,-45],[-5,-54],[7,-52],[10,-44],[5,-42],[-8,-42]],'#899f91');this.line([[1,-52],[1,-42]],'#c8c5a0',1.4);this.poly([[-3,-53],[-3,-60],[7,-58],[6,-53]],'#ad7252');
 }else if(hero.type==='thief'){
  this.poly([[-10,-34],[10,-34],[12,-6],[0,-11],[-13,-6]],'#3c7562');this.poly([[-7,-34],[-2,-33],[2,-10],[-9,-7]],'#69977a');this.line([[-8,-20],[9,-20]],'#b9a777',3);
  this.ellipse(0,-41,7,8,'#b99970');this.poly([[-10,-38],[-10,-47],[0,-55],[10,-46],[10,-37],[5,-42],[0,-47],[-5,-42]],'#416958');this.line([[-5,-38],[5,-38]],'#9ba184',2);
  this.line([[12,-30],[15,-19]],'#a4b49b',2);this.poly([[14,-24],[20,-34],[18,-18]],'#c2d4ba');
 }else{
  this.poly([[-8,-35],[9,-35],[15,-2],[-14,-2]],'#77668c');this.poly([[-7,-33],[-2,-34],[3,-3],[-10,-3]],'#a293b0');this.line([[-10,-5],[12,-5]],'#c0b48c',2);
  this.ellipse(0,-42,7,8,'#c2ad8c');this.poly([[-8,-39],[1,-32],[6,-40],[3,-28]],'#c1c1ab');this.poly([[-12,-47],[13,-47],[6,-53],[-1,-67],[-7,-52]],'#807694');this.line([[-9,-48],[10,-48]],'#c5b28e',2);
  this.line([[17,-3],[17,-51]],'#ac9b73',3);this.diamond({x:17,y:-55},5,8,'#b0d5c5','#dce7c1');this.glow(17,-55,15,'#bbcdf353');
 }
 if(active){const bob=Math.sin(t*.003)*2;this.poly([[-3,-73+bob],[0,-69+bob],[3,-73+bob],[0,-77+bob]],'#e0cb8b');}
 c.restore();
 }
 decoration(t){const rows=this.level.rows;const cols=rows[0].length;
 // Detached pieces of the ancient garden frame the playable island.
 for(const [x,y,size,seed] of [[-3,4,1.2,45],[cols-2,-2,1.15,82],[-1,rows.length+1,.8,27],[cols+1,4,1.1,91]]){
  const p=this.iso(x,y,0);this.ellipse(p.x+10,p.y+50,75*this.unit,18*this.unit,'#061d2425');
  this.block(x,y,-10,'#496a53','#273e39','#1f3836',0);this.block(x+1,y,-10,'#58745b','#2e4a3d','#203f39',0);this.block(x,y+1,-10,'#567356','#2e4a3d','#203d37',0);
  this.tree(x,y,size,seed);if(seed===82)this.pillar(x+1,y,58,true);
 }
 }
 draw(t){if(!this.level)return;this.layout();if(this.reduced)t=0;this.background(t);const rows=this.level.rows;
 this.decoration(t);this.base();
 for(let sum=0;sum<rows.length+rows[0].length;sum++)for(let y=0;y<rows.length;y++){const x=sum-y;if(!rows[y]?.[x]||rows[y][x]==='~')continue;if(walkable(this.level,x,y))this.tile(x,y);}
 for(const g of this.state.goals)this.rune(g.x,g.y,at(this.state.crates,g.x,g.y)>=0,t);
 const objects=[];
 rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#')objects.push({x,y,draw:()=>{this.wall(x,y);const r=rand(x*47+y*8);if((y===0||x===0)&&r>.66)this.tree(x,y,.85,x*16+y*24);else if(y===0&&r>.42)this.pillar(x,y,65+r*20,true);}});}));
 for(const e of this.state.exits)objects.push({...e,draw:()=>this.portal(e.x,e.y,litCount(this.state)===this.state.goals.length,t)});
 this.state.crates.forEach((o,i)=>{const old=this.prev?.crates[i],p=this.reduced?1:Math.min(1,(performance.now()-this.changedAt)/145),e=1-Math.pow(1-p,3);const x=old?mix(old.x,o.x,e):o.x,y=old?mix(old.y,o.y,e):o.y;objects.push({x,y,draw:()=>this.crystal(x,y,at(this.state.goals,o.x,o.y)>=0,t,i)});});
 this.state.heroes.forEach((h,i)=>objects.push({...h,draw:()=>this.hero(h,i,t)}));
 objects.sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.x-b.x);objects.forEach(o=>o.draw());
 // Fine pollen rises from the island, echoing the stars reflected below.
 for(let i=0;i<16;i++){const p=this.iso(rand(i+900)*rows[0].length,rand(i+1030)*rows.length),dy=((t*.009+i*19)%120);this.ellipse(p.x+Math.sin(t*.0006+i)*10,p.y-dy,.8,.8,'#e2dda066');}
 }
}
