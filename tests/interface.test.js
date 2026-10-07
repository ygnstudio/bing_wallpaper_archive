import assert from 'node:assert/strict';
import { resolveLanguage, resolveTheme, t } from '../site/assets/i18n.js';
import { initBatch, updateBatchBar } from '../site/assets/batch.js';
import { downloadPhoto } from '../site/assets/download.js';
import { selected, setItems, setFiltered } from '../site/assets/state.js';
let passed=0;
async function test(name,fn){await fn();passed++;console.log(`✓ ${name}`);}
await test('系统语言按首选语言决定，手动选择优先',()=>{
 assert.equal(resolveLanguage('system',['zh-TW','en']),'zh');
 assert.equal(resolveLanguage('system',['fr-FR','zh-CN']),'en');
 assert.equal(resolveLanguage('en',['zh-CN']),'en');
 assert.equal(resolveLanguage(null,['zh-CN']),'zh');
});
await test('系统主题响应深浅色，手动主题不被系统覆盖',()=>{
 assert.equal(resolveTheme('system',true),'dark');assert.equal(resolveTheme('system',false),'light');assert.equal(resolveTheme('light',true),'light');
});
await test('动态界面文案支持中英文插值',()=>{
 assert.equal(t('选择前 {n} 张',{n:50},'en'),'Select first 50');
 assert.equal(t('选择前 {n} 张',{n:50},'zh-CN'),'选择前 50 张');
});
const classes=new Set();
const classList={contains:x=>classes.has(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x);}};
const node=()=>({dataset:{},hidden:false,disabled:false,value:'',textContent:'',listeners:{},options:[],classList,
 addEventListener(event,fn){this.listeners[event]=fn;},setAttribute(){},focus(){},querySelectorAll(){return[];},querySelector(){return{};},getBoundingClientRect(){return{height:80};}});
globalThis.window={addEventListener(){}};
globalThis.document={documentElement:{lang:'en',style:{setProperty(){}}},body:{classList,append(){}},addEventListener(){},createElement(){return{click(){},remove(){}};}};
const names=['grid','batchPanel','batchToggle','batchToggleText','batchDone','batchZip','batchClear','batchSelectAll','batchRes','batchCount','batchBadge','batchResNote','batchProgress','lightbox'];
const els=Object.fromEntries(names.map(name=>[name,node()]));els.batchRes.options=[{value:'UHD'},{value:'1920x1080'}];els.batchRes.value='1920x1080';els.lightbox.hidden=true;
const photos=[{date:'20260101',title:'A',uhd:true,url:'https://example.test/a.jpg'},{date:'20260102',title:'B',uhd:true,url:'https://example.test/b.jpg'}];
setItems(photos);setFiltered(photos);selected.clear();initBatch(els);
await test('直接勾选即显示面板，不改变图片点击模式',()=>{
 const cb={checked:true,dataset:{date:photos[0].date},closest(){return{classList};}};
 els.grid.listeners.change({target:{closest(){return cb;}}});
 assert.equal(els.batchPanel.hidden,false);assert.equal(classes.has('selection-mode'),false);
});
await test('追加选择和刷新计数保留 1080p',()=>{
 selected.add(photos[1].date);updateBatchBar(els);assert.equal(els.batchRes.value,'1920x1080');
});
await test('批量请求失败释放按钮，保留选择并可重试',async()=>{
 globalThis.fetch=async()=>{throw new Error('offline');};
 await els.batchZip.listeners.click();
 assert.equal(els.batchZip.disabled,false);assert.equal(els.batchClear.disabled,false);assert.equal(els.batchRes.disabled,false);
 assert.equal(selected.size,2);assert.equal(els.batchZip.textContent,'Retry download');assert.match(els.batchProgress.textContent,/No images/);
});
await test('重复下载被阻止，失败后恢复单图操作',async()=>{
 let finish;let calls=0;
 globalThis.fetch=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
 const button=node(),status=node();
 const pending=downloadPhoto(photos[0],'1920x1080',button,status);
 await Promise.resolve();await Promise.resolve();
 assert.equal(button.disabled,true);
 await downloadPhoto(photos[0],'1920x1080',button,status);
 assert.equal(calls,1);
 finish({ok:false,status:503});await pending;
 assert.equal(button.disabled,false);assert.match(status.textContent,/Download failed/);
});
await test('部分失败仍生成 ZIP，且只重试失败项',async()=>{
 const requests=[];
 globalThis.fetch=async url=>{requests.push(url);if(url.includes('/b.jpg'))throw new Error('offline');return{ok:true,arrayBuffer:async()=>new Uint8Array([1,2]).buffer};};
 await els.batchZip.listeners.click();
 assert.match(els.batchProgress.textContent,/1 failed/);assert.equal(els.batchZip.textContent,'Retry download');
 requests.length=0;
 globalThis.fetch=async url=>{requests.push(url);return{ok:true,arrayBuffer:async()=>new Uint8Array([1,2]).buffer};};
 await els.batchZip.listeners.click();
 assert.equal(requests.length,1);assert.match(requests[0],/b.jpg/);assert.equal(els.batchZip.disabled,false);
});
console.log(`\n界面流程: ${passed} 通过`);
