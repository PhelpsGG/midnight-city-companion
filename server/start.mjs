import {createServer} from './app.mjs';
const port=Number(process.env.PORT??62761);if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('PORT must be 1024–65535.');
const service=await createServer({port});
console.log(`Midnight City Companion: ${service.origin}\nDisconnected by default. Enter your own existing key in the local client.`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void service.close().then(()=>process.exit(0)));
