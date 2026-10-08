/** Tarjeta de beneficio (grid y lista). */

import { h, icon } from '../lib/dom.js';
import { DIAS, DIA_LABEL, hoyEnChile, formatCLP } from '../lib/format.js';

const DIAS_POR_CLAVE = Object.fromEntries(DIAS.map((d) => [d.key, d]));

function diasPills(item) {
  const hoy = hoyEnChile();
  if (item.dias.length === 7) {
    return [h('span', { class: 'bx-pill bx-pill--wide', title: 'Disponible todos los días' }, 'Todos los días')];
  }
  const orden = DIAS.map((d) => d.key).filter((k) => item.dias.includes(k));
  const visibles = orden.slice(0, 4);
  const resto = orden.length - visibles.length;
  const pills = visibles.map((k) =>
    h(
      'span',
      {
        class: `bx-pill${k === hoy ? ' bx-pill--on' : ''}`,
        title: k === hoy ? `${DIA_LABEL[k]} (hoy)` : DIA_LABEL[k],
        'aria-label': k === hoy ? `${DIA_LABEL[k]} (hoy)` : DIA_LABEL[k],
      },
      DIAS_POR_CLAVE[k].letter,
    ),
  );
  if (resto > 0) {
    pills.push(h('span', { class: 'bx-pill', title: orden.slice(4).map((k) => DIA_LABEL[k]).join(', ') }, `+${resto}`));
  }
  return pills;
}

function ubicacionTexto(item) {
  if (item.alcance === 'nacional') return 'Todo Chile';
  if (item.alcance === 'internacional') return 'Internacional';
  const comunas = item.comunas.filter((c) => c !== 'Varias Comunas');
  if (comunas.length) return comunas.slice(0, 2).join(', ') + (comunas.length > 2 ? ` +${comunas.length - 2}` : '');
  return item.regiones.join(', ');
}

export function ResultCard({ item, onCta, onFavorito, favorito = false }) {
  const media = h(
    'div',
    { class: 'bx-card__media' },
    h('img', { src: item.imagen, alt: `Imagen referencial de ${item.comercio}`, loading: 'lazy', decoding: 'async', width: '640', height: '400' }),
    h(
      'div',
      { class: 'bx-card__tags' },
      item.presencial ? h('span', { class: 'bx-tag bx-tag--presencial' }, 'Presencial') : null,
      item.online ? h('span', { class: 'bx-tag bx-tag--online' }, item.canales.includes('APP_PROPIA') ? 'App' : 'Online') : null,
      h('span', { class: 'bx-tag bx-tag--tipo' }, item.tipo),
    ),
    h('div', { class: 'bx-card__logo', style: { color: item.colorFin } }, item.monograma),
  );

  const body = h(
    'div',
    { class: 'bx-card__body' },
    h('h3', { class: 'bx-card__title' }, item.comercio),
    h(
      'p',
      { class: 'bx-card__meta' },
      h('span', {}, item.categoria),
      h('span', { class: 'bx-dot' }),
      h('span', { class: 'bx-card__sede-inline' }, ubicacionTexto(item)),
      item.premiumOnly ? h('span', { class: 'bx-dot' }) : null,
      item.premiumOnly ? h('span', { style: { color: 'var(--bci-blue-700)', fontWeight: '600' } }, 'Premium') : null,
    ),
    h('span', { class: 'bx-card__valor' }, item.valorTexto),
    h('p', { class: 'bx-card__desc' }, item.tope ? `${item.descripcion} (tope ${formatCLP(item.tope)})` : item.descripcion),
    h('div', { class: 'bx-card__dias' }, diasPills(item)),
  );

  const foot = h(
    'div',
    { class: 'bx-card__foot' },
    h(
      'button',
      { class: 'bx-card__cta', type: 'button', onclick: () => onCta?.(item) },
      '¡Lo quiero!',
      h('span', { html: icon('plus', 16) }),
    ),
    h('button', {
      class: 'bx-card__icon',
      type: 'button',
      'aria-pressed': String(favorito),
      'aria-label': favorito ? `Quitar ${item.comercio} de favoritos` : `Guardar ${item.comercio} en favoritos`,
      title: 'Guardar',
      html: icon('heart', 17),
      onclick: (e) => {
        const btn = e.currentTarget;
        const next = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(next));
        onFavorito?.(item, next);
      },
    }),
    h('button', {
      class: 'bx-card__icon',
      type: 'button',
      'aria-label': `Copiar información de ${item.comercio}`,
      title: 'Copiar detalle',
      html: icon('copy', 16),
      onclick: () => onCta?.(item, { copiar: true }),
    }),
  );

  return h('li', { class: 'bx-card' }, media, body, foot);
}

export function ResultCardSkeleton() {
  return h(
    'li',
    { class: 'bx-skel', 'aria-hidden': 'true' },
    h('div', { class: 'bx-skel__media' }),
    h('div', { class: 'bx-skel__line', style: { width: '60%' } }),
    h('div', { class: 'bx-skel__line', style: { width: '85%' } }),
    h('div', { class: 'bx-skel__line', style: { width: '40%' } }),
  );
}
