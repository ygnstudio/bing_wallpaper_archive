/** Extract a representative photo hue, then create legible theme-specific tones. */
export function extractPhotoColor(pixels) {
  const buckets = new Map();
  let neutral = 0, count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = Array.from(pixels.slice(i, i + 3));
    const [h, s, l] = rgbToHsl(rgb);
    neutral += l; count++;
    // Black shadows, white highlights and grey areas should not swamp the subject.
    if (s < .15 || l < .08 || l > .92) continue;
    const key = Math.round(h / 20) % 18;
    const bucket = buckets.get(key) || { weight:0, sum:[0,0,0] };
    const weight = .3 + s;
    bucket.weight += weight;
    rgb.forEach((channel, index) => { bucket.sum[index] += channel * weight; });
    buckets.set(key, bucket);
  }
  const best = [...buckets.values()].sort((a,b) => b.weight-a.weight)[0];
  if (best && best.weight >= count * .015) return best.sum.map(channel => Math.round(channel / best.weight));
  const grey = Math.round((count ? neutral / count : .5) * 255);
  return [grey, grey, grey];
}
export function rgbToHsl(rgb) {
  const [r,g,b] = rgb.map(x => x / 255), max = Math.max(r,g,b), min = Math.min(r,g,b);
  const delta = max-min, l = (max+min)/2;
  if (!delta) return [0,0,l];
  const h = max === r ? ((g-b)/delta+6)%6 : max === g ? (b-r)/delta+2 : (r-g)/delta+4;
  return [h*60,delta/(1-Math.abs(2*l-1)),l];
}
function hslToRgb(h,s,l) {
  const a = s * Math.min(l,1-l);
  return [0,8,4].map(n => {
    const k = (n+h/30)%12;
    return Math.round((l-a*Math.max(-1,Math.min(k-3,9-k,1)))*255);
  });
}
export function contrast(a,b) {
  const luminance = rgb => rgb.map(c => c/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4).reduce((sum,c,i) => sum+c*[.2126,.7152,.0722][i],0);
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
}
export function photoPalette(rgb, dark) {
  const [h,s] = rgbToHsl(rgb), saturation = s < .15 ? 0 : Math.min(.68,Math.max(.30,s));
  let lightness = dark ? .68 : .38;
  const background = dark ? [44,44,46] : [241,241,243];
  let accent = hslToRgb(h,saturation,lightness);
  for (let step = 0; step < 50 && contrast(accent,background) < 5; step++) {
    lightness += dark ? .005 : -.005;
    accent = hslToRgb(h,saturation,lightness);
  }
  return { accent, hover:hslToRgb(h,saturation,lightness+(dark ? .06 : -.04)), onAccent:dark ? [12,14,16] : [255,255,255] };
}

/** Only the archive's same-origin thumbnail is sampled; full Bing images can be cross-origin. */
export async function updatePhotoAccent(source, isCurrent = () => true) {
  const root = document.documentElement;
  try {
    const url = new URL(source, location.href);
    if (!source || url.origin !== location.origin) throw new Error('No local thumbnail');
    const image = new Image(); image.decoding = 'async'; image.src = url.href;
    await image.decode();
    if (!isCurrent()) return;
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 40;
    const context = canvas.getContext('2d', { willReadFrequently:true });
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const color = extractPhotoColor(context.getImageData(0,0,canvas.width,canvas.height).data);
    for (const dark of [false,true]) {
      const palette = photoPalette(color,dark), mode = dark ? 'dark' : 'light';
      for (const [key,value] of Object.entries(palette)) root.style.setProperty(`--photo-${mode}-${key}`, `rgb(${value.join(' ')})`);
    }
    root.dataset.photoAccent = 'true';
  } catch {
    if (isCurrent()) delete root.dataset.photoAccent;
  }
}
