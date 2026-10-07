/** Shared, interruptible motion. Keyboard and reduced-motion paths stay immediate. */
const running = new WeakMap();
export function canAnimate(element) {
  return !!element?.animate && typeof matchMedia === 'function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches &&
    document.documentElement.dataset.input !== 'keyboard';
}
export function initMotion() {
  if (document.documentElement.dataset.motionReady) return;
  document.documentElement.dataset.motionReady = 'true';
  document.addEventListener('keydown', () => { document.documentElement.dataset.input = 'keyboard'; }, true);
  document.addEventListener('pointerdown', () => { document.documentElement.dataset.input = 'pointer'; }, true);
  window.addEventListener('pageswap', event => { if(!canAnimate(document.body)) event.viewTransition?.skipTransition(); });
}
function cancel(element) { running.get(element)?.animation.cancel(); running.delete(element); }
export function animateIn(element, distance = 10) {
  cancel(element);
  if (!canAnimate(element)) return;
  const animation=element.animate([
    {opacity:.45, transform:`translateY(${distance}px) scale(.99)`},
    {opacity:1, transform:'translateY(0) scale(1)'}
  ],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
  const state={animation}; running.set(element,state);
  animation.finished.catch(()=>{}).finally(()=>{ if(running.get(element)===state) running.delete(element); });
}
/** Resolve false if a newer transition supersedes this one. */
export async function reveal(element, visible) {
  const old=running.get(element);
  if (old?.visible === visible) return old.done;
  if (!old && element.hidden === !visible) return true;
  const wasHidden=element.hidden;
  const from = canAnimate(element) && !wasHidden ? {opacity:getComputedStyle(element).opacity,transform:getComputedStyle(element).transform} : null;
  cancel(element);
  if (!canAnimate(element)) { element.hidden=!visible; element.inert=false; return true; }
  element.hidden=false;
  element.inert=!visible;
  const rest={opacity:1,transform:'translateY(0) scale(1)'};
  const tucked={opacity:0,transform:`translateY(${visible ? 16 : 8}px) scale(.985)`};
  const animation=element.animate([from || (visible ? tucked : rest),visible ? rest : tucked],{
    duration:visible ? 280 : 180,easing:visible ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.4,0,1,1)',fill:'both'
  });
  const state={animation,visible};
  running.set(element,state);
  state.done=animation.finished.then(()=>{
    if(running.get(element)!==state) return false;
    element.hidden=!visible; element.inert=false; cancel(element); return true;
  },()=>false);
  return state.done;
}
export function scrollToGallery() {
  document.getElementById('gallery').scrollIntoView({behavior:canAnimate(document.body) ? 'smooth' : 'instant'});
}
export function changeLayout(update) {
  if(canAnimate(document.body) && document.startViewTransition) {
    const transition=document.startViewTransition(update);
    transition.finished.catch(()=>{});
  } else update();
}
