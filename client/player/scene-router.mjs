// Renderer selection follows authored observer space metadata, never guessed coordinates.
export function followDestination(world,agent,isMapViewId) {
  const space=world?.staticWorld?.spaces?.find(s=>s.id===agent?.position?.spaceId);
  if(!space)return null;
  const mapView=space.basemap?.district?.toLowerCase();
  const renderer=mapView==='construction-yard'?'neon':isMapViewId(mapView)?'pixi':null;
  if(!renderer)return null;
  return {key:`${renderer}:${mapView}:${space.id}:${space.width}:${space.height??0}`,renderer,mapView,spaceId:space.id,spaceWidth:space.width,name:space.name||space.id};
}

// One GPU scene loads at a time. A late result can never replace a newer request.
export function createSceneRouter({load,onReady=()=>{},onLoading=()=>{},onError=()=>{},onClear=()=>{}}) {
  let wanted=null,current=null,pending=null,failed=null,disposed=false;
  async function drain(){
    while(!disposed&&wanted&&current?.target.key!==wanted.key&&failed!==wanted.key){
      const target=wanted;
      onClear();current?.scene.dispose();current=null;onLoading(target);
      try{
        const scene=await load(target);
        if(disposed||wanted.key!==target.key){scene.dispose();continue;}
        current={scene,target};onReady(scene,target);
      }catch(error){if(!disposed&&wanted.key===target.key){failed=target.key;onError(error,target);}}
    }
  }
  return {
    request(target,{retry=false}={}){
      if(disposed||!target)return;
      wanted=target;if(retry)failed=null;
      if(retry&&current?.target.key===target.key){onClear();current.scene.dispose();current=null;}
      if(!pending)pending=drain().finally(()=>{pending=null;});
    },
    async settled(){await pending;},
    dispose(){disposed=true;onClear();current?.scene.dispose();current=null;},
  };
}
