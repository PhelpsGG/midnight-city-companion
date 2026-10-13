import {landmarks} from './locations.mjs';
export const syntheticItems=[{id:'sandbox_ration',name:'Practice ration · synthetic',category:'food',synthetic:true,maxQuantity:20,consumable:{hungerReduction:35,healthRecovery:5},tool:null,equipment:null}];
export const mechanics={version:'sandbox-mechanics-v1',needs:{optional:true,hungerEveryTicks:20,hungerPerInterval:1,restHealthPerTick:2,maxRestTicks:30},food:{itemId:'sandbox_ration',hungerReduction:35,healthRecovery:5},movement:{tilesPerTick:1,portals:'synthetic',collisions:'synthetic blocked cells'},stop:'Stops pending work at its current position. No unfinished production costs or rewards are applied.'};
export const coverage=[
  {id:'production',evidence:'observed-catalog',description:'Two sources, one recipe, one contract and their XP/inputs/outputs use the captured catalog and production engine.'},
  {id:'locations',evidence:'mixed',description:'Central, Construction Yard and Good Times dimensions are published. Routes, portals, actor placement and collision cells are synthetic test rules.'},
  {id:'needs',evidence:'synthetic',description:'Optional hunger growth, practice ration and rest recovery are test mechanics, not verified Midnight City values.'},
  {id:'commerce',evidence:'synthetic',description:'Practice trader prices and finite stocks are fixed synthetic quotes. No live purchases, market quotes or player trades.'},
  {id:'equipment',evidence:'mixed',description:'One observed salvage tool and level requirement; explicit equip ownership and cancellation are local models.'},
];
export const quoteVersion='synthetic-2026-10-11-v1';
export const merchantDefinition={id:'practice-trader',name:'Practice trader · synthetic',position:landmarks.find(l=>l.id==='practice-trader').position,quoteVersion,synthetic:true,quotes:[
  {itemId:'sandbox_ration',buy:2,sell:1,initialStock:20},
  {itemId:'scrap_steel',buy:2,sell:1,initialStock:20},
  {itemId:'copper_wiring',buy:2,sell:1,initialStock:20},
  {itemId:'cinder_salvage_kit',buy:40,sell:20,initialStock:3},
]};
export const initialMerchantStock=()=>({crystal:10000,...Object.fromEntries(merchantDefinition.quotes.map(q=>[q.itemId,q.initialStock]))});
export function merchants(stock){return [{...merchantDefinition,quotes:merchantDefinition.quotes.map(({initialStock,...q})=>({...q,stock:stock[q.itemId],currency:'crystal',synthetic:true})),crystal:stock.crystal}];}
