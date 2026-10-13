import test from 'node:test';
import assert from 'node:assert/strict';
import {readGoalTarget,writeGoalTarget} from './goal-preference.mjs';
const store=()=>{const values=new Map();return {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};};
test('goal preference survives reload only for its sandbox world',()=>{const s=store();writeGoalTarget(s,'world-a',2);assert.equal(readGoalTarget(s,'world-a'),2);assert.equal(readGoalTarget(s,'world-b'),1);});
test('malformed and inaccessible storage safely use the starter goal',()=>{const s=store();s.setItem('hybrid-goal','bad');assert.equal(readGoalTarget(s,'world-a'),1);s.setItem('hybrid-goal',JSON.stringify({worldId:'world-a',target:-4}));assert.equal(readGoalTarget(s,'world-a'),1);assert.equal(readGoalTarget(null,'world-a'),1);assert.doesNotThrow(()=>writeGoalTarget(null,'world-a',2));});
