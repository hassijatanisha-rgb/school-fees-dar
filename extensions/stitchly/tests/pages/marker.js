// Draws a 20px-wide vertical strip whose every row encodes its own y position in RGB,
// so the tests can check that each stitched row came from the right place.
// value v -> R = (v % 64) * 4, G = (floor(v / 64) % 64) * 4, B = (floor(v / 4096) % 64) * 4
function drawMarker(img, height, offset) {
  const c = document.createElement('canvas');
  c.width = 20;
  c.height = height;
  const ctx = c.getContext('2d');
  for (let r = 0; r < height; r++) {
    const v = r + offset;
    ctx.fillStyle = `rgb(${(v % 64) * 4},${(Math.floor(v / 64) % 64) * 4},${(Math.floor(v / 4096) % 64) * 4})`;
    ctx.fillRect(0, r, 20, 1);
  }
  img.src = c.toDataURL();
  img.style.cssText += `width:20px;height:${height}px;image-rendering:pixelated;display:block;`;
}
