const assert=require('node:assert/strict');
require('../assets/engine/cloud-sync-queue.js');
const {CloudSyncQueue}=globalThis.AetheriaCloudSyncQueue;
class Clock{
  constructor(){this.now=0;this.next=1;this.jobs=new Map();}
  setTimer(fn,delay){const id=this.next++;this.jobs.set(id,{fn,at:this.now+delay});return id;}
  clearTimer(id){this.jobs.delete(id);}
  async advance(ms){
    const target=this.now+ms;
    for(;;){
      let chosen=null;
      for(const [id,job] of this.jobs){if(job.at<=target&&(!chosen||job.at<chosen.job.at))chosen={id,job};}
      if(!chosen)break;
      this.jobs.delete(chosen.id);this.now=chosen.job.at;chosen.job.fn();
      await Promise.resolve();await Promise.resolve();await Promise.resolve();
    }
    this.now=target;await Promise.resolve();await Promise.resolve();await Promise.resolve();
  }
}
(async()=>{
  {
    const clock=new Clock();let runs=0;
    const queue=new CloudSyncQueue({run:async()=>{runs++;},delay:100,setTimer:clock.setTimer.bind(clock),clearTimer:clock.clearTimer.bind(clock)});
    assert.equal(queue.schedule(),true);assert.equal(queue.schedule(),true);
    await clock.advance(99);assert.equal(runs,0);
    await clock.advance(1);assert.equal(runs,1,'multiple local saves collapse into one debounced cloud write');
    queue.dispose();
  }
  {
    const clock=new Clock();let runs=0,release;
    const queue=new CloudSyncQueue({run:()=>{runs++;if(runs===1)return new Promise(resolve=>{release=resolve;});return Promise.resolve();},delay:10,setTimer:clock.setTimer.bind(clock),clearTimer:clock.clearTimer.bind(clock)});
    queue.schedule();await clock.advance(10);assert.equal(runs,1);
    queue.schedule();await clock.advance(10);assert.equal(runs,1,'a second flush cannot overlap an in-flight request');
    release();await Promise.resolve();await Promise.resolve();await Promise.resolve();
    await clock.advance(10);assert.equal(runs,2,'a save made during the request is sent afterward');
    queue.dispose();
  }
  {
    const clock=new Clock();let runs=0;
    const queue=new CloudSyncQueue({run:async()=>{runs++;if(runs===1)throw Object.assign(new Error('temporary'),{status:503});},delay:10,retryBase:100,maxRetries:2,setTimer:clock.setTimer.bind(clock),clearTimer:clock.clearTimer.bind(clock)});
    queue.schedule();await clock.advance(10);assert.equal(runs,1);
    await clock.advance(99);assert.equal(runs,1);
    await clock.advance(1);assert.equal(runs,2,'temporary server errors retry with bounded exponential backoff');
    queue.dispose();
  }
  {
    const clock=new Clock();let runs=0,blocked=0;
    const queue=new CloudSyncQueue({run:async()=>{runs++;throw Object.assign(new Error('character_revision_conflict'),{status:409});},delay:10,onState:state=>{if(state==='blocked')blocked++;},setTimer:clock.setTimer.bind(clock),clearTimer:clock.clearTimer.bind(clock)});
    queue.schedule();await clock.advance(10);assert.equal(runs,1);assert.equal(blocked,1);assert.equal(queue.paused,true);
    assert.equal(queue.schedule(),false,'conflicts pause automatic overwrite attempts');
    queue.dispose();
  }
  {
    const clock=new Clock();let runs=0;
    const queue=new CloudSyncQueue({run:async()=>{runs++;},delay:10,setTimer:clock.setTimer.bind(clock),clearTimer:clock.clearTimer.bind(clock)});
    queue.schedule();queue.pause();await clock.advance(20);assert.equal(runs,0,'disabling auto-sync cancels pending work');
    queue.resume({schedule:true});await clock.advance(10);assert.equal(runs,1,'explicit opt-in resumes with a fresh save');
    queue.dispose();
  }
  console.log('Aetheria cloud sync queue: debounce, serialization, retry, conflict pause and opt-in resume passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
