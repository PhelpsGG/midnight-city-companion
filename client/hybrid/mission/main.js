import 'pixi.js/unsafe-eval';
import {createPixiApplication} from '@/game/pixiApplication';
import {createPixiGame} from '@/game/createPixiGame';
import {createLiveActorsOverlay} from '@/game/liveActorsOverlay';
import {mapViewUrls,mapViewCameraClampOpts} from '@/game/districtMaps';
import {centerWorldPixelInView} from '@/game/mapCamera';
import {MissionClient,returnSummary} from './client.mjs';
import {mountEngineUI} from '../engine-ui.js';
let actors,game,app,following=true,ui,polling=false;
const api=new MissionClient(()=>update());
ui=mountEngineUI({api,runner:api,onFollow:()=>{following=!following;update();},isFollowing:()=>following,onReset:()=>{},onNext:()=>{}});
function update(){ui?.render();if(actors&&api.snapshot)actors.render(api.snapshot.world,'central');api.seen();}
async function observe(){if(polling)return;polling=true;try{await api.refresh();}finally{polling=false;}}
async function boot(){
 await api.initialize();update();
 const host=document.getElementById('world');app=await createPixiApplication(host);
 game=await createPixiGame(app,host,{...mapViewUrls('central'),spaceWidth:144,onManualNavigate:()=>{following=false;update();},getCameraFollowWorldPoint:()=>following?actors?.getAgentFollowWorldPos('rookie')??null:null});
 actors=createLiveActorsOverlay(game.world,{tileW:game.grid.mapTileW,tileH:game.grid.mapTileH},{onAgentClick:id=>ui.inspect(id)});
 game.world.scale.set(2.4);game.setTimeOfDay(18);update();document.getElementById('loading').hidden=true;
 app.ticker.add(t=>{actors.tick(t.deltaMS);if(following){const p=actors.getAgentFollowWorldPos('rookie');if(p)centerWorldPixelInView(app,game.world,game.grid.mapW*game.grid.mapTileW,game.grid.mapH*game.grid.mapTileH,p.x,p.y,{...mapViewCameraClampOpts('central'),snapToPixel:false});}});
 setInterval(()=>{if(document.visibilityState==='visible')void observe();},1000);
 document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'){
  let seen;try{seen=JSON.parse(localStorage.getItem('mcity-mission-seen'));}catch{}
  // Preserve the last visible checkpoint until the refreshed return summary is computed.
  const priorAway=api.away;api.away=priorAway||{actions:0,gains:[],items:[],firstVisit:false};
  await observe();api.away=priorAway||returnSummary(api.state,seen);update();
 }});
}
boot().catch(e=>{document.getElementById('loading').textContent='Sandbox unavailable: '+e.message;});
