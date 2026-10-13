import {fixtureCatalog} from './fixture.mjs';
import {contractCatalog} from '../contracts/catalog.mjs';
import {projectContracts} from '../contracts/model.mjs';
export function missionProjection(state,staticWorld={}){
 const {renderingContent={},...geometry}=staticWorld,m=state.mission,p=m.pending,step=m.steps[m.cursor];
 const agent={...structuredClone(state.character),status:p?'working':'idle',activeAction:p?{...step.action,phase:'work'}:null,activeWork:p?step.action:null};
 const recentResults=state.receipts.map(r=>({requestId:r.id,status:'confirmed',action:r.action,message:r.label,receipt:r}));
 if(p)recentResults.push({requestId:p.id,status:p.receipt?'unknown':'pending',action:step.action,message:m.message||step.label});
 return {contracts:projectContracts(contractCatalog,state),view:{agent},world:{staticVersion:'durable-fixture-v1',sequence:state.revision,agentSeeds:[],staticWorld:{spaces:[],areas:[],...geometry,gameContent:{...renderingContent,...fixtureCatalog}},dynamicWorld:{tick:state.revision,timestamp:state.savedAt,tickRateMs:500,agents:[agent],resourceNodes:[],enemies:[],events:[],transitRoutes:[],npcs:[],merchants:[],conversations:[],activeEvents:[]}},sandbox:{worldId:state.worldId,tick:state.revision,catalog:{...fixtureCatalog,skills:fixtureCatalog.skillIds},recentResults,activeActions:p?{rookie:{action:step.action,phase:'work'}}:{},unresolvedResults:recentResults.filter(r=>r.status==='unknown')}};
}
