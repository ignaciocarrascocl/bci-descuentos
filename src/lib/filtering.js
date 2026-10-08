/**
 * Motor de filtrado, conteo facetado y ordenamiento.
 *
 * Semántica:
 *  - Dentro de un mismo grupo, las opciones se combinan con OR.
 *  - Entre grupos distintos, se combina con AND.
 *  - `incluirNacional` (por defecto ON) hace que los beneficios válidos en todo
 *    Chile / "Varias Comunas" aparezcan también al filtrar por región o comuna.
 */

import { hoyEnChile } from './format.js';

export const DEFAULT_STATE = {
  q: '',
  dias: [],
  categorias: [],
  tipos: [],
  regiones: [],
  comunas: [],
  modalidades: [],
  mediosPago: [],
  alcance: [],
  tarjeta: 'todas', // todas | premium | no-premium
  descuentoMin: 0,
  tope: 'todos', // todos | con | sin
  incluirNacional: true,
  sort: 'relevancia',
  vista: 'grid',
};

export function createState(patch = {}) {
  return { ...structuredClone(DEFAULT_STATE), ...patch };
}

const norm = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function coincideTexto(item, needle) {
  const hay = [item.comercio, item.categoria, item.tipo, item.descripcion, ...item.comunas, ...item.regiones]
    .map(norm)
    .join(' ');
  return needle.split(/\s+/).filter(Boolean).every((token) => hay.includes(token));
}

const intersecta = (a, b) => a.some((x) => b.includes(x));

/** Modalidad de un beneficio, mapeada a las claves del filtro. */
export function modalidadesDe(item) {
  return item.canales;
}

export function matches(item, state) {
  if (state.q && !coincideTexto(item, norm(state.q))) return false;

  if (state.dias.length && !intersecta(state.dias, item.dias)) return false;

  if (state.categorias.length && !state.categorias.includes(item.categoria)) return false;

  if (state.tipos.length && !state.tipos.includes(item.tipo)) return false;

  const nacional = item.alcance === 'nacional' || item.comunas.includes('Varias Comunas');
  const incluirNacional = state.incluirNacional && nacional;

  if (state.regiones.length) {
    const hit = intersecta(state.regiones, item.regiones) || incluirNacional;
    if (!hit) return false;
  }

  if (state.comunas.length) {
    const hit = intersecta(state.comunas, item.comunas) || incluirNacional;
    if (!hit) return false;
  }

  if (state.modalidades.length && !intersecta(state.modalidades, modalidadesDe(item))) return false;

  if (state.mediosPago.length) {
    const medios = item.mediosPago === 'AMBOS' ? ['CREDITO', 'DEBITO'] : [item.mediosPago];
    if (!intersecta(state.mediosPago, medios)) return false;
  }

  if (state.alcance.length && !state.alcance.includes(item.alcance)) return false;

  if (state.tarjeta === 'premium' && !item.premiumOnly) return false;
  if (state.tarjeta === 'no-premium' && item.premiumOnly) return false;

  if (state.descuentoMin > 0) {
    if (item.moneda !== 'PORCENTAJE' || item.valor < state.descuentoMin) return false;
  }

  if (state.tope === 'con' && item.tope === null) return false;
  if (state.tope === 'sin' && item.tope !== null) return false;

  return true;
}

export function filtrar(items, state) {
  return items.filter((item) => matches(item, state));
}

/** Cuenta resultados si se aplicara `patch` sobre el estado actual (facets). */
export function contarCon(items, state, patch) {
  return filtrar(items, { ...state, ...patch }).length;
}

const valorOrden = (item) => (item.moneda === 'PORCENTAJE' ? item.valor : item.moneda === 'CLP' ? 0.5 : 0);

export function ordenar(items, state) {
  const arr = [...items];
  const hoy = hoyEnChile();

  switch (state.sort) {
    case 'descuento':
      return arr.sort(
        (a, b) =>
          (b.moneda === 'PORCENTAJE' ? b.valor : -1) - (a.moneda === 'PORCENTAJE' ? a.valor : -1) ||
          a.comercio.localeCompare(b.comercio, 'es'),
      );
    case 'tope':
      return arr.sort((a, b) => (b.tope ?? -1) - (a.tope ?? -1) || a.comercio.localeCompare(b.comercio, 'es'));
    case 'az':
      return arr.sort((a, b) => a.comercio.localeCompare(b.comercio, 'es'));
    case 'hoy':
      return arr.sort((a, b) => {
        const ha = a.dias.includes(hoy) ? 0 : 1;
        const hb = b.dias.includes(hoy) ? 0 : 1;
        return ha - hb || valorOrden(b) - valorOrden(a) || a.comercio.localeCompare(b.comercio, 'es');
      });
    case 'relevancia':
    default:
      return arr.sort((a, b) => {
        if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
        return valorOrden(b) - valorOrden(a) || a.comercio.localeCompare(b.comercio, 'es');
      });
  }
}

/** Regiones disponibles con conteo, respetando el resto de filtros. */
export function regionesDisponibles(items, state, regionesBase) {
  return regionesBase.map((region) => ({
    key: region,
    label: region === 'INTERNACIONAL' ? 'Internacional' : region,
    count: contarCon(items, state, { regiones: [region] }),
  }));
}

/** Comunas visibles: se acotan a las regiones seleccionadas. */
export function comunasDisponibles(items, state, comunasBase) {
  let base = comunasBase;
  if (state.regiones.length) {
    const permitidas = new Set();
    for (const item of items) {
      const coincideRegion = intersecta(state.regiones, item.regiones) || item.alcance === 'nacional';
      if (!coincideRegion) continue;
      item.comunas.forEach((c) => c !== 'Varias Comunas' && permitidas.add(c));
    }
    base = comunasBase.filter((c) => permitidas.has(c));
  }
  return base.map((comuna) => ({
    key: comuna,
    label: comuna,
    count: contarCon(items, state, { comunas: [comuna] }),
  }));
}

/** Cuántos beneficios de todo el universo caen en cada día. */
export function conteoDias(items, state) {
  const base = filtrar(items, { ...state, dias: [] });
  const out = {};
  for (const d of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']) {
    out[d] = base.filter((i) => i.dias.includes(d)).length;
  }
  return out;
}

export const GRUPOS = {
  dias: 'Días',
  categorias: 'Categoría',
  tipos: 'Tipo de beneficio',
  regiones: 'Región',
  comunas: 'Comuna / ciudad',
  modalidades: 'Modalidad',
  mediosPago: 'Medio de pago',
  alcance: 'Cobertura',
  tarjeta: 'Tarjeta',
  descuentoMin: 'Descuento mínimo',
  tope: 'Tope de descuento',
};

/** Descripción legible de los filtros activos (para chips y resumen). */
export function filtrosActivos(state) {
  const out = [];
  if (state.q) out.push({ group: 'q', label: 'Búsqueda', value: `"${state.q}"` });
  if (state.dias.length)
    out.push({
      group: 'dias',
      label: state.dias.length === 1 ? 'Día' : 'Días',
      value: state.dias.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', '),
      values: [...state.dias],
    });
  for (const d of state.categorias) out.push({ group: 'categorias', label: 'Categoría', value: d, values: [d] });
  for (const t of state.tipos) out.push({ group: 'tipos', label: 'Tipo', value: t, values: [t] });
  for (const r of state.regiones)
    out.push({ group: 'regiones', label: 'Región', value: r === 'INTERNACIONAL' ? 'Internacional' : r, values: [r] });
  for (const c of state.comunas) out.push({ group: 'comunas', label: 'Comuna', value: c, values: [c] });
  for (const m of state.modalidades) out.push({ group: 'modalidades', label: 'Modalidad', value: m, values: [m] });
  for (const m of state.mediosPago)
    out.push({
      group: 'mediosPago',
      label: 'Pago',
      value: m === 'CREDITO' ? 'Crédito' : 'Débito',
      values: [m],
    });
  for (const a of state.alcance)
    out.push({ group: 'alcance', label: 'Cobertura', value: a === 'nacional' ? 'Todo Chile' : a === 'regional' ? 'Por región' : 'Internacional', values: [a] });
  if (state.tarjeta !== 'todas')
    out.push({ group: 'tarjeta', label: 'Tarjeta', value: state.tarjeta === 'premium' ? 'Solo Premium' : 'Sin Premium' });
  if (state.descuentoMin > 0) out.push({ group: 'descuentoMin', label: 'Descuento', value: `≥ ${state.descuentoMin}%` });
  if (state.tope !== 'todos') out.push({ group: 'tope', label: 'Tope', value: state.tope === 'con' ? 'Con tope' : 'Sin tope' });
  return out;
}

export function quitarFiltro(state, chip) {
  const next = structuredClone(state);
  switch (chip.group) {
    case 'q':
      next.q = '';
      break;
    case 'tarjeta':
      next.tarjeta = 'todas';
      break;
    case 'descuentoMin':
      next.descuentoMin = 0;
      break;
    case 'tope':
      next.tope = 'todos';
      break;
    default:
      next[chip.group] = (next[chip.group] || []).filter((v) => !chip.values.includes(v));
  }
  return next;
}

export function contarFiltrosActivos(state) {
  return filtrosActivos(state).length;
}
