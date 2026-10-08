/**
 * Panel de filtros (columna izquierda). Se construye una sola vez y luego se
 * actualiza en el lugar para no perder foco ni posición de scroll.
 */

import { h, icon, clear } from '../lib/dom.js';
import { DIAS, MODALIDADES, ALCANCES, hoyEnChile, fechaCorta, formatCLP } from '../lib/format.js';
import { contarCon, conteoDias, comunasDisponibles, regionesDisponibles, filtrosActivos } from '../lib/filtering.js';

const OPCION_TODOS = 'todas';

export class FilterPanel {
  constructor({ items, meta, getState, onChange, onReset, onClose }) {
    this.items = items;
    this.meta = meta;
    this.getState = getState;
    this.onChange = onChange;
    this.onReset = onReset;
    this.onClose = onClose;

    this.abiertos = new Set(['dias', 'regiones', 'comunas']);
    this.busquedaRegion = '';
    this.busquedaComuna = '';
    this.updaters = [];
    this.root = this.#construir();
  }

  #patch(patch) {
    this.onChange(patch);
  }

  #toggleLista(key, value) {
    const state = this.getState();
    const actual = state[key] || [];
    const next = actual.includes(value) ? actual.filter((v) => v !== value) : [...actual, value];
    this.#patch({ [key]: next });
  }

  #grupo({ id, label, hint, build, abierto = false, badge = true }) {
    const count = h('span', { class: 'bx-group__badge', style: { display: 'none' } });
    const inner = h('div', { class: 'bx-group__inner' });
    const pad = h('div', { class: 'bx-group__pad' });
    inner.append(pad);

    const head = h(
      'button',
      {
        class: 'bx-group__head',
        type: 'button',
        'aria-expanded': String(this.abiertos.has(id)),
        'aria-controls': `bx-body-${id}`,
        onclick: () => {
          const abrir = !this.abiertos.has(id);
          if (abrir) this.abiertos.add(id);
          else this.abiertos.delete(id);
          group.dataset.open = String(abrir);
          head.setAttribute('aria-expanded', String(abrir));
        },
      },
      h('span', { class: 'bx-group__label' }, label),
      count,
      h('span', { class: 'bx-group__chevron', html: icon('chevron', 15) }),
    );

    const body = h('div', { class: 'bx-group__body', id: `bx-body-${id}` }, inner);
    const group = h('div', { class: 'bx-group', dataset: { open: String(this.abiertos.has(id) || abierto) } }, head, body);

    if (hint) pad.append(h('p', { class: 'bx-hint', style: { margin: '0 8px 8px', fontSize: '12px', color: 'var(--ink-500)' } }, hint));

    const api = build(pad);
    pad.append(...(api.nodes || []));

    this.updaters.push((state) => {
      const activos = api.activos ? api.activos(state) : 0;
      if (badge) {
        count.textContent = String(activos);
        count.style.display = activos > 0 ? '' : 'none';
      }
      api.update?.(state);
    });

    return group;
  }

  #opcionCheckbox({ group, value, label, count, checked, tipo = 'check', hint }) {
    const input = h('input', {
      type: tipo === 'radio' ? 'radio' : 'checkbox',
      name: `bx-${group}`,
      checked,
      onchange: () => (tipo === 'radio' ? this.#patch({ [group]: value }) : this.#toggleLista(group, value)),
    });

    return h(
      'label',
      { class: 'bx-opt', dataset: { type: tipo } },
      input,
      h('span', { class: 'bx-opt__box', html: icon('check', 12) }),
      h(
        'span',
        { class: 'bx-opt__text' },
        label,
        hint ? h('span', { style: { display: 'block', fontSize: '11.5px', color: 'var(--ink-400)', fontWeight: '400' } }, hint) : null,
      ),
      h('span', { class: 'bx-opt__n' }, count === null || count === undefined ? '' : String(count)),
    );
  }

  #construir() {
    const state = this.getState();

    /* ---- Encabezado + búsqueda ---- */
    const searchInput = h('input', {
      type: 'search',
      placeholder: 'Buscar comercio, categoría o comuna…',
      'aria-label': 'Buscar beneficio',
      autocomplete: 'off',
      value: state.q,
      oninput: (e) => this.#patch({ q: e.target.value }),
    });
    const searchWrap = h(
      'div',
      { class: 'bx-search', dataset: { filled: String(Boolean(state.q)) } },
      h('span', { class: 'bx-search__icon', html: icon('search', 17) }),
      searchInput,
      h('button', {
        class: 'bx-search__clear',
        type: 'button',
        'aria-label': 'Limpiar búsqueda',
        html: icon('close', 12),
        onclick: () => {
          searchInput.value = '';
          this.#patch({ q: '' });
        },
      }),
    );
    this.searchInput = searchInput;
    this.searchWrap = searchWrap;

    const activosBadge = h('span', { class: 'bx-filters__count', style: { display: 'none' } });
    const limpiarBtn = h(
      'button',
      { class: 'bx-btn bx-btn--ghost', type: 'button', title: 'Limpiar todos los filtros', onclick: () => this.onReset() },
      icon('close', 13),
      'Limpiar',
    );

    /* ---- Día de la semana ---- */
    const grupoDias = this.#grupo({
      id: 'dias',
      label: 'Día de la semana',
      build: (pad) => {
        const grid = h('div', { class: 'bx-days', role: 'group', 'aria-label': 'Filtrar por día de la semana' });
        const botones = new Map();
        for (const dia of DIAS) {
          const n = h('span', { class: 'bx-day__n' }, '');
          const btn = h(
            'button',
            {
              class: 'bx-day',
              type: 'button',
              'aria-pressed': 'false',
              title: dia.label,
              onclick: () => this.#toggleLista('dias', dia.key),
            },
            h('span', { class: 'bx-day__l' }, dia.letter),
            n,
          );
          botones.set(dia.key, { btn, n });
          grid.append(btn);
        }

        const hoy = hoyEnChile();
        const presets = h('div', { class: 'bx-presets' });
        const mk = (label, dias, title) =>
          h(
            'button',
            {
              class: 'bx-preset',
              type: 'button',
              title,
              onclick: () => this.#patch({ dias }),
            },
            label,
          );
        presets.append(
          mk(`Hoy · ${DIAS.find((d) => d.key === hoy).label}`, [hoy], `Beneficios disponibles hoy (${fechaCorta()})`),
          mk('Fin de semana', ['sabado', 'domingo'], 'Sábado y domingo'),
          mk('Lun a vie', ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'], 'Días de semana'),
          mk('Todos los días', [...DIAS.map((d) => d.key)], 'Beneficios sin restricción de día'),
        );

        const nota = h(
          'p',
          { style: { margin: '8px 8px 0', fontSize: '11.5px', color: 'var(--ink-400)', lineHeight: '1.4' } },
          'Los días son referenciales: el dataset de origen no incluye programación semanal.',
        );

        return {
          nodes: [grid, presets, nota],
          activos: (s) => s.dias.length,
          update: (s) => {
            const counts = conteoDias(this.items, s);
            for (const [key, { btn, n }] of botones) {
              const on = s.dias.includes(key);
              btn.setAttribute('aria-pressed', String(on));
              btn.dataset.today = String(key === hoy);
              if (key === hoy && !on) btn.style.borderColor = 'var(--bci-blue-500)';
              else if (!on) btn.style.borderColor = '';
              n.textContent = counts[key] ?? '0';
            }
          },
        };
      },
    });

    /* ---- Categoría ---- */
    const grupoCategoria = this.#grupo({
      id: 'categorias',
      label: 'Categoría',
      build: (pad) => {
        const rows = this.meta.facetas.categorias.map((cat) => {
          const row = this.#opcionCheckbox({ group: 'categorias', value: cat, label: cat, count: 0, checked: state.categorias.includes(cat) });
          const input = row.querySelector('input');
          const n = row.querySelector('.bx-opt__n');
          return { cat, row, input, n };
        });
        return {
          nodes: rows.map((r) => r.row),
          activos: (s) => s.categorias.length,
          update: (s) => {
            for (const r of rows) {
              r.input.checked = s.categorias.includes(r.cat);
              const c = contarCon(this.items, s, { categorias: [r.cat] });
              r.n.textContent = String(c);
              r.row.dataset.disabled = String(c === 0 && !s.categorias.includes(r.cat));
              r.input.disabled = c === 0 && !s.categorias.includes(r.cat);
            }
          },
        };
      },
    });

    /* ---- Tipo de beneficio ---- */
    const grupoTipo = this.#grupo({
      id: 'tipos',
      label: 'Tipo de beneficio',
      build: (pad) => {
        const defs = [
          { key: 'Descuento', label: 'Descuento', hint: 'Rebaja directa en el precio' },
          { key: 'Cashback', label: 'Cashback / puntos', hint: 'Acumulación o devolución' },
        ];
        const rows = defs.map((d) => {
          const row = this.#opcionCheckbox({ group: 'tipos', value: d.key, label: d.label, hint: d.hint, count: 0, checked: state.tipos.includes(d.key) });
          return { ...d, row, input: row.querySelector('input'), n: row.querySelector('.bx-opt__n') };
        });
        return {
          nodes: rows.map((r) => r.row),
          activos: (s) => s.tipos.length,
          update: (s) => {
            for (const r of rows) {
              r.input.checked = s.tipos.includes(r.key);
              const c = contarCon(this.items, s, { tipos: [r.key] });
              r.n.textContent = String(c);
              r.input.disabled = c === 0 && !s.tipos.includes(r.key);
              r.row.dataset.disabled = String(c === 0 && !s.tipos.includes(r.key));
            }
          },
        };
      },
    });

    /* ---- Región ---- */
    const grupoRegion = this.#grupo({
      id: 'regiones',
      label: 'Región',
      build: (pad) => {
        const mini = h('input', {
          type: 'search',
          placeholder: 'Filtrar regiones…',
          'aria-label': 'Filtrar lista de regiones',
          autocomplete: 'off',
          oninput: (e) => {
            this.busquedaRegion = e.target.value;
            refrescarLista();
          },
        });
        this.regionSearch = mini;
        const miniWrap = h('div', { class: 'bx-mini-search' }, h('span', { html: icon('search', 13) }), mini);

        const lista = h('div', { class: 'bx-scroll-list', role: 'group', 'aria-label': 'Regiones' });
        const vacio = h('p', { class: 'bx-empty-mini', style: { display: 'none' } }, 'Sin regiones que coincidan.');

        const rowsRef = new Map();
        let cache = [];
        const refrescarLista = () => {
          const s = this.getState();
          const filtro = this.busquedaRegion.trim().toLowerCase();
          cache = regionesDisponibles(this.items, s, this.meta.facetas.regiones).filter((r) =>
            r.label.toLowerCase().includes(filtro),
          );
          clear(lista);
          rowsRef.clear();
          if (!cache.length) {
            vacio.style.display = '';
            return;
          }
          vacio.style.display = 'none';
          const ordenadas = [...cache].sort((a, b) => {
            const sa = s.regiones.includes(a.key) ? 0 : 1;
            const sb = s.regiones.includes(b.key) ? 0 : 1;
            return sa - sb || a.label.localeCompare(b.label, 'es');
          });
          for (const reg of ordenadas) {
            const row = this.#opcionCheckbox({
              group: 'regiones',
              value: reg.key,
              label: reg.label,
              count: reg.count,
              checked: s.regiones.includes(reg.key),
            });
            rowsRef.set(reg.key, row);
            lista.append(row);
          }
        };

        const switchNacional = h(
          'label',
          { class: 'bx-switch' },
          h('input', {
            type: 'checkbox',
            checked: state.incluirNacional,
            onchange: (e) => this.#patch({ incluirNacional: e.target.checked }),
          }),
          h('span', { class: 'bx-switch__track' }),
          h(
            'span',
            { class: 'bx-switch__text' },
            h('b', {}, 'Incluir beneficios de todo Chile'),
            h('span', { style: { display: 'block' } }, 'Comercios con cobertura nacional o "varias comunas".'),
          ),
        );

        return {
          nodes: [miniWrap, lista, vacio, h('div', { style: { marginTop: '8px' } }, switchNacional)],
          activos: (s) => s.regiones.length,
          update: (s) => {
            switchNacional.querySelector('input').checked = s.incluirNacional;
            refrescarLista();
            for (const [key, row] of rowsRef) {
              const input = row.querySelector('input');
              input.checked = s.regiones.includes(key);
            }
          },
        };
      },
    });

    /* ---- Comuna ---- */
    const grupoComuna = this.#grupo({
      id: 'comunas',
      label: 'Comuna / ciudad',
      build: (pad) => {
        const mini = h('input', {
          type: 'search',
          placeholder: 'Filtrar comunas…',
          'aria-label': 'Filtrar lista de comunas',
          autocomplete: 'off',
          oninput: (e) => {
            this.busquedaComuna = e.target.value;
            refrescarLista();
          },
        });
        this.comunaSearch = mini;
        const miniWrap = h('div', { class: 'bx-mini-search' }, h('span', { html: icon('search', 13) }), mini);
        const lista = h('div', { class: 'bx-scroll-list', role: 'group', 'aria-label': 'Comunas' });
        const vacio = h('p', { class: 'bx-empty-mini', style: { display: 'none' } }, 'Sin comunas para las regiones seleccionadas.');

        const refrescarLista = () => {
          const s = this.getState();
          const filtro = this.busquedaComuna.trim().toLowerCase();
          const todas = comunasDisponibles(this.items, s, this.meta.facetas.comunas).filter((c) =>
            c.label.toLowerCase().includes(filtro),
          );
          clear(lista);
          if (!todas.length) {
            vacio.style.display = '';
            return;
          }
          vacio.style.display = 'none';
          const ordenadas = [...todas].sort((a, b) => {
            const sa = s.comunas.includes(a.key) ? 0 : 1;
            const sb = s.comunas.includes(b.key) ? 0 : 1;
            if (sa !== sb) return sa - sb;
            if (b.count !== a.count) return b.count - a.count;
            return a.label.localeCompare(b.label, 'es');
          });
          for (const com of ordenadas.slice(0, 120)) {
            lista.append(
              this.#opcionCheckbox({
                group: 'comunas',
                value: com.key,
                label: com.label,
                count: com.count,
                checked: s.comunas.includes(com.key),
              }),
            );
          }
        };

        return {
          nodes: [miniWrap, lista, vacio],
          activos: (s) => s.comunas.length,
          update: () => refrescarLista(),
        };
      },
    });

    /* ---- Modalidad ---- */
    const grupoModalidad = this.#grupo({
      id: 'modalidades',
      label: 'Modalidad de uso',
      build: (pad) => {
        const rows = MODALIDADES.map((m) => {
          const row = this.#opcionCheckbox({ group: 'modalidades', value: m.key, label: m.label, hint: m.hint, count: 0, checked: state.modalidades.includes(m.key) });
          return { ...m, row, input: row.querySelector('input'), n: row.querySelector('.bx-opt__n') };
        });
        return {
          nodes: rows.map((r) => r.row),
          activos: (s) => s.modalidades.length,
          update: (s) => {
            for (const r of rows) {
              r.input.checked = s.modalidades.includes(r.key);
              const c = contarCon(this.items, s, { modalidades: [r.key] });
              r.n.textContent = String(c);
              r.input.disabled = c === 0 && !s.modalidades.includes(r.key);
              r.row.dataset.disabled = String(c === 0 && !s.modalidades.includes(r.key));
            }
          },
        };
      },
    });

    /* ---- Pago y tarjeta ---- */
    const grupoPago = this.#grupo({
      id: 'pago',
      label: 'Pago y tarjeta',
      build: (pad) => {
        const medios = [
          { key: 'CREDITO', label: 'Tarjeta de crédito' },
          { key: 'DEBITO', label: 'Tarjeta de débito' },
        ].map((m) => {
          const row = this.#opcionCheckbox({ group: 'mediosPago', value: m.key, label: m.label, count: 0, checked: state.mediosPago.includes(m.key) });
          return { ...m, row, input: row.querySelector('input'), n: row.querySelector('.bx-opt__n') };
        });

        const tarjetas = [
          { key: 'todas', label: 'Cualquier tarjeta' },
          { key: 'no-premium', label: 'Solo beneficios sin requisito Premium', hint: 'Excluye los exclusivos Premium/Black' },
          { key: 'premium', label: 'Solo exclusivos Premium / Black' },
        ].map((t) => {
          const row = this.#opcionCheckbox({ group: 'tarjeta', tipo: 'radio', value: t.key, label: t.label, hint: t.hint, count: null, checked: state.tarjeta === t.key });
          return { ...t, row, input: row.querySelector('input') };
        });

        return {
          nodes: [
            ...medios.map((m) => m.row),
            h(
              'div',
              { style: { margin: '10px 8px 4px', fontSize: '11px', fontWeight: '700', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-400)' } },
              'Segmento de tarjeta',
            ),
            ...tarjetas.map((t) => t.row),
          ],
          activos: (s) => s.mediosPago.length + (s.tarjeta !== OPCION_TODOS ? 1 : 0),
          update: (s) => {
            for (const m of medios) {
              m.input.checked = s.mediosPago.includes(m.key);
              const c = contarCon(this.items, s, { mediosPago: [m.key] });
              m.n.textContent = String(c);
              m.input.disabled = c === 0 && !s.mediosPago.includes(m.key);
              m.row.dataset.disabled = String(c === 0 && !s.mediosPago.includes(m.key));
            }
            for (const t of tarjetas) t.input.checked = s.tarjeta === t.key;
          },
        };
      },
    });

    /* ---- Descuento mínimo ---- */
    const grupoDescuento = this.#grupo({
      id: 'descuentoMin',
      label: 'Descuento mínimo',
      build: (pad) => {
        const val = h('span', { class: 'bx-slider__val' }, 'Cualquiera');
        const range = h('input', {
          type: 'range',
          min: '0',
          max: '50',
          step: '5',
          value: String(state.descuentoMin),
          'aria-label': 'Descuento mínimo en porcentaje',
          oninput: (e) => {
            const v = Number(e.target.value);
            range.style.setProperty('--fill', `${(v / 50) * 100}%`);
            val.textContent = v === 0 ? 'Cualquiera' : `${v}% o más`;
            this.#patch({ descuentoMin: v });
          },
        });
        const wrap = h(
          'div',
          { class: 'bx-slider' },
          h('div', { class: 'bx-slider__head' }, val, h('span', { style: { fontSize: '12px', color: 'var(--ink-400)' } }, 'solo %')),
          range,
          h(
            'div',
            { class: 'bx-slider__ticks' },
            h('span', {}, '0%'),
            h('span', {}, '25%'),
            h('span', {}, '50%+'),
          ),
        );
        const nota = h('p', { style: { margin: '6px 8px 0', fontSize: '11.5px', color: 'var(--ink-400)' } }, 'Al usarlo se muestran solo beneficios expresados en porcentaje.');

        return {
          nodes: [wrap, nota],
          activos: (s) => (s.descuentoMin > 0 ? 1 : 0),
          update: (s) => {
            range.value = String(s.descuentoMin);
            range.style.setProperty('--fill', `${(s.descuentoMin / 50) * 100}%`);
            val.textContent = s.descuentoMin === 0 ? 'Cualquiera' : `${s.descuentoMin}% o más`;
          },
        };
      },
    });

    /* ---- Tope ---- */
    const grupoTope = this.#grupo({
      id: 'tope',
      label: 'Tope de descuento',
      build: (pad) => {
        const defs = [
          { key: 'todos', label: 'Todos' },
          { key: 'con', label: 'Con tope definido' },
          { key: 'sin', label: 'Sin tope (descuento completo)' },
        ];
        const rows = defs.map((d) => {
          const row = this.#opcionCheckbox({ group: 'tope', tipo: 'radio', value: d.key, label: d.label, count: null, checked: state.tope === d.key });
          return { ...d, row, input: row.querySelector('input') };
        });
        const conteos = { todos: h('span', {}), con: h('span', {}), sin: h('span', {}) };
        const filas = rows.map((r) => {
          const n = h('span', { class: 'bx-opt__n' }, '');
          r.row.append(n);
          return { ...r, n };
        });
        void conteos;
        return {
          nodes: filas.map((f) => f.row),
          activos: (s) => (s.tope !== 'todos' ? 1 : 0),
          update: (s) => {
            for (const f of filas) {
              f.input.checked = s.tope === f.key;
              const patch = f.key === 'todos' ? { tope: 'todos' } : { tope: f.key };
              f.n.textContent = String(contarCon(this.items, s, patch));
            }
          },
        };
      },
    });

    /* ---- Cobertura ---- */
    const grupoAlcance = this.#grupo({
      id: 'alcance',
      label: 'Cobertura geográfica',
      build: (pad) => {
        const rows = ALCANCES.map((a) => {
          const row = this.#opcionCheckbox({ group: 'alcance', value: a.key, label: a.label, count: 0, checked: state.alcance.includes(a.key) });
          return { ...a, row, input: row.querySelector('input'), n: row.querySelector('.bx-opt__n') };
        });
        return {
          nodes: rows.map((r) => r.row),
          activos: (s) => s.alcance.length,
          update: (s) => {
            for (const r of rows) {
              r.input.checked = s.alcance.includes(r.key);
              const c = contarCon(this.items, s, { alcance: [r.key] });
              r.n.textContent = String(c);
              r.input.disabled = c === 0 && !s.alcance.includes(r.key);
              r.row.dataset.disabled = String(c === 0 && !s.alcance.includes(r.key));
            }
          },
        };
      },
    });

    /* ---- Nota de datos ---- */
    const notaDatos = h(
      'div',
      {
        style: {
          marginTop: '10px',
          padding: '10px 12px',
          background: 'var(--amber-50)',
          border: '1px solid #fde68a',
          borderRadius: '10px',
          fontSize: '11.5px',
          color: '#78350f',
          lineHeight: '1.45',
        },
      },
      h('b', {}, 'Días referenciales. '),
      'El archivo de origen no trae programación por día ni tope de comuna por beneficio; esos campos se derivan de forma determinista para que el filtro sea usable.',
    );

    const cerrarBtn = h(
      'button',
      { class: 'bx-btn', type: 'button', onclick: () => this.onClose?.() },
      'Ver resultados',
    );
    const limpiarMobile = h('button', { class: 'bx-btn', type: 'button', onclick: () => this.onReset() }, 'Limpiar');

    const root = h(
      'aside',
      { class: 'bx-filters', 'aria-label': 'Filtros de beneficios' },
      h(
        'div',
        { class: 'bx-filters__top' },
        h('h2', { class: 'bx-filters__title' }, 'Filtros', activosBadge),
        limpiarBtn,
      ),
      searchWrap,
      h(
        'div',
        { class: 'bx-filters__scroll' },
        grupoDias,
        grupoRegion,
        grupoComuna,
        grupoCategoria,
        grupoTipo,
        grupoModalidad,
        grupoPago,
        grupoDescuento,
        grupoTope,
        grupoAlcance,
        notaDatos,
      ),
      h('div', { class: 'bx-filters__foot' }, limpiarMobile, cerrarBtn),
    );

    this.activosBadge = activosBadge;
    return root;
  }

  update() {
    const state = this.getState();
    if (this.searchInput.value !== state.q) this.searchInput.value = state.q;
    this.searchWrap.dataset.filled = String(Boolean(state.q));
    const n = filtrosActivos(state).length;
    this.activosBadge.textContent = String(n);
    this.activosBadge.style.display = n > 0 ? '' : 'none';
    for (const fn of this.updaters) fn(state);
  }
}
