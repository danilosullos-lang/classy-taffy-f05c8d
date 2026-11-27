/* Aetheria Engine Foundation — modular runtime primitives.
 * The legacy game loop remains the owner of rendering; these primitives are
 * additive and can be adopted subsystem-by-subsystem without double RAF loops.
 */
(function(root){
  'use strict';
  const hasDOM=typeof document!=='undefined';
  class EventBus {
    constructor(){this.events=new Map();}
    on(type,listener){
      if(typeof listener!=='function')throw new TypeError('listener must be a function');
      const set=this.events.get(type)||new Set();set.add(listener);this.events.set(type,set);
      let active=true;return ()=>{if(!active)return;active=false;set.delete(listener);if(!set.size)this.events.delete(type);};
    }
    once(type,listener){let off;off=this.on(type,(payload)=>{off();listener(payload);});return off;}
    emit(type,payload){const set=this.events.get(type);if(!set)return 0;let count=0;for(const fn of [...set]){fn(payload);count++;}return count;}
    clear(type){if(type===undefined)this.events.clear();else this.events.delete(type);}
    listenerCount(type){return this.events.get(type)?.size||0;}
  }
  class FixedStepClock {
    constructor({step=1/60,maxFrame=.1,maxSubSteps=5}={}){
      if(!(step>0&&maxFrame>=step&&maxSubSteps>0))throw new RangeError('invalid fixed-step clock configuration');
      this.step=step;this.maxFrame=maxFrame;this.maxSubSteps=maxSubSteps;this.accumulator=0;this.elapsed=0;this.droppedTime=0;
    }
    advance(frameDelta,update){
      const delta=Math.max(0,Math.min(Number.isFinite(frameDelta)?frameDelta:0,this.maxFrame));
      this.droppedTime+=Math.max(0,(Number.isFinite(frameDelta)?frameDelta:0)-delta);
      this.accumulator+=delta;let steps=0;
      while(this.accumulator>=this.step&&steps<this.maxSubSteps){update(this.step);this.accumulator-=this.step;this.elapsed+=this.step;steps++;}
      if(steps===this.maxSubSteps&&this.accumulator>=this.step){const dropped=this.accumulator-(this.accumulator%this.step);this.accumulator%=this.step;this.droppedTime+=dropped;}
      return {steps,alpha:this.accumulator/this.step,delta,elapsed:this.elapsed,droppedTime:this.droppedTime};
    }
    reset(){this.accumulator=0;this.elapsed=0;this.droppedTime=0;}
  }
  class InputState {
    constructor(){this.keys=new Set();this.axes={x:0,y:0};this.pointer={x:0,y:0,buttons:0};this.attached=false;this._handlers=null;}
    attach(target=hasDOM?document:null){
      if(!target||this.attached)return this;
      const down=e=>{const key=String(e.key||'').toLowerCase();this.keys.add(key);if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault?.();};
      const up=e=>this.keys.delete(String(e.key||'').toLowerCase());
      const blur=()=>this.keys.clear();
      const pointer=e=>{this.pointer.x=e.clientX||0;this.pointer.y=e.clientY||0;this.pointer.buttons=e.buttons||0;};
      target.addEventListener('keydown',down);target.addEventListener('keyup',up);
      root.addEventListener?.('blur',blur);target.addEventListener('pointermove',pointer);
      this._handlers={target,down,up,blur,pointer};this.attached=true;return this;
    }
    pressed(...keys){return keys.some(key=>this.keys.has(String(key).toLowerCase()));}
    movement(){
      const x=(this.pressed('d','arrowright')?1:0)-(this.pressed('a','arrowleft')?1:0);
      const y=(this.pressed('w','arrowup')?1:0)-(this.pressed('s','arrowdown')?1:0);
      const length=Math.hypot(x,y)||1;this.axes={x:x/length,y:y/length};return {...this.axes};
    }
    dispose(){const h=this._handlers;if(h){h.target.removeEventListener('keydown',h.down);h.target.removeEventListener('keyup',h.up);h.target.removeEventListener('pointermove',h.pointer);root.removeEventListener?.('blur',h.blur);}this._handlers=null;this.attached=false;this.keys.clear();}
  }
  function disposeObject3D(object){
    if(!object)return;const geometries=new Set(),materials=new Set(),textures=new Set();
    object.traverse?.(node=>{
      if(node.geometry)geometries.add(node.geometry);
      const list=Array.isArray(node.material)?node.material:(node.material?[node.material]:[]);
      for(const material of list){materials.add(material);for(const value of Object.values(material)){if(value&&value.isTexture)textures.add(value);}}
      if(node.skeleton?.boneTexture)textures.add(node.skeleton.boneTexture);
    });
    textures.forEach(resource=>resource.dispose?.());materials.forEach(resource=>resource.dispose?.());geometries.forEach(resource=>resource.dispose?.());
    object.parent?.remove?.(object);
  }
  class SceneRegistry {
    constructor(){this.scenes=new Map();this.active=null;}
    add(id,scene){if(!id||!scene)throw new TypeError('scene id and object are required');if(this.scenes.has(id))throw new Error('scene already registered: '+id);this.scenes.set(id,scene);if(this.active===null)this.active=id;return scene;}
    get(id=this.active){return id===null?null:this.scenes.get(id)||null;}
    activate(id){if(!this.scenes.has(id))throw new Error('unknown scene: '+id);const previous=this.active;this.active=id;return {previous,current:id,scene:this.get(id)};}
    remove(id,{dispose=false}={}){const scene=this.scenes.get(id);if(!scene)return false;this.scenes.delete(id);if(dispose)disposeObject3D(scene);if(this.active===id)this.active=this.scenes.keys().next().value??null;return true;}
    clear({dispose=false}={}){if(dispose)for(const scene of this.scenes.values())disposeObject3D(scene);this.scenes.clear();this.active=null;}
  }
  class AssetCache {
    constructor(){this.entries=new Map();}
    load(key,loader){
      if(this.entries.has(key))return this.entries.get(key);
      const promise=Promise.resolve().then(loader).catch(error=>{this.entries.delete(key);throw error;});
      this.entries.set(key,promise);return promise;
    }
    has(key){return this.entries.has(key);}
    clear(){this.entries.clear();}
  }
  class EngineLoop {
    constructor({update,render,step=1/60,maxFrame=.1,maxSubSteps=5,onError}={}){
      if(typeof update!=='function'||typeof render!=='function')throw new TypeError('update and render callbacks are required');
      this.update=update;this.render=render;this.clock=new FixedStepClock({step,maxFrame,maxSubSteps});this.onError=onError||((error)=>{setTimeout(()=>{throw error;},0);});
      this.running=false;this.paused=false;this.raf=0;this.lastTime=0;this._frame=this._frame.bind(this);
    }
    start(){if(this.running)return this;this.running=true;this.paused=false;this.lastTime=0;this.raf=root.requestAnimationFrame(this._frame);return this;}
    _frame(time){if(!this.running)return;if(!this.paused){const delta=this.lastTime?Math.max(0,(time-this.lastTime)/1000):0;this.lastTime=time;try{const info=this.clock.advance(delta,this.update);this.render(info.delta,info.alpha);}catch(error){this.stop();this.onError(error);return;}}else this.lastTime=time;this.raf=root.requestAnimationFrame(this._frame);}
    pause(){this.paused=true;return this;}
    resume(){this.paused=false;this.lastTime=0;return this;}
    stop(){this.running=false;if(this.raf)root.cancelAnimationFrame?.(this.raf);this.raf=0;this.lastTime=0;return this;}
  }
  function createRenderer(THREE,canvas,{pixelRatioCap=1.75,antialias=true,alpha=false}={}){
    if(!THREE?.WebGLRenderer)throw new Error('Three.js WebGLRenderer is required');
    const renderer=new THREE.WebGLRenderer({canvas,antialias,alpha,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,pixelRatioCap));
    const resize=(width,height)=>{const w=Math.max(1,width||root.innerWidth||1),h=Math.max(1,height||root.innerHeight||1);renderer.setSize(w,h,false);return {width:w,height:h,aspect:w/h};};
    const observer=hasDOM&&root.ResizeObserver&&canvas?new root.ResizeObserver(entries=>{const rect=entries[0]?.contentRect;if(rect)resize(rect.width,rect.height);}):null;
    if(observer&&canvas.parentElement)observer.observe(canvas.parentElement);
    else if(hasDOM)root.addEventListener('resize',resize);
    resize(canvas?.clientWidth,canvas?.clientHeight);
    return {renderer,resize,dispose(){observer?.disconnect();if(!observer&&hasDOM)root.removeEventListener('resize',resize);renderer.dispose();}};
  }
  const api=Object.freeze({version:'1.0.0',EventBus,FixedStepClock,InputState,SceneRegistry,AssetCache,EngineLoop,disposeObject3D,createRenderer});
  root.AetheriaEngine=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
