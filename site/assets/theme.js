import { initAbout } from './about.js';
import { enhanceChoices, refreshChoices } from './choices.js';
import { initMotion } from './motion.js';
import { resolveLanguage, resolveTheme, translateStatic } from './i18n.js';
initMotion();
const root = document.documentElement;
const scheme = matchMedia('(prefers-color-scheme: dark)');
const read = key => { try { return localStorage.getItem(key) || 'system'; } catch { return 'system'; } };
const save = (key,value) => { try { localStorage.setItem(key,value); } catch { /* Session preferences still apply. */ } };
let theme = read('bw-theme'), language = read('bw-language');
const themeSelect = document.querySelector('#theme-preference');
const languageSelect = document.querySelector('#language-preference');
function apply() {
  const previousLanguage = root.lang;
  root.dataset.theme = resolveTheme(theme, scheme.matches);
  root.lang = resolveLanguage(language, navigator.languages || [navigator.language]) === 'zh' ? 'zh-CN' : 'en';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',root.dataset.theme === 'light' ? '#ffffff' : '#1c1c1e');
  themeSelect.value = ['dark','light'].includes(theme) ? theme : 'system';
  languageSelect.value = ['zh','en'].includes(language) ? language : 'system';
  translateStatic();
  refreshChoices(themeSelect); refreshChoices(languageSelect);
  if (previousLanguage !== root.lang) document.dispatchEvent(new Event('languagechange'));
}
themeSelect.addEventListener('change',()=>{ theme=themeSelect.value; save('bw-theme',theme); apply(); });
languageSelect.addEventListener('change',()=>{ language=languageSelect.value; save('bw-language',language); apply(); });
scheme.addEventListener('change',()=>{ if (theme === 'system') apply(); });
window.addEventListener('languagechange',()=>{ if (language === 'system') apply(); });
window.addEventListener('storage',event=>{ if (!event.key || ['bw-theme','bw-language'].includes(event.key)) { theme=read('bw-theme'); language=read('bw-language'); apply(); } });
const preferences = document.querySelector('.preferences');
document.addEventListener('click',event=>{ if (preferences && !preferences.contains(event.target)) preferences.open=false; });
document.addEventListener('keydown',event=>{ if(event.key==='Escape' && preferences?.open){event.preventDefault(); preferences.open=false; preferences.querySelector('summary').focus();} });
apply();

enhanceChoices(themeSelect); enhanceChoices(languageSelect);

if (document.querySelector('.about-page')) initAbout();
