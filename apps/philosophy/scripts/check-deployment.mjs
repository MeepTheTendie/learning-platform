import {execFileSync} from 'node:child_process';
const secrets=JSON.parse(execFileSync('wrangler',['secret','list'],{encoding:'utf8'}));
if(!secrets.some(secret=>secret.name==='SYNC_KEY_HASH'))throw Error('Missing SYNC_KEY_HASH: restore the existing pairing-key hash before deploying.');
