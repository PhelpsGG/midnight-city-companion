// The browser retains only a session nonce and public projection, never the key.
export function createSessionClient({fetchImpl=fetch,onChange=()=>{}}={}){
 let snapshot=null;
 const set=value=>{snapshot=value;onChange(value);return value;};
 async function receive(response){
  const data=await response.json();
  if(!response.ok){if(data.invalidateSession)set(null);throw Error(data.error||'Connection unavailable.');}
  return set(data);
 }
 return {get snapshot(){return snapshot;},async open(){return receive(await fetchImpl('/api/session'));},async command(route,payload={}){
  if(!snapshot)throw Error('Reload to open a local session.');
  return receive(await fetchImpl('/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':snapshot.csrf},body:JSON.stringify({revision:snapshot.revision,...payload})}));
 }};
}
