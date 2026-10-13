// Read-only feed recovery. This module has no access to character action routes.
export function createWorldFeed({open=()=>new EventSource('/stream'),onSnapshot,onDelta,onStatus=()=>{},schedule=setTimeout,cancel=clearTimeout}) {
  let source=null,timer=null,generation=0,attempts=0,disposed=false,state='stopped';
  const status=(next,message)=>{state=next;onStatus({state,message});};
  function close(){generation++;source?.close();source=null;if(timer!==null)cancel(timer);timer=null;}
  function retry(reason='Connection interrupted') {
    if(disposed||state==='retrying'||state==='stopped')return;
    close();
    if(attempts>=5){status('stopped',`${reason}. Reconnect the live view to try again.`);return;}
    const delay=Math.min(30000,1000*2**attempts++);
    status('retrying',`${reason} · reconnecting in ${delay/1000}s`);
    timer=schedule(()=>{timer=null;connect();},delay);
  }
  function connect(){
    if(disposed)return;
    close();const version=generation;
    status('connecting','Connecting to the live city…');
    try{
      source=open();
      const listen=(kind,handler)=>source.addEventListener(kind,event=>{
        if(version!==generation||disposed)return;
        try{handler(JSON.parse(event.data));}catch{retry('World update unavailable');}
      });
      listen('snapshot',data=>{onSnapshot(data);attempts=0;status('live','Live city · continuous updates');});
      listen('delta',data=>{onDelta(data);status('live','Live city · continuous updates');});
      listen('finished',()=>retry('World connection ended'));
      source.onerror=()=>{if(version===generation)retry();};
    }catch{retry();}
  }
  return {get state(){return state;},start(){if(disposed)return;attempts=0;connect();},retry,
    dispose(){disposed=true;close();status('stopped','Observation stopped');}};
}

export function visibleMapBounds({width,height,panel,headerBottom=0,footerTop=height}) {
  const bounds={left:12,top:headerBottom+12,right:width-12,bottom:footerTop-12};
  if(panel){
    if(panel.left>=width*.5)bounds.right=Math.min(bounds.right,panel.left-12);
    else bounds.bottom=Math.min(bounds.bottom,panel.top-12);
  }
  // Keep camera math valid on short windows even when controls fill the screen.
  bounds.right=Math.max(bounds.left+32,bounds.right);
  bounds.bottom=Math.max(bounds.top+32,bounds.bottom);
  return bounds;
}

export function markerPosition(anchor,bounds,{width,height}) {
  const clamp=(n,min,max)=>Math.max(min,Math.min(Math.max(min,max),n));
  const x=clamp(anchor.x,bounds.left+width/2,bounds.right-width/2);
  return {x,y:clamp(anchor.y-12,bounds.top+height,bounds.bottom),arrow:clamp(anchor.x-(x-width/2),12,width-12)};
}
// A deliberate command may wait behind one read. Once it reserves that turn,
// additional clicks/polls are ignored; no mutation is retried or auto-repeated.
export function createRequestGate() {
  let current=null;
  return {async run(task,{quiet=false}={}) {
    if(current){
      if(quiet||!current.quiet)return;
      const reading=current;reading.quiet=false;
      await reading.promise.catch(()=>{});
    }
    const entry={quiet,promise:null};current=entry;
    entry.promise=Promise.resolve().then(task);
    try{return await entry.promise;}finally{if(current===entry)current=null;}
  }};
}
