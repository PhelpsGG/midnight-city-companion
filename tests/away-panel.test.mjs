import test from 'node:test';import assert from 'node:assert/strict';
import {awayPanel} from '../client/live/away-panel.mjs';
const report={id:'test',name:'<River>',from:1000,to:61000,skills:[{id:'crafting',xp:50,levels:1,fromLevel:1,toLevel:2}],items:[{id:'plank',before:0,after:5,net:5}],flows:{earned:{plank:5},consumed:{wood:5}},contracts:['starter'],social:{messages:2,threads:1,partners:1,connections:null},eventCount:3,gaps:['Some history is missing.']};
test('welcome report displays gains, levels, provenance, separate receipt/net columns and honest social gaps',()=>{
 const html=awayPanel(report,{mode:'sandbox',names:new Map(),icon:()=>''});
 for(const text of ['While you were away','+50','1 → 2','Collected','Used','Net change','Connections not reported','Some history is missing.','SYNTHETIC SANDBOX','Continue playing','Review activity'])assert.ok(html.includes(text),text);
 assert.match(html,/&lt;River&gt;/);assert.doesNotMatch(html,/<River>/);
});
