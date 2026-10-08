/**
 * Verificación del motor de filtrado (sin navegador).
 *   node scripts/check.mjs
 */

import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createState,
  filtrar,
  contarCon,
  ordenar,
  filtrosActivos,
  quitarFiltro,
  comunasDisponibles,
} from '../src/lib/filtering.js';
import { hoyEnChile } from '../src/lib/format.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const datos = JSON.parse(readFileSync(join(ROOT, 'public', 'data', 'beneficios.json'), 'utf8'));
const ITEMS = datos.beneficios;

let fallos = 0;
let pruebas = 0;

function ok(nombre, cond, detalle = '') {
  pruebas += 1;
  if (cond) {
    console.log(`  ok   ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  } else {
    fallos += 1;
    console.log(`  FAIL ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  }
}

console.log('\nDataset');
ok('165 beneficios', ITEMS.length === 165, `${ITEMS.length}`);
ok('todos tienen días', ITEMS.every((i) => i.dias.length > 0));
ok('todos tienen región', ITEMS.every((i) => i.regiones.length > 0));
ok('todos tienen imagen', ITEMS.every((i) => i.imagen.startsWith('/img/comercios/')));
ok('sin mojibake', !ITEMS.some((i) => /Ã|Â/.test(JSON.stringify(i))));
ok('hoy en Chile válido', ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'].includes(hoyEnChile()), hoyEnChile());

console.log('\nSin filtros');
const base = createState();
ok('devuelve todo', filtrar(ITEMS, base).length === 165);
ok('orden por relevancia: primero es destacado', ordenar(filtrar(ITEMS, base), base)[0].destacado === true);

console.log('\nFiltro por día');
const hoy = hoyEnChile();
const soloHoy = createState({ dias: [hoy] });
const nHoy = filtrar(ITEMS, soloHoy).length;
ok(`día actual (${hoy}) filtra`, nHoy > 0 && nHoy < 165, `${nHoy} resultados`);
ok('todos los resultados incluyen el día', filtrar(ITEMS, soloHoy).every((i) => i.dias.includes(hoy)));
const dosDias = createState({ dias: ['sabado', 'domingo'] });
const nFinde = filtrar(ITEMS, dosDias).length;
ok('sábado OR domingo suma más que uno solo', nFinde > filtrar(ITEMS, createState({ dias: ['sabado'] })).length);
ok('incluye ambos días', filtrar(ITEMS, dosDias).every((i) => i.dias.includes('sabado') || i.dias.includes('domingo')));

console.log('\nFiltro por región y comuna');
const rm = createState({ regiones: ['Región Metropolitana'] });
const nRM = filtrar(ITEMS, rm).length;
ok('RM con nacional incluido', nRM > 0, `${nRM}`);
const rmEstricto = createState({ regiones: ['Región Metropolitana'], incluirNacional: false });
const nRMEstricto = filtrar(ITEMS, rmEstricto).length;
ok('RM sin cobertura nacional es más restrictivo', nRMEstricto < nRM, `${nRMEstricto} vs ${nRM}`);
ok(
  'estricto solo regiones declaradas',
  filtrar(ITEMS, rmEstricto).every((i) => i.regiones.includes('Región Metropolitana')),
);
const barnechea = createState({ comunas: ['Lo Barnechea'], incluirNacional: false });
ok('comuna Lo Barnechea', filtrar(ITEMS, barnechea).length > 0, `${filtrar(ITEMS, barnechea).length}`);
ok('todas las tarjetas declaran la comuna', filtrar(ITEMS, barnechea).every((i) => i.comunas.includes('Lo Barnechea')));

const comunasRM = comunasDisponibles(ITEMS, rm, datos.facetas.comunas);
ok('comunas acotadas por región', comunasRM.length > 0 && comunasRM.length < datos.facetas.comunas.length, `${comunasRM.length} de ${datos.facetas.comunas.length}`);
ok('comuna de otra región no aparece', !comunasRM.some((c) => c.key === 'Pucón'));

console.log('\nOtros filtros');
ok('categoría', filtrar(ITEMS, createState({ categorias: ['Restaurantes'] })).length === 87);
ok('tipo Cashback', filtrar(ITEMS, createState({ tipos: ['Cashback'] })).length === 3, '3 MULTIPLICADOR');
ok('modalidad online', filtrar(ITEMS, createState({ modalidades: ['ONLINE'] })).every((i) => i.online));
ok('medio de pago débito', filtrar(ITEMS, createState({ mediosPago: ['DEBITO'] })).every((i) => i.mediosPago === 'AMBOS' || i.mediosPago === 'DEBITO'));
ok('solo premium', filtrar(ITEMS, createState({ tarjeta: 'premium' })).every((i) => i.premiumOnly));
ok('sin premium', filtrar(ITEMS, createState({ tarjeta: 'no-premium' })).every((i) => !i.premiumOnly));
const min40 = filtrar(ITEMS, createState({ descuentoMin: 40 }));
ok('descuento mínimo 40%', min40.length > 0 && min40.every((i) => i.moneda === 'PORCENTAJE' && i.valor >= 40), `${min40.length}`);
ok('con tope', filtrar(ITEMS, createState({ tope: 'con' })).every((i) => i.tope !== null));
ok('sin tope', filtrar(ITEMS, createState({ tope: 'sin' })).every((i) => i.tope === null));

console.log('\nCombinaciones y bordes');
const combo = createState({ dias: ['viernes'], categorias: ['Restaurantes'], regiones: ['Valparaíso'], incluirNacional: false, tipos: ['Descuento'] });
const resCombo = filtrar(ITEMS, combo);
ok('combinación AND entre grupos', resCombo.every((i) => i.categoria === 'Restaurantes' && i.dias.includes('viernes') && i.regiones.includes('Valparaíso')), `${resCombo.length}`);
const imposible = createState({ regiones: ['Magallanes'], comunas: ['Arica'], incluirNacional: false });
ok('combinación imposible da 0', filtrar(ITEMS, imposible).length === 0);
const starbucks = filtrar(ITEMS, createState({ q: 'starbucks' }));
ok('búsqueda por comercio', starbucks.length >= 1 && starbucks.every((i) => /starbucks/i.test(i.comercio)), `${starbucks.length} coincidencias`);
ok('búsqueda insensible a tildes', filtrar(ITEMS, createState({ q: 'vina del mar' })).length > 0);
ok('búsqueda multi-token', filtrar(ITEMS, createState({ q: 'sushi burger' })).length > 0);

console.log('\nFacets');
ok('conteo de categoría coincide', contarCon(ITEMS, base, { categorias: ['Viajes'] }) === filtrar(ITEMS, createState({ categorias: ['Viajes'] })).length);
const conDia = createState({ dias: ['lunes'] });
ok('facet respeta otros filtros', contarCon(ITEMS, conDia, { categorias: ['Restaurantes'] }) <= contarCon(ITEMS, base, { categorias: ['Restaurantes'] }));

console.log('\nOrdenamientos');
const porDesc = ordenar(filtrar(ITEMS, base), createState({ sort: 'descuento' }));
ok('orden descuento descendente', porDesc[0].valor >= porDesc[porDesc.length - 1].valor, `${porDesc[0].valor}% → ${porDesc[porDesc.length - 1].valor}`);
const porAZ = ordenar(filtrar(ITEMS, base), createState({ sort: 'az' }));
ok('orden A-Z', porAZ[0].comercio.localeCompare(porAZ[1].comercio, 'es') <= 0, `${porAZ[0].comercio}`);
const porTope = ordenar(filtrar(ITEMS, base), createState({ sort: 'tope' }));
ok('orden por tope', (porTope[0].tope ?? -1) >= (porTope[1].tope ?? -1));
const porHoy = ordenar(filtrar(ITEMS, base), createState({ sort: 'hoy' }));
ok(`orden "hoy primero" (${hoy})`, porHoy[0].dias.includes(hoy));

console.log('\nChips y limpieza');
const conFiltros = createState({ q: 'cafe', dias: ['lunes', 'martes'], regiones: ['Maule'], comunas: ['Talca'], tipos: ['Descuento'], descuentoMin: 20, tarjeta: 'no-premium' });
const chips = filtrosActivos(conFiltros);
ok('chips describen cada filtro', chips.length === 7, `${chips.length}: ${chips.map((c) => c.label).join(', ')}`);
const sinDia = quitarFiltro(conFiltros, chips.find((c) => c.group === 'dias'));
ok('quitar chip de días', sinDia.dias.length === 0 && sinDia.regiones.length === 1 && sinDia.comunas.length === 1);
const sinDescuento = quitarFiltro(conFiltros, chips.find((c) => c.group === 'descuentoMin'));
ok('quitar chip de descuento', sinDescuento.descuentoMin === 0);

console.log(`\n${pruebas - fallos}/${pruebas} pruebas OK${fallos ? ` — ${fallos} FALLOS` : ''}\n`);
process.exit(fallos ? 1 : 0);
