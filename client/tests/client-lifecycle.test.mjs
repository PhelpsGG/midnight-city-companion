import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldFeed, markerPosition, visibleMapBounds } from '../player/lifecycle.mjs';

function harness() {
  const sources=[], timers=new Map(), statuses=[], snapshots=[];let key=0;
  const feed=createWorldFeed({open(){const handlers={};const source={closed:false,addEventListener(k,fn){handlers[k]=fn;},close(){this.closed=true;},emit(k,value){if(k==='error')this.onerror?.();else handlers[k]?.({data:JSON.stringify(value)});}};sources.push(source);return source;},
    schedule(fn,ms){timers.set(++key,{fn,ms});return key;},cancel(id){timers.delete(id);},
    onStatus(s){statuses.push(s);},onSnapshot(s){snapshots.push(s);},onDelta(d){if(d.gap)throw new Error('sequence gap');}});
  return {feed,sources,timers,statuses,snapshots,next(){const [id,timer]=[...timers][0];timers.delete(id);timer.fn();return timer.ms;}};
}

test('failed feed retries with backoff, accepts a fresh snapshot and cancels a queued retry on manual restart',()=>{
  const h=harness();h.feed.start();h.sources[0].emit('error');
  assert.equal(h.sources[0].closed,true);assert.equal(h.feed.state,'retrying');assert.equal(h.next(),1000);
  h.sources[1].emit('error');assert.equal([...h.timers.values()][0].ms,2000);
  h.feed.start();assert.equal(h.timers.size,0);assert.equal(h.sources.length,3);
  h.sources[2].emit('snapshot',{sequence:23});assert.equal(h.feed.state,'live');assert.deepEqual(h.snapshots,[{sequence:23}]);
  h.sources[0].emit('snapshot',{sequence:1});assert.deepEqual(h.snapshots,[{sequence:23}]);
});

test('repeated failures stop after five retries; dispose prevents late events and new reconnects',()=>{
  const h=harness();h.feed.start();
  for(let i=0;i<5;i++){h.sources.at(-1).emit('error');h.next();}
  h.sources.at(-1).emit('error');assert.equal(h.feed.state,'stopped');assert.equal(h.timers.size,0);assert.equal(h.sources.length,6);
  h.feed.start();h.feed.dispose();h.sources.at(-1).emit('snapshot',{sequence:40});h.feed.start();
  assert.equal(h.snapshots.length,0);assert.equal(h.sources.length,7);assert.equal(h.feed.state,'stopped');
});

test('delta gaps restart observation rather than applying subsequent patches to an invalid baseline',()=>{
  const h=harness();h.feed.start();h.sources[0].emit('snapshot',{sequence:2});h.sources[0].emit('delta',{gap:true});
  assert.equal(h.feed.state,'retrying');assert.equal(h.sources[0].closed,true);h.next();h.sources[1].emit('snapshot',{sequence:8});assert.equal(h.feed.state,'live');
});

test('follow label stays inside available map and its pointer remains on the nearest edge',()=>{
  const bounds={left:12,top:80,right:1000,bottom:730};
  assert.deepEqual(markerPosition({x:0,y:160},bounds,{width:160,height:32}),{x:92,y:148,arrow:12});
  assert.deepEqual(markerPosition({x:1200,y:900},bounds,{width:160,height:32}),{x:920,y:730,arrow:148});
  assert.deepEqual(markerPosition({x:400,y:60},bounds,{width:160,height:32}),{x:400,y:112,arrow:80});
});

test('follow camera uses the unobscured map beside desktop panel or above mobile panel',()=>{
  assert.deepEqual(visibleMapBounds({width:1400,height:850,panel:{left:1000,top:98,right:1378,bottom:754},headerBottom:74,footerTop:778}),{left:12,top:86,right:988,bottom:766});
  assert.deepEqual(visibleMapBounds({width:390,height:844,panel:{left:20,top:286,right:380,bottom:752},headerBottom:72,footerTop:778}),{left:12,top:84,right:378,bottom:274});
});
