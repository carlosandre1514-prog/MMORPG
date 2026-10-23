// Recoloração de personagens KayKit pela textura. Os modelos usam uma paleta de degradês (cada roupa é uma região da imagem), então
// dá para trocar a cor só das roupas escolhidas por matiz e deixar a pele, o cabelo e o couro como estão. Só usa canvas (sem THREE),
// para servir também ao gerador de sprites (tools/bake).
// regra: { h: [de, até] (graus), s: [min, max], to: [r, g, b] (0..1, cor-base), lift: 0..1 (quanto do brilho original fica) }
export const RECOLOR = {
  // Clérigo: o roxo do manto do mago vira creme e o rosa do forro vira dourado; pele, cabelo e botas não mudam
  cleric: [
    { h: [225, 292], s: [0.18, 1], to: [1.0, 0.96, 0.84], lift: 0.5 },
    { h: [293, 350], s: [0.3, 1], to: [1.0, 0.78, 0.36], lift: 0.55 },
    { h: [160, 200], s: [0.35, 1], to: [1.0, 0.82, 0.4], lift: 0.55 },
  ],
  // Assassino: o verde do ladrão vira cinza-azulado escuro e o verde-limão vira carmim
  assassin: [
    { h: [130, 200], s: [0.3, 1], to: [0.2, 0.19, 0.27], lift: 0.4 },
    { h: [55, 130], s: [0.3, 1], to: [0.82, 0.1, 0.18], lift: 0.5 },
  ],
};

function hsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max / 255];
}

// devolve um canvas com a imagem recolorida pelas regras (nome de RECOLOR ou lista)
export function recolorImage(img, rules) {
  const list = typeof rules === 'string' ? RECOLOR[rules] : rules;
  const w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const [hh, s, v] = hsv(d[i], d[i + 1], d[i + 2]);
    for (const r of list) {
      if (hh < r.h[0] || hh > r.h[1] || s < r.s[0] || s > r.s[1]) continue;
      const k = r.lift + (1 - r.lift) * Math.min(1, v / 0.6); // mantém o degradê da roupa (dobras e sombras)
      d[i] = Math.min(255, r.to[0] * 255 * k); d[i + 1] = Math.min(255, r.to[1] * 255 * k); d[i + 2] = Math.min(255, r.to[2] * 255 * k);
      break;
    }
  }
  ctx.putImageData(data, 0, 0);
  return cv;
}
