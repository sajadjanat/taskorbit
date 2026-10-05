import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const dir=process.argv[2]||'release-files';
const config=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
const publicKey=Buffer.from(config.plugins.updater.pubkey,'base64').toString('utf8').trim().split(/\r?\n/)[1];
if(!publicKey)throw Error('Public updater key missing');
const signatures=fs.readdirSync(dir).filter(f=>f.endsWith('.sig'));
if(signatures.length<5)throw Error('Expected signed updater packages for all desktop targets');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'taskorbit-signature-'));
try{for(const name of signatures){
 const signature=path.join(temporary,'package.minisig');
 fs.writeFileSync(signature,Buffer.from(fs.readFileSync(path.join(dir,name),'utf8').trim(),'base64'));
 execFileSync('minisign',['-Vm',path.join(dir,name.slice(0,-4)),'-P',publicKey,'-x',signature],{stdio:'inherit'});
}}finally{fs.rmSync(temporary,{recursive:true,force:true});}
console.log(`Verified ${signatures.length} updater signatures against the bundled public key`);
