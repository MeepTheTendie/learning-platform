import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
if(config.vars.AUTH_MODE==='access'){
  if(!config.vars.ACCESS_ISSUER||!config.vars.ACCESS_AUD||!config.vars.OWNER_EMAIL)throw Error('Incomplete Cloudflare Access configuration.');
} else if(config.vars.PEER_VALIDATE_URL){
  // Validates the shared pairing key against a peer app; no local secret needed.
} else {
  const secrets=JSON.parse(execFileSync('wrangler',['secret','list'],{encoding:'utf8'}));
  if(!secrets.some(secret=>secret.name==='SYNC_KEY_HASH'))throw Error('Missing SYNC_KEY_HASH: set the pairing-key hash before deploying.');
}
