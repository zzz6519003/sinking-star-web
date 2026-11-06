import {solve} from './engine.js';
self.onmessage=({data})=>{const solution=solve(data.level,data.state,65000);self.postMessage({solution});};
