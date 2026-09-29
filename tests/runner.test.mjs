import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {modules} from './catalog.mjs';

const cwd=fileURLToPath(new URL('../',import.meta.url));
const run=args=>spawnSync(process.execPath,['test-suite.mjs',...args],{cwd,encoding:'utf8',timeout:30000});
test('catálogo cubre todas las tareas del sprint y no duplica módulos',()=>{
  assert.equal(new Set(modules.map(m=>m.id)).size,modules.length);
  for(const task of [...Array.from({length:19},(_,i)=>`Q${i+1}`),'Q11-1',...Array.from({length:21},(_,i)=>`Q6.${i+1}`)]){
    assert.ok(modules.some(m=>m.tasks.includes(task)),`Sin módulo para ${task}`);
  }
});
test('listar no ejecuta la suite',()=>{
  const result=run(['--list']);assert.equal(result.status,0);
  assert.match(result.stdout,/box-orders/);assert.doesNotMatch(result.stdout,/TOTAL RESULTS|PASS:/);
});
test('typo o selección vacía fallan y no ejecutan todos los tests',()=>{
  for(const args of [['--module','no-existe'],['--module'],['--module','documentation','--task','Q8']]){
    const result=run(args);assert.equal(result.status,1);assert.doesNotMatch(result.stdout,/PASS:/);
  }
});
test('seleccionar documentación ejecuta únicamente sus cuatro aserciones',()=>{
  const result=run(['--module','documentation']);assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/4 PASSED, 0 FAILED \(1 módulos\)/);
  assert.doesNotMatch(result.stdout,/=== box-orders|=== safety-car/);
});
