import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,chmod,rm,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const shell=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/sh';
const script=await readFile(new URL('../deploy-server.sh',import.meta.url),'utf8');
const fakeDocker=String.raw`#!/bin/sh
if [ "$1" = compose ] && [ "$2" = ps ] && [ "$3" = --status ]; then echo test-container; exit 0; fi
if [ "$1" = compose ] && [ "$2" = up ]; then echo started > build-started; exit 0; fi
if [ "$1" = compose ] && [ "$2" = exec ]; then
  if [ "$5" = cat ]; then
    if [ "${'${FAIL_COPY:-0}'}" = 1 ]; then printf partial; exit 17; fi
    printf 'SQLite format 3\000payload\377\000'; exit 0
  fi
  if [ "$6" = server/backup.mjs ]; then echo /tmp/mgtu-backup-test.sqlite; exit 0; fi
  echo ok; exit 0
fi
if [ "$1" = compose ] && [ "$2" = cp ]; then echo 'cp must not be used for tmpfs' >&2; exit 99; fi
exit 0
`;

for(const failure of [false,true])test(`deployment backup ${failure?'failure stops rebuild':'preserves binary bytes without docker cp'}`,{skip:!existsSync(shell)},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'mgtu-deploy-test-'));
 try{
  await mkdir(path.join(dir,'bin'));await mkdir(path.join(dir,'server'));await mkdir(path.join(dir,'dist'));
  for(const name of ['Dockerfile','compose.yaml','package.json','package-lock.json','server/start.mjs','dist/index.html'])await writeFile(path.join(dir,name),'test');
  const original="APP_ORIGIN=http://old.test\nCOOKIE_SECURE=false\nSMTP_PASSWORD='fake-test$#'\nCOMPOSE_PROJECT_NAME=preserved-project\n";
  await writeFile(path.join(dir,'.env'),original);
  await writeFile(path.join(dir,'deploy-server.sh'),script);
  await writeFile(path.join(dir,'bin/docker'),fakeDocker);await chmod(path.join(dir,'bin/docker'),0o755);
  await writeFile(path.join(dir,'bin/curl'),'#!/bin/sh\nexit 0\n');await chmod(path.join(dir,'bin/curl'),0o755);
  const result=spawnSync(shell,['-c','export PATH="$PWD/bin:$PATH"; sh deploy-server.sh'],{cwd:dir,env:{...process.env,FAIL_COPY:failure?'1':'0'},encoding:'utf8',timeout:15000});
  const backups=await readdir(path.join(dir,'backups'));
  if(failure){assert.notEqual(result.status,0);assert.equal(existsSync(path.join(dir,'build-started')),false);assert.equal(backups.some(f=>f.endsWith('.sqlite')),false);}
  else{
   assert.equal(result.status,0,result.stderr);assert.ok(existsSync(path.join(dir,'build-started')));
   const backup=backups.find(f=>f.endsWith('.sqlite'));assert.ok(backup);
   assert.deepEqual(await readFile(path.join(dir,'backups',backup)),Buffer.concat([Buffer.from('SQLite format 3\0payload'),Buffer.from([255,0])]));
  }
  const env=await readFile(path.join(dir,'.env'),'utf8');assert.match(env,/APP_ORIGIN=https:\/\/openday.mkgtu.ru/);assert.ok(env.includes("SMTP_PASSWORD='fake-test$#'"));assert.match(env,/COMPOSE_PROJECT_NAME=preserved-project/);
  assert.equal(await readFile(path.join(dir,'backups',backups.find(f=>f.endsWith('.backup'))),'utf8'),original);
 }finally{
  assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(dir).startsWith('mgtu-deploy-test-'));
  await rm(dir,{recursive:true,force:true});
 }
});
