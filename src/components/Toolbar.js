/** Barra de resultados: contador, orden, vista y chips de filtros activos. */

import { h, icon, clear } from '../lib/dom.js';
import { filtrosActivos, quitarFiltro } from '../lib/filtering.js';
import { hoyEnChile, DIA_LABEL } from '../lib/format.js';

const SORTS = [
  { key: 'relevancia', label: 'Relevancia' },
  { key: 'descuento', label: 'Mayor descuento' },
  { key: 'hoy', label: 'Disponibles hoy primero' },
  { key: 'tope', label: 'Mayor tope de descuento' },
  { key: 'az', label: 'Comercio (A-Z)' },
];

export class Toolbar {
  constructor({ getState, onChange, onReset, onOpenFilters }) {
    this.getState = getState;
    this.onChange = onChange;
    this.onReset = onReset;
    this.onOpenFilters = onOpenFilters;
    this.root = this.#construir();
  }

  #construir() {
    const state = this.getState();
    const hoy = hoyEnChile();

    this.countEl = h('p', { class: 'bx-toolbar__count', role: 'status', 'aria-live': 'polite' });

    const filtrosBtn = h(
      'button',
      { class: 'bx-btn bx-filter-toggle', type: 'button', onclick: () => this.onOpenFilters?.() },
      icon('filter', 15),
      'Filtros',
      h('span', { class: 'bx-filters__count', style: { display: 'none' } }),
    );
    this.mobileBadge = filtrosBtn.querySelector('.bx-filters__count');

    const select = h(
      'select',
      {
        class: 'bx-select',
        'aria-label': 'Ordenar resultados',
        onchange: (e) => this.onChange({ sort: e.target.value }),
      },
      SORTS.map((s) => h('option', { value: s.key, selected: state.sort === s.key }, s.label)),
    );
    this.select = select;

    const mkView = (key, ico, label) =>
      h('button', {
        type: 'button',
        'aria-pressed': String(state.vista === key),
        'aria-label': `Vista ${label}`,
        title: `Vista ${label}`,
        html: icon(ico, 16),
        onclick: () => this.onChange({ vista: key }),
      });
    const btnGrid = mkView('grid', 'grid', 'cuadrícula');
    const btnLista = mkView('lista', 'lista', 'lista');
    this.viewBtns = { grid: btnGrid, lista: btnLista };

    const hint = h(
      'p',
      { style: { margin: '0', fontSize: '12.5px', color: 'var(--ink-500)' } },
      `Hoy es ${DIA_LABEL[hoy] ?? hoy}. Filtra por día para ver solo lo que aplica.`,
    );

    this.chips = h('div', { class: 'bx-active', 'aria-label': 'Filtros activos' });

    return h(
      'div',
      { class: 'bx-toolbar' },
      h(
        'div',
        { class: 'bx-toolbar__row' },
        this.countEl,
        filtrosBtn,
        h(
          'div',
          { class: 'bx-field' },
          h('label', { for: 'bx-sort' }, 'Ordenar por'),
          select,
        ),
        h('div', { class: 'bx-viewtoggle', role: 'group', 'aria-label': 'Vista de resultados' }, btnGrid, btnLista),
      ),
      hint,
      this.chips,
    );
  }

  update(total, sinFiltros) {
    const state = this.getState();
    clear(this.chips);

    const activos = filtrosActivos(state);
    this.countEl.innerHTML = '';
    this.countEl.append(
      h('b', {}, String(total)),
      ` ${total === 1 ? 'beneficio encontrado' : 'beneficios encontrados'}`,
      total !== sinFiltros ? h('em', {}, ` de ${sinFiltros} en total`) : '',
    );

    this.mobileBadge.textContent = String(activos.length);
    this.mobileBadge.style.display = activos.length ? '' : 'none';

    if (!activos.length) return;

    for (const chip of activos) {
      this.chips.append(
        h(
          'span',
          { class: 'bx-chip' },
          `${chip.label}: `,
          h('b', {}, chip.value),
          h('button', {
            type: 'button',
            'aria-label': `Quitar filtro ${chip.label} ${chip.value}`,
            html: icon('close', 11),
            onclick: () => this.onChange(quitarFiltro(state, chip)),
          }),
        ),
      );
    }

    this.chips.append(
      h(
        'button',
        { class: 'bx-btn bx-btn--ghost', type: 'button', style: { marginLeft: 'auto' }, onclick: () => this.onReset() },
        'Limpiar todo',
      ),
    );
  }
}

/** Estado vacío con salidas concretas para el usuario. */
export function EmptyState({ state, onPatch, onReset, sugerencias }) {
  const pistas = [];

  if (state.dias.length === 2 && state.dias.includes('sabado') && state.dias.includes('domingo')) {
    pistas.push({ label: 'Buscar también en semana', patch: { dias: [] } });
  } else if (state.dias.length) {
    pistas.push({ label: 'Quitar filtro de día', patch: { dias: [] } });
  }
  if (state.regiones.length || state.comunas.length) {
    pistas.push({ label: 'Quitar región y comuna', patch: { regiones: [], comunas: [] } });
  }
  if (!state.incluirNacional) {
    pistas.push({ label: 'Incluir beneficios de todo Chile', patch: { incluirNacional: true } });
  }
  if (state.descuentoMin > 0) pistas.push({ label: 'Bajar el descuento mínimo', patch: { descuentoMin: 0 } });
  if (state.q) pistas.push({ label: `Quitar búsqueda "${state.q}"`, patch: { q: '' } });

  const cats = sugerencias?.slice(0, 4) ?? [];

  return h(
    'div',
    { class: 'bx-empty' },
    h('div', { class: 'bx-empty__icon', html: icon('inbox', 30) }),
    h('h3', {}, 'No encontramos beneficios con esos filtros'),
    h('p', {}, 'Prueba quitando una condición o ampliando la zona. Los beneficios de cobertura nacional aparecen en cualquier región.'),
    h(
      'div',
      { class: 'bx-empty__actions' },
      pistas.map((p) => h('button', { class: 'bx-btn', type: 'button', onclick: () => onPatch(p.patch) }, p.label)),
      h('button', { class: 'bx-btn bx-btn--primary', type: 'button', onclick: () => onReset() }, 'Limpiar todos los filtros'),
    ),
    cats.length
      ? h(
          'div',
          { class: 'bx-sugg' },
          h('span', { style: { fontSize: '12.5px', color: 'var(--ink-500)', alignSelf: 'center' } }, 'Explorar:'),
          cats.map((c) =>
            h(
              'button',
              { class: 'bx-preset', type: 'button', onclick: () => onPatch({ categorias: [c], dias: [], regiones: [], comunas: [], q: '' }) },
              c,
            ),
          ),
        )
      : null,
  );
}
