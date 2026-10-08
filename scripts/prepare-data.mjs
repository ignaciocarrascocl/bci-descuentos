/**
 * prepare-data.mjs
 * ---------------------------------------------------------------------------
 * Toma el dataset crudo (data/source-beneficios.json) y produce:
 *   - src/data/beneficios.json  -> dataset normalizado y enriquecido que consume la UI
 *   - public/img/comercios/*.svg -> placeholders locales (sin requests externos)
 *
 * IMPORTANTE / TRANSPARENCIA SOBRE LOS DATOS
 * El JSON original NO trae "día de la semana". Como la necesidad principal es
 * filtrar por día, aquí se DERIVA `dias` de forma determinista (hash estable del
 * comercio) para que el filtro sea funcional y demostrable. Cuando exista el dato
 * real basta con agregar la columna `dias` al JSON de origen: este script la
 * respeta si viene (`row.dias`) y no la pisa.
 *
 * Igual criterio para `tipo_beneficio`: se deriva de moneda_beneficio
 * (MULTIPLICADOR -> Cashback/puntos, PORCENTAJE|CLP -> Descuento).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'data', 'source-beneficios.json');
const OUT_JSON = join(ROOT, 'public', 'data', 'beneficios.json');
const OUT_IMG_DIR = join(ROOT, 'public', 'img', 'comercios');

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABEL = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Corrige mojibake típico (UTF-8 leído como latin1): "RegiÃ³n" -> "Región". */
function fixEncoding(value) {
  if (typeof value !== 'string') return value;
  if (!/[ÃÂ]/.test(value)) return value;
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    return repaired.includes('\uFFFD') ? value : repaired;
  } catch {
    return value;
  }
}

const clean = (v) => (typeof v === 'string' ? fixEncoding(v).trim() : v);

/** Hash estable (djb2) para derivaciones deterministas. */
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

function parseList(raw, separators) {
  if (!raw || typeof raw !== 'string') return [];
  let parts = [raw];
  for (const sep of separators) {
    parts = parts.flatMap((p) => p.split(sep));
  }
  return [...new Set(parts.map((p) => clean(p)).filter(Boolean))];
}

function toDias(id, comercio, categoria) {
  const h = hash(`${comercio}#${id}`);
  // ~28% de los beneficios son "todos los días" (frecuente en retail/online).
  if (h % 100 < 28) return [...DIAS];
  const total = 1 + (h % 3); // 1..3 días por semana
  const out = [];
  let cursor = h % 7;
  for (let i = 0; i < total; i += 1) {
    out.push(DIAS[cursor]);
    cursor = (cursor + (2 + (h % 2))) % 7;
    if (out.length > 0 && out.filter((d, idx) => out.indexOf(d) === idx).length !== out.length) {
      cursor = (cursor + 1) % 7;
    }
  }
  const uniq = [...new Set(out)];
  if (uniq.length === 0) uniq.push(DIAS[categoria === 'Restaurantes' ? 2 : 4]);
  return DIAS.filter((d) => uniq.includes(d));
}

const CATEGORY_THEME = {
  Restaurantes: { from: '#F97316', to: '#B91C1C', emoji: '🍽' },
  Comercios: { from: '#0EA5E9', to: '#1D4ED8', emoji: '🛍' },
  Viajes: { from: '#06B6D4', to: '#0E7490', emoji: '✈' },
  Panoramas: { from: '#A855F7', to: '#6D28D9', emoji: '🎟' },
  CyberClicks: { from: '#22C55E', to: '#047857', emoji: '💻' },
  Destacados: { from: '#6366F1', to: '#312E81', emoji: '★' },
};

const CATEGORY_ALIAS = {
  Restaurantes: 'Restaurantes',
  Comercios: 'Comercios',
  Viajes: 'Viajes',
  Panoramas: 'Panoramas',
  CyberClicks: 'CyberClicks',
  Destacados: 'Destacados',
};

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function clp(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

function monogram(comercio) {
  const words = String(comercio)
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'BCI';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function coverSvg({ comercio, categoria, monograma, seed }) {
  const theme = CATEGORY_THEME[categoria] || CATEGORY_THEME.Destacados;
  const angle = 20 + (seed % 40);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" role="img" aria-label="Imagen referencial de ${escapeXml(
    comercio,
  )}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${theme.from}"/>
      <stop offset="100%" stop-color="${theme.to}"/>
    </linearGradient>
    <pattern id="p" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <rect width="48" height="48" fill="none"/>
      <circle cx="8" cy="8" r="3" fill="#ffffff" fill-opacity="0.16"/>
    </pattern>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  <rect width="640" height="400" fill="url(#p)"/>
  <circle cx="520" cy="70" r="150" fill="#ffffff" fill-opacity="0.10"/>
  <circle cx="90" cy="350" r="120" fill="#000000" fill-opacity="0.10"/>
  <text x="320" y="215" text-anchor="middle" font-family="Inter, Segoe UI, system-ui, sans-serif" font-size="150" font-weight="800" fill="#ffffff" fill-opacity="0.92">${escapeXml(
    monograma,
  )}</text>
  <text x="320" y="285" text-anchor="middle" font-family="Inter, Segoe UI, system-ui, sans-serif" font-size="26" font-weight="600" fill="#ffffff" fill-opacity="0.85">${escapeXml(
    categoria,
  )}</text>
  <text x="320" y="330" text-anchor="middle" font-family="Inter, Segoe UI, system-ui, sans-serif" font-size="20" fill="#ffffff" fill-opacity="0.6">imagen referencial</text>
</svg>
`;
}

function escapeXml(v) {
  return String(v).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

// ---------------------------------------------------------------------------

const raw = JSON.parse(readFileSync(SRC, 'utf8'));

rmSync(OUT_IMG_DIR, { recursive: true, force: true });
mkdirSync(OUT_IMG_DIR, { recursive: true });
mkdirSync(dirname(OUT_JSON), { recursive: true });

const usedSlugs = new Map();
const benefits = [];
const log = [];

for (const row of raw) {
  const id = Number(row.id_beneficio);
  const comercio = clean(row.comercio);
  const categoria = CATEGORY_ALIAS[clean(row.categoria_principal)] || clean(row.categoria_principal);
  const moneda = clean(row.moneda_beneficio) || 'PORCENTAJE';
  const valor = Number(row.valor_beneficio);

  const topeRaw = clean(String(row.monto_tope_descuento));
  const tope = !topeRaw || topeRaw.toUpperCase() === 'NULL' ? null : Number(topeRaw);

  const mediosPago = clean(row.medios_pago_permitidos) || 'AMBOS';
  const segmento = clean(row.segmento_tarjeta_requerido) || 'TODAS';

  const regionesRaw = parseList(row.region_chile, [' / ']);
  const regiones = regionesRaw.includes('TODAS_LAS_REGIONES')
    ? ['TODAS_LAS_REGIONES']
    : regionesRaw.filter((r) => r !== 'TODAS_LAS_REGIONES');

  let comunas = parseList(row.comuna_o_ciudad, [', ']).filter((c) => c !== 'N/A');
  if (comunas.length === 0) comunas = ['Varias Comunas'];

  const canalesRaw = clean(row.canal_aplicacion);
  const canales =
    canalesRaw === 'AMBOS' ? ['PRESENCIAL', 'ONLINE'] : canalesRaw ? [canalesRaw] : ['PRESENCIAL'];

  const dias = Array.isArray(row.dias) && row.dias.length ? row.dias.map((d) => String(d).toLowerCase()) : toDias(id, comercio, categoria);

  const tipo = moneda === 'MULTIPLICADOR' ? 'Cashback' : 'Descuento';

  let valorTexto;
  if (moneda === 'PORCENTAJE') valorTexto = `${valor}% de descuento`;
  else if (moneda === 'CLP') valorTexto = `${clp(valor)} de descuento`;
  else valorTexto = `${valor}x en acumulación`;

  const medioPagoLabel = { AMBOS: 'Crédito o débito', CREDITO: 'Tarjeta de crédito', DEBITO: 'Tarjeta de débito' }[mediosPago] || mediosPago;
  const canalLabel = canales.length === 2 ? 'Online y presencial' : canales[0] === 'ONLINE' ? 'Online' : canales[0] === 'APP_PROPIA' ? 'App Bci' : canales[0] === 'WHATSAPP' ? 'WhatsApp' : 'Presencial';

  const ubicacion =
    regiones.includes('INTERNACIONAL')
      ? 'Internacional'
      : regiones.includes('TODAS_LAS_REGIONES')
        ? 'Todo Chile'
        : regiones.length === 1
          ? regiones[0]
          : `${regiones.length} regiones`;

  const descripcion = [
    tope ? `Hasta ${clp(tope)} de tope` : null,
    canalLabel,
    medioPagoLabel,
    segmento === 'PREMIUM_ONLY' ? 'Solo tarjetas Premium/Black' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const monograma = monogram(comercio);
  const baseSlug = slugify(comercio) || `beneficio-${id}`;
  const seen = usedSlugs.get(baseSlug) || 0;
  usedSlugs.set(baseSlug, seen + 1);
  const slug = seen === 0 ? baseSlug : `${baseSlug}-${seen + 1}`;

  const theme = CATEGORY_THEME[categoria] || CATEGORY_THEME.Destacados;
  writeFileSync(join(OUT_IMG_DIR, `${slug}.svg`), coverSvg({ comercio, categoria, monograma, seed: hash(slug) }), 'utf8');

  benefits.push({
    id,
    slug,
    comercio,
    categoria,
    tipo,
    moneda,
    valor,
    valorTexto,
    tope,
    topeTexto: tope ? clp(tope) : null,
    mediosPago,
    medioPagoLabel,
    segmento,
    premiumOnly: segmento === 'PREMIUM_ONLY',
    regiones,
    comunas,
    canales,
    canalLabel,
    dias,
    online: canales.some((c) => ['ONLINE', 'APP_PROPIA', 'WHATSAPP'].includes(c)),
    presencial: canales.includes('PRESENCIAL'),
    alcance: regiones.includes('INTERNACIONAL')
      ? 'internacional'
      : regiones.includes('TODAS_LAS_REGIONES')
        ? 'nacional'
        : 'regional',
    descripcion,
    ubicacion,
    imagen: `/img/comercios/${slug}.svg`,
    monograma,
    color: theme.from,
    colorFin: theme.to,
    destacado: categoria === 'Destacados' || categoria === 'CyberClicks',
  });

  log.push(`${id}\t${comercio}\t${categoria}\t${dias.join('|')}`);
}

// Orden: destacados primero, luego mejor valor de descuento porcentual.
benefits.sort((a, b) => {
  if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
  const av = a.moneda === 'PORCENTAJE' ? a.valor : 0;
  const bv = b.moneda === 'PORCENTAJE' ? b.valor : 0;
  if (bv !== av) return bv - av;
  return a.comercio.localeCompare(b.comercio, 'es');
});

const facetas = {
  categorias: [...new Set(benefits.map((b) => b.categoria))].sort((a, b) => a.localeCompare(b, 'es')),
  regiones: [...new Set(benefits.flatMap((b) => b.regiones))]
    .filter((r) => r !== 'TODAS_LAS_REGIONES')
    .sort((a, b) => a.localeCompare(b, 'es')),
  comunas: [...new Set(benefits.flatMap((b) => b.comunas))]
    .filter((c) => c !== 'Varias Comunas')
    .sort((a, b) => a.localeCompare(b, 'es')),
  canales: ['PRESENCIAL', 'ONLINE', 'APP_PROPIA', 'WHATSAPP'],
  dias: DIAS,
  mediosPago: ['CREDITO', 'DEBITO'],
  tipos: ['Descuento', 'Cashback'],
  topes: [5000, 10000, 20000, 30000, 50000, 100000],
};

const payload = {
  meta: {
    generado: new Date().toISOString(),
    total: benefits.length,
    fuente: 'data/source-beneficios.json',
    notaDias:
      'El dataset de origen no incluye día de la semana: `dias` se deriva de forma determinista. Si el origen trae `dias`, se respeta.',
    meses: MESES_CORTOS,
  },
  facetas,
  beneficios: benefits,
};

writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8');

console.log(`OK  ${benefits.length} beneficios -> ${OUT_JSON}`);
console.log(`OK  ${benefits.length} placeholders -> ${OUT_IMG_DIR}`);
console.log(`Dias cubiertos: ${facetas.dias.join(', ')}`);
const dist = DIAS.map((d) => `${d}=${benefits.filter((b) => b.dias.includes(d)).length}`).join('  ');
console.log(dist);
