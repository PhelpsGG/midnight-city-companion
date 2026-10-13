import test from 'node:test';
import assert from 'node:assert/strict';
import {contractsPanel} from './panel.mjs';
import {projectContracts} from './model.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpers={esc,icon:()=>'',name:id=>id};
const saved={contracts:[{id:'one',name:'<img src=x onerror=bad()>',skill:'engineering',requiredLevel:3,requirements:[{itemId:'wire',quantity:2}],rewards:[{itemId:'crystal',quantity:4}],xp:80,areaId:'workshop'}],items:[]};
const state={character:{skills:{engineering:{level:2}},inventory:{wire:1},completedContractIds:[]},receipts:[]};
test('contract detail escapes catalog text and separates unmet requirements from offered rewards',()=>{
 const p=projectContracts(saved,state),html=contractsPanel(p,{selected:'one'},helpers,{});
 assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
 assert.match(html,/1\s*<em>\s*\/\s*2/);assert.match(html,/3/);assert.match(html,/Listed rewards/);
 assert.match(html,/not connected/);assert.ok(!html.includes('Earned rewards'));
 assert.match(html,/data-guide="location" data-id="workshop"/);assert.match(html,/data-guide="skill" data-id="engineering"/);
});
test('completed detail with no receipt does not present catalog rewards as earned',()=>{
 const s=structuredClone(state);s.character.completedContractIds=['one'];
 const html=contractsPanel(projectContracts(saved,s),{selected:'one'},helpers,{});
 assert.match(html,/Date not recorded/);assert.match(html,/Reward receipt not recorded/);
 assert.match(html,/Listed rewards/);assert.ok(!html.includes('Earned rewards'));
});
