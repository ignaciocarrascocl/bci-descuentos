/** Sincroniza el estado de filtros con la URL (enlaces compartibles). */

import { DEFAULT_STATE, createState } from './filtering.js';

const LIST_KEYS = ['dias', 'categorias', 'tipos', 'regiones', 'comunas', 'modalidades', 'mediosPago', 'alcance'];
const SCALAR_KEYS = ['q', 'tarjeta', 'tope', 'sort', 'vista'];

export function estadoDesdeURL(search = window.location.search) {
  const params = new URLSearchParams(search);
  const patch = {};
  for (const key of LIST_KEYS) {
    const raw = params.get(key);
    if (raw) patch[key] = raw.split('~').filter(Boolean);
  }
  for (const key of SCALAR_KEYS) {
    const raw = params.get(key);
    if (raw !== null) patch[key] = raw;
  }
  if (params.has('descuentoMin')) patch.descuentoMin = Number(params.get('descuentoMin')) || 0;
  if (params.has('nacional')) patch.incluirNacional = params.get('nacional') !== '0';

  const state = createState(patch);
  // Saneamiento: descarta claves desconocidas.
  for (const key of Object.keys(state)) if (!(key in DEFAULT_STATE)) delete state[key];
  if (!['todas', 'premium', 'no-premium'].includes(state.tarjeta)) state.tarjeta = 'todas';
  if (!['todos', 'con', 'sin'].includes(state.tope)) state.tope = 'todos';
  if (!['grid', 'lista'].includes(state.vista)) state.vista = 'grid';
  if (!['relevancia', 'descuento', 'tope', 'az', 'hoy'].includes(state.sort)) state.sort = 'relevancia';
  return state;
}

export function urlDesdeEstado(state) {
  const params = new URLSearchParams();
  for (const key of LIST_KEYS) if (state[key]?.length) params.set(key, state[key].join('~'));
  for (const key of SCALAR_KEYS) {
    const def = DEFAULT_STATE[key];
    if (state[key] && state[key] !== def) params.set(key, state[key]);
  }
  if (state.descuentoMin > 0) params.set('descuentoMin', String(state.descuentoMin));
  if (state.incluirNacional !== DEFAULT_STATE.incluirNacional) params.set('nacional', state.incluirNacional ? '1' : '0');
  const qs = params.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
}

export function sincronizarURL(state) {
  try {
    window.history.replaceState(null, '', urlDesdeEstado(state));
  } catch {
    /* history no disponible (file://); se ignora */
  }
}
