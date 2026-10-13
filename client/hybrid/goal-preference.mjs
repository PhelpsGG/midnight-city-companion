// Browser preference only; character progress remains owned by the sandbox server.
export function readGoalTarget(storage,worldId){try{const value=JSON.parse(storage?.getItem('hybrid-goal')??'null');return value?.worldId===worldId&&Number.isSafeInteger(value.target)&&value.target>0?value.target:1;}catch{return 1;}}
export function writeGoalTarget(storage,worldId,target){try{storage?.setItem('hybrid-goal',JSON.stringify({worldId,target}));}catch{/* A blocked browser store must not interrupt the sandbox. */}}
