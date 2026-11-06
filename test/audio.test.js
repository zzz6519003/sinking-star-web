import test from 'node:test';
import assert from 'node:assert/strict';
import {Ambience, describeSound} from '../src/audio.js';
import {createState,move} from '../src/engine.js';
import {LEVELS} from '../src/levels.js';

test('真实规则中的行走、推动、牵引会匹配不同音效',()=>{
 for(const[index,dir,expected]of[[0,'down','step'],[0,'right','push'],[3,'right','pull']]){
  const before=createState(LEVELS[index]);const after=move(LEVELS[index],before,0,dir);
  assert.equal(describeSound(before,after,0),expected);
 }
});
test('巫师与星晶、相邻同伴换位均播放换位音，而非普通脚步',()=>{
 const level={rows:['#######','#.....#','#.....#','#######'],heroes:[{type:'wizard',x:1,y:1},{type:'warrior',x:2,y:1}]};
 const before=createState(level);assert.equal(describeSound(before,move(level,before,0,'right'),0),'swap');
 before.heroes.pop();before.crates.push({x:4,y:1});
 assert.equal(describeSound(before,move(level,before,0,'right'),0),'swap');
 assert.equal(describeSound(before,move(level,before,0,'down'),0),'step');
});
test('载入页面及已静音的操作不会创建音频设备',async()=>{
 let creations=0;const storage={getItem:()=>JSON.stringify({enabled:false,volume:0.4,ambient:false}),setItem(){}};
 const audio=new Ambience({storage,contextFactory:()=>{creations++;return null;}});
 assert.equal(creations,0);assert.equal(await audio.unlock(),false);audio.action('step','warrior');audio.win();assert.equal(creations,0);
});
test('音量和静音偏好独立保存，异常音量不会传播到音频图',async()=>{
 const saved=new Map();const storage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
 const audio=new Ambience({storage,contextFactory:()=>null});audio.setVolume(3);assert.equal(audio.volume,1);audio.setVolume(-1);assert.equal(audio.volume,0);audio.setVolume(0.37);audio.setVolume(NaN);assert.equal(audio.volume,0.37);
 await audio.toggle();const restored=new Ambience({storage});assert.equal(restored.volume,0.37);assert.equal(restored.enabled,false);assert.equal(restored.ambientEnabled,false);assert.deepEqual([...saved.keys()],['sinking-star-audio-v1']);
});
test('音频设备不可用或创建失败时安静降级，不阻断游戏操作',async()=>{
 for(const factory of[()=>null,()=>{throw new Error('Device unavailable');}]){
  const audio=new Ambience({storage:{getItem(){},setItem(){}},contextFactory:factory});
  assert.equal(await audio.unlock(),false);assert.doesNotThrow(()=>{audio.action('push','warrior');audio.goal(true);audio.undo();});
 }
});
