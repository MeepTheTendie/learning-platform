import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,exportJWK,createLocalJWKSet} from 'jose';
import {accessIdentity} from '../packages/progress/access.mjs';
import worker from '../packages/progress/worker.mjs';
const {privateKey,publicKey}=await generateKeyPair('RS256');
const keys=createLocalJWKSet({keys:[{...await exportJWK(publicKey),kid:'test',alg:'RS256'}]});
const env={AUTH_MODE:'access',ACCESS_ISSUER:'https://learning-test.cloudflareaccess.com',ACCESS_AUD:'test-audience',OWNER_EMAIL:'owner@example.com'};
const token=async(overrides={})=>new SignJWT({email:'owner@example.com',...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('owner').setIssuer(env.ACCESS_ISSUER).setAudience(env.ACCESS_AUD).setExpirationTime('5m').sign(privateKey);
const req=t=>new Request('https://app.test/api/progress',{headers:{'cf-access-jwt-assertion':t}});
test('Access accepts a signed token for the configured owner, issuer and audience',async()=>{
 assert.deepEqual(await accessIdentity(req(await token()),env,keys),{email:'owner@example.com'});
});
test('Access rejects wrong owner, issuer, audience, expiry, tampering and missing setup',async()=>{
 const t=await token();
 assert.equal(await accessIdentity(req(await token({email:'other@example.com'})),env,keys),null);
 assert.equal(await accessIdentity(req(t),{...env,ACCESS_AUD:'other'},keys),null);
 assert.equal(await accessIdentity(req(t),{...env,ACCESS_ISSUER:'https://other.cloudflareaccess.com'},keys),null);
 const expired=await new SignJWT({email:env.OWNER_EMAIL}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('owner').setIssuer(env.ACCESS_ISSUER).setAudience(env.ACCESS_AUD).setExpirationTime(1).sign(privateKey);
 assert.equal(await accessIdentity(req(expired),env,keys),null);
 assert.equal(await accessIdentity(req(t.slice(0,-8)+'tampered'),env,keys),null);
 assert.equal(await accessIdentity(req(t),{...env,ACCESS_AUD:''},keys),null);
});
test('spoofed email headers and legacy keys cannot bypass Access mode',async()=>{
 const r=await worker.fetch(new Request('https://app.test/api/progress',{headers:{'cf-access-authenticated-user-email':env.OWNER_EMAIL,Authorization:'Bearer '+'a'.repeat(64)}}),env);
 assert.equal(r.status,401);
});
