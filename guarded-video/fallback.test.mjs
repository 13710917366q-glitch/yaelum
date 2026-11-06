import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({});
vm.runInContext(await readFile(new URL('../r2-fallback.js',import.meta.url),'utf8'),context);
function fixture(){
  const video=new EventTarget();video.paused=false;video.currentTime=0;
  let next=0;const jobs=new Map(),reasons=[];
  const timers={setTimeout(fn){jobs.set(++next,fn);return next;},clearTimeout(id){jobs.delete(id);}};
  const guard=context.YaelumVideoFallback(video,reason=>reasons.push(reason),timers);
  return {video,jobs,reasons,guard,emit(name){video.dispatchEvent(new Event(name));},tick(){for(const [id,fn] of [...jobs]){jobs.delete(id);fn();}}};
}
test('initial timeout falls back once and removes listeners',()=>{const f=fixture();f.tick();f.emit('error');f.tick();assert.equal(f.reasons.length,1);assert.equal(f.jobs.size,0);});
test('network error falls back immediately exactly once',()=>{const f=fixture();f.emit('error');f.emit('error');assert.equal(f.reasons.length,1);assert.equal(f.jobs.size,0);});
test('paused, autoplay blocked, ended and closed videos do not time out',()=>{
  for(const action of ['pause','ended','blocked','stop']){const f=fixture();if(action==='blocked'||action==='stop')f.guard[action]();else f.emit(action);f.tick();assert.equal(f.reasons.length,0);}
});
test('play resumes timeout after user unpauses; ongoing playback refreshes timer',()=>{const f=fixture();f.emit('pause');f.emit('play');assert.equal(f.jobs.size,1);for(let n=0;n<10;n++){f.video.currentTime+=1;f.emit('timeupdate');assert.equal(f.jobs.size,1);}f.tick();assert.equal(f.reasons.length,1);});
