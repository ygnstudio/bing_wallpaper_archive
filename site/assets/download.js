import { ensureItemLoaded, fetchWithFallback } from './api.js';
import { setMessage } from './i18n.js';
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href=url; link.download=name; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
/** The same guarded, recoverable download flow serves both photo entry points. */
export async function downloadPhoto(item, resolution, button, status) {
  if (button.disabled) return;
  button.disabled=true; setMessage(status,'正在准备下载…');
  try {
    const full=await ensureItemLoaded(item), result=await fetchWithFallback(full,resolution);
    if (!result) throw new Error('Unavailable');
    saveBlob(new Blob([result.bytes],{type:result.thumbnail?'image/webp':'image/jpeg'}), result.name);
    setMessage(status,result.thumbnail ? '已发起下载，原图不可用，已保存缩略图' : result.resolution!==resolution ? '已发起下载，已回退至 1080p' : '已发起下载');
  } catch { setMessage(status,'下载失败，请重试或打开原图'); }
  finally { button.disabled=false; }
}
