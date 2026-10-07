import assert from 'node:assert/strict';
import { extractPhotoColor, photoPalette, contrast, rgbToHsl } from '../site/assets/accent.js';
const pixels = colors => Uint8ClampedArray.from(colors.flatMap(rgb => [...rgb,255]));
const green = extractPhotoColor(pixels([...Array(100).fill([230,230,230]),...Array(30).fill([40,120,65]),...Array(5).fill([200,50,50])]));
assert.ok(green[1] > green[0] && green[1] > green[2]);
assert.equal(rgbToHsl(extractPhotoColor(pixels([[20,20,20],[220,220,220]])))[1],0);
assert.deepEqual(extractPhotoColor(new Uint8ClampedArray([255,0,0,0,30,100,160,255])),[30,100,160]);
for (const color of [[255,0,0],[0,255,0],[0,0,255],[255,255,0],[10,10,10],[250,250,250],[150,80,40]]) {
  for (const dark of [false,true]) {
    const palette = photoPalette(color,dark);
    assert.ok(contrast(palette.accent,dark ? [44,44,46] : [241,241,243]) >= 5);
    // Accent controls are 90% opaque: test foreground contrast on both extremes.
    for (const backdrop of [0,255]) {
      const composite = palette.accent.map(channel => .9*channel+.1*backdrop);
      assert.ok(contrast(composite,palette.onAccent) >= 4.5);
    }
  }
}
console.log('✓ Photo color extraction, neutral/transparent pixels, and both theme contrasts');
