const assert=require('node:assert/strict');
require('../assets/engine/aetheria-engine.js');
const Engine=globalThis.AetheriaEngine;
{
 const bus=new Engine.EventBus();let seen=0;const off=bus.on('spawn',()=>seen++);bus.emit('spawn');off();bus.emit('spawn');assert.equal(seen,1);assert.equal(bus.listenerCount('spawn'),0);
}
{
 const clock=new Engine.FixedStepClock({step:1/60,maxFrame:.1,maxSubSteps:5});let steps=0;const frame=clock.advance(1/30,()=>steps++);assert.equal(steps,2);assert.equal(frame.steps,2);assert.ok(frame.alpha>=0&&frame.alpha<1);
 const capped=clock.advance(1,()=>steps++);assert.ok(capped.steps<=5);assert.ok(capped.droppedTime>0);
}
{
 const input=new Engine.InputState();input.keys.add('w');input.keys.add('d');const axis=input.movement();assert.ok(Math.abs(Math.hypot(axis.x,axis.y)-1)<1e-9);assert.ok(axis.x>0&&axis.y>0);
}
{
 const scenes=new Engine.SceneRegistry();const a={children:[],traverse(fn){fn(this);}};const b={children:[],traverse(fn){fn(this);}};scenes.add('field',a);scenes.add('dungeon',b);assert.equal(scenes.get(),a);assert.equal(scenes.activate('dungeon').scene,b);assert.equal(scenes.remove('dungeon'),true);assert.equal(scenes.get(),a);
}
{
 const cache=new Engine.AssetCache();let calls=0;const loader=()=>{calls++;return Promise.resolve({ok:true});};Promise.all([cache.load('hero',loader),cache.load('hero',loader)]).then(values=>{assert.equal(calls,1);assert.equal(values[0],values[1]);console.log('Aetheria Engine Foundation: all tests passed.');}).catch(error=>{console.error(error);process.exitCode=1;});
}
