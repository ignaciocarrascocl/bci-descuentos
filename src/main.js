/**
 * Bci Beneficios — Buscador y filtros.
 * Punto de entrada: arma el bloque de filtros + resultados y sincroniza estado.
 */

import { h, clear, icon, debounce } from './lib/dom.js';
import { createState, filtrar, ordenar, filtrosActivos } from './lib/filtering.js';
import { estadoDesdeURL, sincronizarURL } from './lib/url.js';
import { FilterPanel } from './components/FilterPanel.js';
import { ResultCard, ResultCardSkeleton } from './components/ResultCard.js';
import { Toolbar, EmptyState } from './components/Toolbar.js';

const datos = await cargarDatos();
const ITEMS = datos.beneficios;
const META = datos.meta;
const FACETAS = datos.facetas;
const PAGE_SIZE = 24;
const FAV_KEY = 'bci-beneficios:favoritos';

/**
 * El dataset se carga en runtime para que el mismo código funcione con Vite
 * (dev/build) y servido como ESM plano, sin paso de bundling.
 */
async function cargarDatos() {
  const res = await fetch('data/beneficios.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar el dataset (HTTP ${res.status})`);
  return res.json();
}

/* ------------------------------------------------------------------ estado */
let state = estadoDesdeURL();
let visibles = PAGE_SIZE;
let favoritos = new Set(leerFavoritos());

function leerFavoritos() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
  } catch {
    return [];
  }
}

function guardarFavoritos() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favoritos]));
  } catch {
    /* almacenamiento no disponible */
  }
}

/* --------------------------------------------------------------- estructura */
const lista = h('ul', { class: 'bx-grid', dataset: { vista: state.vista }, 'aria-label': 'Resultados de beneficios' });
const loadMoreWrap = h('div', { class: 'bx-loadmore' });
const emptyWrap = h('div', {});

const app = h('div', { class: 'bx-app', dataset: { drawerOpen: 'false' } });

const panel = new FilterPanel({
  items: ITEMS,
  meta: { facetas: FACETAS, meta: META },
  getState: () => state,
  onChange: (patch) => actualizar(patch),
  onReset: () => resetear(),
  onClose: () => cerrarDrawer(),
});

const toolbar = new Toolbar({
  getState: () => state,
  onChange: (patch) => actualizar(patch),
  onReset: () => resetear(),
  onOpenFilters: () => abrirDrawer(),
});

const toast = h('div', { class: 'bx-toast', role: 'status', 'aria-live': 'polite' });

app.append(panel.root, h('section', { class: 'bx-results', 'aria-label': 'Beneficios' }, toolbar.root, emptyWrap, lista, loadMoreWrap));
document.getElementById('app').append(app, toast);

/* ------------------------------------------------------------------ render */
function actualizar(patch = {}, { resetPagina = true } = {}) {
  state = { ...state, ...patch };
  if (resetPagina) visibles = PAGE_SIZE;
  sincronizarURL(state);
  render();
}

function resetear() {
  state = createState({ vista: state.vista });
  visibles = PAGE_SIZE;
  sincronizarURL(state);
  render();
}

function render() {
  panel.update();
  toolbar.update(filtrar(ITEMS, state).length, ITEMS.length);
  renderResultados();
  app.dataset.drawerOpen = app.dataset.drawerOpen === 'true' ? 'true' : 'false';
}

function renderResultados() {
  lista.dataset.vista = state.vista;
  toolbar.viewBtns.grid.setAttribute('aria-pressed', String(state.vista === 'grid'));
  toolbar.viewBtns.lista.setAttribute('aria-pressed', String(state.vista === 'lista'));

  const encontrados = ordenar(filtrar(ITEMS, state), state);
  clear(lista);
  clear(loadMoreWrap);
  clear(emptyWrap);

  if (encontrados.length === 0) {
    emptyWrap.append(
      EmptyState({
        state,
        onPatch: (patch) => actualizar(patch),
        onReset: () => resetear(),
        sugerencias: FACETAS.categorias,
      }),
    );
    return;
  }

  const pagina = encontrados.slice(0, visibles);
  const frag = document.createDocumentFragment();
  pagina.forEach((item, i) => {
    const card = ResultCard({
      item,
      favorito: favoritos.has(item.id),
      onFavorito: (it, on) => {
        if (on) favoritos.add(it.id);
        else favoritos.delete(it.id);
        guardarFavoritos();
        mostrarToast(on ? `${it.comercio} guardado en favoritos` : `${it.comercio} quitado de favoritos`);
      },
      onCta: (it) => copiarBeneficio(it),
    });
    card.style.animationDelay = `${Math.min(i, 12) * 22}ms`;
    frag.append(card);
  });
  lista.append(frag);

  if (encontrados.length > visibles) {
    const restantes = encontrados.length - visibles;
    loadMoreWrap.append(
      h(
        'button',
        {
          class: 'bx-btn',
          type: 'button',
          onclick: () => {
            visibles += PAGE_SIZE;
            renderResultados();
          },
        },
        icon('plus', 15),
        `Mostrar ${Math.min(PAGE_SIZE, restantes)} más`,
        h('span', { style: { color: 'var(--ink-400)', fontWeight: '500' } }, `(quedan ${restantes})`),
      ),
    );
  }
}

/* -------------------------------------------------------------- interacción */
function abrirDrawer() {
  app.dataset.drawerOpen = 'true';
  document.body.style.overflow = 'hidden';
}

function cerrarDrawer() {
  app.dataset.drawerOpen = 'false';
  document.body.style.overflow = '';
}

app.addEventListener('click', (e) => {
  if (e.target === app && app.dataset.drawerOpen === 'true') cerrarDrawer();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && app.dataset.drawerOpen === 'true') cerrarDrawer();
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
    e.preventDefault();
    panel.searchInput?.focus();
  }
});

function mostrarToast(msg) {
  toast.textContent = msg;
  toast.dataset.show = 'true';
  clearTimeout(mostrarToast.t);
  mostrarToast.t = setTimeout(() => {
    toast.dataset.show = 'false';
  }, 2200);
}

async function copiarBeneficio(item) {
  const texto = `${item.comercio} — ${item.valorTexto} (${item.categoria}). ${item.descripcion}. Días: ${item.dias.join(', ')}.`;
  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast('Detalle copiado al portapapeles');
  } catch {
    mostrarToast(texto);
  }
}

/* Primer pintado: skeletons para percibir velocidad, luego contenido real. */
(function primerPintado() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 8; i += 1) frag.append(ResultCardSkeleton());
  lista.append(frag);
  requestAnimationFrame(() => {
    clear(lista);
    render();
  });
})();

const onResize = debounce(() => {
  if (window.innerWidth > 1080 && app.dataset.drawerOpen === 'true') cerrarDrawer();
}, 150);
window.addEventListener('resize', onResize);
