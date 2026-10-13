import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneRouter, followDestination } from '../player/scene-router.mjs';
const world={staticWorld:{spaces:[{id:'central',width:144,basemap:{district:'central'}},{id:'construction-yard',width:160,basemap:{district:'construction-yard'}},{id:'room',width:24,basemap:{district:'iog-house-interior'}}]}};
const destination=id=>followDestination(world,{position:{spaceId:id}},key=>['central','iog-house-interior'].includes(key));
test('follow uses authored space mapping and the separate Construction Yard renderer',()=>{
  assert.equal(destination('central').renderer,'pixi');
  assert.equal(destination('construction-yard').renderer,'neon');
  assert.equal(destination('room').mapView,'iog-house-interior');
  assert.equal(destination('room').spaceId,'room');
  assert.equal(destination('unknown'),null);
});
test('rapid area changes dispose obsolete scenes and only display the latest destination',async()=>{
  const pending=[],disposed=[],shown=[];
  const router=createSceneRouter({load:target=>new Promise(resolve=>pending.push({target,resolve})),onReady:(scene,target)=>shown.push(target.key)});
  const a=destination('central'),b=destination('construction-yard');
  router.request(a);router.request(b);
  assert.equal(pending.length,1);
  pending[0].resolve({dispose:()=>disposed.push('central')});
  await new Promise(setImmediate);
  assert.deepEqual(disposed,['central']);assert.equal(pending[1].target.key,b.key);
  pending[1].resolve({dispose:()=>disposed.push('yard')});await router.settled();
  assert.deepEqual(shown,[b.key]);
  router.request(b);assert.equal(pending.length,2);
  router.dispose();assert.deepEqual(disposed,['central','yard']);
});
test('failed loads remain retryable and disposal during loading never publishes a scene',async()=>{
  let fail=true,ready=0,disposed=0;const errors=[];
  const router=createSceneRouter({load:async()=>{if(fail)throw Error('asset missing');return {dispose(){disposed++;}};},onReady:()=>ready++,onError:e=>errors.push(e.message)});
  router.request(destination('central'));await router.settled();assert.deepEqual(errors,['asset missing']);
  fail=false;router.request(destination('central'),{retry:true});await router.settled();assert.equal(ready,1);
  router.request(destination('central'),{retry:true});await router.settled();assert.equal(ready,2);assert.equal(disposed,1);
  router.request(destination('room'));router.dispose();await router.settled();assert.equal(ready,2);assert.equal(disposed,3);
});
