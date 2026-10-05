import {createApp} from '../server/app.mjs';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=mkdtempSync(path.join(tmpdir(),'taskorbit-browser-'));
const {app,db}=createApp({database:path.join(dir,'db.sqlite'),origin:'http://127.0.0.1:4312',secure:false});
const server=app.listen(4312,'127.0.0.1');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();rmSync(dir,{recursive:true,force:true});process.exit(0);}));
