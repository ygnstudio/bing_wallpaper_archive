import assert from 'node:assert/strict';
import { reveal } from '../site/assets/motion.js';
let reduced=false;
globalThis.matchMedia=()=>({matches:reduced});
globalThis.document={documentElement:{dataset:{input:'pointer'}}};
globalThis.getComputedStyle=()=>({opacity:'1',transform:'none'});
function surface(hidden=true) {
 const effects=[];
 return {hidden,inert:false,effects,animate(){
  let resolve,reject;
  const animation={finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),cancel(){reject(new Error('cancelled'));},finish(){resolve();}};
  effects.push(animation); return animation;
 }};
}
const panel=surface();
let opening=reveal(panel,true);
assert.equal(panel.hidden,false);panel.effects.at(-1).finish();assert.equal(await opening,true);
assert.equal(panel.hidden,false);
const closing=reveal(panel,false);
assert.equal(panel.inert,true);
opening=reveal(panel,true);
assert.equal(await closing,false);
panel.effects.at(-1).finish();assert.equal(await opening,true);
assert.equal(panel.hidden,false);assert.equal(panel.inert,false);
console.log('✓ 反向开关取消旧动画，不会被过期关闭隐藏');
const first=reveal(panel,false),second=reveal(panel,false);
const count=panel.effects.length;panel.effects.at(-1).finish();
assert.equal(await first,true);assert.equal(await second,true);assert.equal(panel.effects.length,count);assert.equal(panel.hidden,true);
console.log('✓ 重复关闭复用同一动画并正确完成');
reduced=true;await reveal(panel,true);assert.equal(panel.hidden,false);assert.equal(panel.effects.length,count);
console.log('✓ 减少动态效果时即时切换');
reduced=false;document.documentElement.dataset.input='keyboard';await reveal(panel,false);assert.equal(panel.hidden,true);assert.equal(panel.effects.length,count);
console.log('✓ 键盘操作不等待动画');
