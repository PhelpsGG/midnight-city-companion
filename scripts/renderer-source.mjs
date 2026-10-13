export function rendererSources(map){
 if(!Array.isArray(map.sources)||!Array.isArray(map.sourcesContent)||map.sources.length!==map.sourcesContent.length)throw Error('Invalid published source map.');
 const result=[];
 for(let i=0;i<map.sources.length;i++){
  const source=map.sources[i];if(typeof source!=='string')throw Error('Invalid source path.');
  const match=source.match(/^(?:\.\.\/)+(src|assets-source|shared)\/(.+)$/);if(!match)continue;
  if(match[2].split('/').some(s=>!s||s==='.'||s==='..')||/[\\:\x00]/.test(match[2])||typeof map.sourcesContent[i]!=='string')throw Error('Unsafe published source path.');
  result.push({path:match[1]+'/'+match[2],content:map.sourcesContent[i]});
 }
 return result;
}
