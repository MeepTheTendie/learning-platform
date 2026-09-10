import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['tests/serve.mjs'],{stdio:['ignore','pipe','inherit']});
let ready='';
try {
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Test server startup timed out')),10000);
  server.once('exit',code=>{clearTimeout(timeout);reject(Error('Test server exited '+code));});
  server.stdout.on('data',data=>{ready+=data;if(ready.includes('philosophy 19003')){clearTimeout(timeout);resolve();}});
 });
 const code=await new Promise(resolve=>{
  const child=spawn(process.execPath,['tests/cross-device.cjs'],{stdio:'inherit'});child.once('exit',resolve);
 });
 process.exitCode=code??1;
} finally {server.kill('SIGTERM');}
