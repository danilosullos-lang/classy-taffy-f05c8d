/* Optional, debounced cloud-save queue. Local persistence remains independent. */
(function(root){
  'use strict';
  class CloudSyncQueue {
    constructor({run,delay=1600,maxRetries=5,retryBase=1000,maxDelay=30000,onState=()=>{},setTimer,clearTimer}={}){
      if(typeof run!=='function')throw new TypeError('cloud_sync_run_required');
      this.run=run;
      this.delay=Math.max(0,Number(delay)||0);
      this.maxRetries=Math.max(0,Math.floor(Number(maxRetries)||0));
      this.retryBase=Math.max(1,Number(retryBase)||1000);
      this.maxDelay=Math.max(this.retryBase,Number(maxDelay)||30000);
      this.onState=typeof onState==='function'?onState:()=>{};
      this.setTimer=setTimer||((fn,ms)=>setTimeout(fn,ms));
      this.clearTimer=clearTimer||((id)=>clearTimeout(id));
      this.timer=null;
      this.pending=false;
      this.running=false;
      this.paused=false;
      this.disposed=false;
      this.retries=0;
    }
    _emit(state,error,result){try{this.onState(state,error||null,result);}catch(_){}}
    _arm(ms){
      if(this.timer!==null)this.clearTimer(this.timer);
      this.timer=this.setTimer(()=>{this.timer=null;void this.flush();},ms);
    }
    schedule(){
      if(this.disposed||this.paused)return false;
      this.pending=true;
      this.retries=0;
      this._arm(this.delay);
      this._emit('scheduled');
      return true;
    }
    async flush(){
      if(this.disposed||this.paused||this.running||!this.pending)return false;
      this.pending=false;
      this.running=true;
      this._emit('syncing');
      try{
        const result=await this.run();
        if(this.disposed)return false;
        this.retries=0;
        this._emit('synced',null,result);
        return true;
      }catch(error){
        if(this.disposed)return false;
        // A logout or explicit opt-out while the request was in flight must not
        // turn its late network failure into a background retry after pause.
        if(this.paused){
          this.pending=false;
          this._emit('paused',error);
          return false;
        }
        const status=Number(error&&error.status)||0;
        const retryable=!status||status===408||status===425||status===429||status>=500;
        if(retryable&&this.retries<this.maxRetries){
          this.retries++;
          this.pending=true;
          const wait=Math.min(this.maxDelay,this.retryBase*Math.pow(2,this.retries-1));
          this._emit('retry',error);
          this._arm(wait);
        }else{
          this.paused=true;
          this.pending=false;
          this._emit('blocked',error);
        }
        return false;
      }finally{
        this.running=false;
        if(this.pending&&this.timer===null&&!this.paused&&!this.disposed)this._arm(this.delay);
      }
    }
    pause({clearPending=true}={}){
      this.paused=true;
      if(this.timer!==null)this.clearTimer(this.timer);
      this.timer=null;
      if(clearPending)this.pending=false;
      this._emit('paused');
    }
    resume({schedule=true}={}){
      if(this.disposed)return false;
      this.paused=false;
      this.retries=0;
      if(schedule)return this.schedule();
      this._emit('resumed');
      return true;
    }
    dispose(){
      this.disposed=true;
      this.pending=false;
      if(this.timer!==null)this.clearTimer(this.timer);
      this.timer=null;
      this._emit('disposed');
    }
  }
  root.AetheriaCloudSyncQueue=Object.freeze({CloudSyncQueue,create:options=>new CloudSyncQueue(options)});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.AetheriaCloudSyncQueue;
})(typeof window!=='undefined'?window:globalThis);
