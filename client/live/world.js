import 'pixi.js/unsafe-eval';
import {createPixiApplication,destroyPixiApplication} from '@/game/pixiApplication';
import {createPixiGame} from '@/game/createPixiGame';
import {createLiveActorsOverlay} from '@/game/liveActorsOverlay';
import {setV2CustomAppearanceProvider,setSheetLayoutProvider,publicAppearanceForAgentId} from '@/game/v2CharacterAppearances';
import {applyObserverDelta} from '@/net/observerClient';
import {selectStreetTvSync,resolveLightingAtTimestamp} from '@/game/mapOverlayAnchors';
import {centerWorldPixelInView} from '@/game/mapCamera';
import {mapViewUrls,mapViewCameraClampOpts,isMapViewId} from '@/game/districtMaps';
import {createWorldFeed} from '../player/lifecycle.mjs';
import {createSceneRouter,followDestination} from '../player/scene-router.mjs';
import {worldForRenderer,resolvePlayer} from '../player/model.mjs';

export function createWorld(host,loading,onFollow){
 const welcome=host.innerHTML;
 let app,game,actors,world,worldAt=0,view,feed,router,following=true,spaceId,mapView,generation=0,initialized=null;
 const marker=document.createElement('div');marker.id='follow-marker';marker.hidden=true;document.body.append(marker);
 const rendered=()=>worldForRenderer(world,{...view,connected:Boolean(view?.agent),mode:'live'},worldAt>(view?.receivedAt??0));
 const selected=()=>resolvePlayer({world,view:{...view,connected:Boolean(view?.agent)},selectedId:view?.agent?.id,worldFresh:worldAt>(view?.receivedAt??0)}).agent;
 function locate(){
  if(!world||!router)return;const agent=selected();if(!agent?.position)return;
  const target=followDestination(world,agent,isMapViewId);
  if(!target||target.renderer==='neon'){if(app)app.canvas.hidden=true;loading.hidden=false;loading.textContent='This character’s area is not supported by this portable renderer yet.';return;}
  if(app)app.canvas.hidden=false;
  if(following||!game)router.request(target);
 }
 function render(){if(!world)return;locate();if(actors&&game){actors.render(rendered(),mapView);const env=selectStreetTvSync(world),light=resolveLightingAtTimestamp(env?.timestampMs??Date.now());game.setTimeOfDay(light.gameHours);game.setRain(env?.weather==='rain'?Math.max(0,Math.min(1,env.rainIntensity/100)):0);}}
 async function boot(id){
  const version=++generation;loading.hidden=false;loading.textContent='Loading the native city…';host.replaceChildren();
  const response=await fetch('/api/agent-look/appearance');if(!response.ok)throw Error('Character appearance data is unavailable.');
  const appearances=new Map(Object.entries(await response.json()));if(version!==generation)return;
  setV2CustomAppearanceProvider(id=>publicAppearanceForAgentId(appearances,id));setSheetLayoutProvider(id=>[...appearances.values()].find(a=>a.characterSheetId===id)?.sheetLayout??null);
  const created=await createPixiApplication(host);if(version!==generation){destroyPixiApplication(created);return;}app=created;
  router=createSceneRouter({onClear:()=>{game=null;actors=null;marker.hidden=true;},onLoading:t=>{loading.hidden=false;loading.textContent=`Loading ${t.name}…`;},onError:()=>{loading.hidden=false;loading.textContent='Map unavailable. Select Follow to retry.';},load:async t=>{
   const g=await createPixiGame(app,host,{...mapViewUrls(t.mapView),spaceWidth:t.spaceWidth,onManualNavigate:()=>{following=false;onFollow(false);},getCameraFollowWorldPoint:()=>following?actors?.getAgentFollowWorldPos(view?.agent?.id)??null:null});
   const overlay=createLiveActorsOverlay(g.world,{tileW:g.grid.mapTileW,tileH:g.grid.mapTileH},{onAgentClick:()=>{}});return {game:g,actors:overlay,dispose(){overlay.destroy();g.dispose();}};
  },onReady:(s,t)=>{game=s.game;actors=s.actors;spaceId=t.spaceId;mapView=t.mapView;game.world.scale.set(2.4);loading.hidden=true;render();}});
  feed=createWorldFeed({onSnapshot:w=>{world=w;worldAt=Date.now();render();},onDelta:d=>{const next=world&&applyObserverDelta(world,d);if(!next)throw Error('World sequence changed');world=next;worldAt=Date.now();render();},onStatus:s=>{if(s.state==='stopped'||s.state==='retrying'){loading.hidden=false;loading.textContent=s.message;}}});feed.start();
  app.ticker.add(t=>{actors?.tick(t.deltaMS);marker.hidden=true;if(!following||!game||!actors)return;const p=actors.getAgentFollowWorldPos(view?.agent?.id);if(p){centerWorldPixelInView(app,game.world,game.grid.mapW*game.grid.mapTileW,game.grid.mapH*game.grid.mapTileH,p.x,p.y,{...mapViewCameraClampOpts(mapView),snapToPixel:false});const anchor=actors.getAgentAnchorInHostCss(view.agent.id,host,app);if(anchor){marker.textContent=view.agent.name||view.agent.id;const bounds=host.getBoundingClientRect();marker.style.left=(bounds.left+anchor.x)+'px';marker.style.top=(bounds.top+anchor.y-8)+'px';marker.hidden=false;}}});
 }
 function clear(){generation++;feed?.dispose();feed=null;router?.dispose();router=null;if(app)destroyPixiApplication(app);app=null;game=null;actors=null;world=null;view=null;initialized=null;marker.hidden=true;loading.hidden=true;host.innerHTML=welcome;}
 return {get snapshot(){return world;},set(next){const changed=view?.agent?.id!==next?.agent?.id;view=next;if(!next?.agent){if(initialized)clear();return;}if(changed){following=true;onFollow(true);}if(!initialized){initialized=boot(next.agent.id).catch(()=>{if(!view?.agent)return;loading.hidden=false;loading.textContent='Native world unavailable. Character data remains available; refresh the page to retry.';});}else render();},follow(){following=true;onFollow(true);if(router&&world){const target=followDestination(world,selected(),isMapViewId);if(target?.renderer==='pixi')router.request(target,{retry:!game});}if(feed?.state==='stopped')feed.start();render();},clear};
}
