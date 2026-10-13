import test from 'node:test';import assert from 'node:assert/strict';
import {goalPanel,journalPanel,aiPanel,actionLabel} from '../client/live/play-panel.mjs';
const session={mode:'sandbox',view:{controlled:true,agent:{position:{x:1,y:2}}},runtime:{mode:'running',goal:'<img src=x>',message:'Ready',jobs:[]},choices:[{label:'Craft plank',action:{kind:'craft',recipeId:'plank',batches:1},maxBatches:9}]};
test('play controls preserve explicit quantities, escaped goals and truthful outcome labels',()=>{
 assert.match(goalPanel(session),/&lt;img/);assert.match(goalPanel(session),/Craft batches/);assert.equal(actionLabel({kind:'craft',recipeId:'plank',batches:5}),'Craft 5 × Plank');
 const pending={...session,runtime:{...session.runtime,jobs:[{status:'pending',action:{kind:'craft',recipeId:'plank',batches:5},actor:'ai'}]}};
 assert.match(journalPanel(pending),/Pending/);assert.doesNotMatch(journalPanel(pending),/receipt verified/);assert.match(goalPanel(pending),/data-command="resume" disabled/);
 assert.match(aiPanel(session),/Enable AI connection/);assert.doesNotMatch(aiPanel({...session,view:{controlled:false}}),/Enable/);
});
