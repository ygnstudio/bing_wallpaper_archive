import { t } from './i18n.js';
const controls = new WeakMap();
/** A small, always-visible radio group backed by the existing select state. */
export function enhanceChoices(select) {
  if (!select?.ownerDocument || controls.has(select)) return;
  const group=document.createElement('div');
  group.className='choice-control'; group.setAttribute('role','radiogroup');
  select.after(group); select.hidden=true;
  controls.set(select,group);
  group.addEventListener('click',event=>{
    const button=event.target.closest('[role="radio"]');
    if(!button || button.disabled) return;
    select.value=button.dataset.value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
    refreshChoices(select);
  });
  group.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault(); event.stopPropagation();
    const buttons=[...group.querySelectorAll('button:not(:disabled)')];
    if(!buttons.length)return;
    let index=buttons.indexOf(document.activeElement);
    index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
    buttons[index].focus(); buttons[index].click();
  });
  select.addEventListener('change',()=>refreshChoices(select));
  refreshChoices(select);
}
export function refreshChoices(select) {
  const group=controls.get(select); if(!group)return;
  group.setAttribute('aria-label',t(select.getAttribute('aria-label') || '分辨率'));
  const options=[...select.options];
  if([...group.children].map(b=>b.dataset.value).join('|')!==options.map(o=>o.value).join('|')) {
    group.replaceChildren(...options.map(option=>{
      const button=document.createElement('button'); button.type='button'; button.dataset.value=option.value; button.setAttribute('role','radio'); return button;
    }));
  }
  options.forEach((option,index)=>{
    const button=group.children[index], active=select.value===option.value;
    button.textContent=option.value==='system'?t('跟随系统'):option.textContent;
    button.disabled=select.disabled||option.disabled;
    button.setAttribute('aria-checked',String(active));
    button.tabIndex=active&&!button.disabled?0:-1;
  });
}
