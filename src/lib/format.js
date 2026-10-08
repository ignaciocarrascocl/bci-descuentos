/** Etiquetas, formateo y utilidades de fecha (zona horaria de Chile). */

export const DIAS = [
  { key: 'lunes', short: 'L', label: 'Lunes', letter: 'L' },
  { key: 'martes', short: 'M', label: 'Martes', letter: 'M' },
  { key: 'miercoles', short: 'M', label: 'Miércoles', letter: 'M' },
  { key: 'jueves', short: 'J', label: 'Jueves', letter: 'J' },
  { key: 'viernes', short: 'V', label: 'Viernes', letter: 'V' },
  { key: 'sabado', short: 'S', label: 'Sábado', letter: 'S' },
  { key: 'domingo', short: 'D', label: 'Domingo', letter: 'D' },
];

export const DIA_LABEL = Object.fromEntries(DIAS.map((d) => [d.key, d.label]));

export const MODALIDADES = [
  { key: 'PRESENCIAL', label: 'Presencial', hint: 'En tienda o local' },
  { key: 'ONLINE', label: 'Online', hint: 'Sitio web del comercio' },
  { key: 'APP_PROPIA', label: 'App / comercio', hint: 'App propia del comercio' },
  { key: 'WHATSAPP', label: 'WhatsApp', hint: 'Pedidos por WhatsApp' },
];

export const ALCANCES = [
  { key: 'nacional', label: 'Todo Chile' },
  { key: 'regional', label: 'Por región / comuna' },
  { key: 'internacional', label: 'Internacional' },
];

export function formatCLP(n) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

/** Día actual en Chile, sin depender de la zona ni del idioma del navegador. */
export function hoyEnChile(date = new Date()) {
  try {
    const en = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Santiago' })
      .format(date)
      .trim()
      .toLowerCase();
    if (DIAS_EN[en]) return DIAS_EN[en];

    const es = new Intl.DateTimeFormat('es-CL', { weekday: 'long', timeZone: 'America/Santiago' })
      .format(date)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    if (DIAS.some((d) => d.key === es)) return es;
  } catch {
    /* Intl no disponible: se usa el índice local */
  }
  return DIAS_POR_INDICE[date.getDay()];
}

export function fechaCorta(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Santiago' }).format(date);
  } catch {
    return '';
  }
}

export function listado(items, max = 3, sep = ', ') {
  if (items.length <= max) return items.join(sep);
  return `${items.slice(0, max).join(sep)} +${items.length - max}`;
}

/** Nombres en inglés -> claves internas (evita depender de datos de locale). */
const DIAS_EN = {
  sunday: 'domingo',
  monday: 'lunes',
  tuesday: 'martes',
  wednesday: 'miercoles',
  thursday: 'jueves',
  friday: 'viernes',
  saturday: 'sabado',
};

const DIAS_POR_INDICE = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
