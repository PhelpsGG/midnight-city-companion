import test from 'node:test';
import assert from 'node:assert/strict';
import {rendererSources} from '../scripts/renderer-source.mjs';
test('extracts application source only and rejects traversal or malformed maps',()=>{
 assert.deepEqual(rendererSources({sources:['../../src/game/map.ts','../../node_modules/lib/x.js','../../assets-source/data.json'],sourcesContent:['export const x=1','ignore','{}']}),[{path:'src/game/map.ts',content:'export const x=1'},{path:'assets-source/data.json',content:'{}'}]);
 assert.throws(()=>rendererSources({sources:['../../src/../../escape.js'],sourcesContent:['bad']}));
 assert.throws(()=>rendererSources({sources:['../../src/test.js'],sourcesContent:[]}));
});
