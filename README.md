# Bci Descuentos — Buscador y filtros de beneficios

Rediseño del bloque **filtros + resultados** de beneficios Bci. Reemplaza la
grilla plana actual (que solo permitía filtrar por tipo/modalidad/pago) por un
buscador facetado donde se puede filtrar **por día de la semana, región, comuna,
categoría, modalidad, medio de pago, segmento de tarjeta, descuento mínimo, tope
y cobertura geográfica**, con contadores en vivo y estado compartible por URL.

Sin header ni footer del sitio: solo el bloque embebible.

## Stack

- **Vite 5** (`pnpm dev`, `pnpm build`)
- HTML + CSS + JS vanilla, sin framework ni dependencias de runtime
- El código es *bundler-agnóstico*: el CSS se carga con `<link>` y el dataset por
  `fetch`, así que también funciona servido como ESM plano (`pnpm serve`).

## Cómo correr

```bash
pnpm install          # instala vite
pnpm dev              # http://localhost:5273
```

Alternativas:

```bash
pnpm prepare-data     # regenera el dataset + placeholders desde data/source-beneficios.json
pnpm check            # 42 pruebas del motor de filtrado (sin navegador)
pnpm build            # build de producción en dist/
pnpm serve            # servidor estático sin dependencias (para previsualizar dist/ o src/)
```

## Estructura

```
index.html                      # solo el contenedor #app
data/source-beneficios.json     # dataset original (intacto)
scripts/prepare-data.mjs        # normaliza + enriquece + genera placeholders SVG
scripts/check.mjs               # pruebas del motor de filtrado
scripts/serve.mjs               # servidor estático cero-dependencias
public/data/beneficios.json     # dataset que consume la UI (generado)
public/img/comercios/*.svg      # imágenes placeholder (generadas, locales)
src/main.js                     # bootstrap, render y estado
src/lib/filtering.js            # motor: match, facets, orden, chips
src/lib/format.js               # etiquetas, CLP, día actual en Chile
src/lib/url.js                  # sincronización del estado con la URL
src/lib/dom.js                  # helper h() + iconos inline
src/components/FilterPanel.js   # columna de filtros (acordeón, contadores)
src/components/Toolbar.js       # contador, orden, vista, chips, estado vacío
src/components/ResultCard.js    # tarjeta (grid y lista)
src/styles/main.css             # design system y componentes
```

## Qué se puede filtrar

| Grupo | Comportamiento |
| --- | --- |
| **Día de la semana** | Botones L-M-M-J-V-S-D con conteo. Presets: *Hoy*, *Fin de semana*, *Lun a vie*, *Todos los días*. Varios días = OR. |
| **Región** | 16 regiones con conteo. Interruptor **"Incluir beneficios de todo Chile"** (por defecto activo). |
| **Comuna / ciudad** | Se **acota a las regiones seleccionadas** y se ordena por seleccionadas → más resultados. Buscador propio. |
| **Categoría** | Restaurantes, Comercios, Viajes, Panoramas, CyberClicks, Destacados. |
| **Tipo de beneficio** | Descuento vs Cashback/puntos. |
| **Modalidad** | Presencial, Online, App, WhatsApp. |
| **Pago y tarjeta** | Crédito/débito + segmento (cualquiera / sin Premium / solo Premium). |
| **Descuento mínimo** | Slider 0–50 %. |
| **Tope** | Todos / con tope / sin tope. |
| **Cobertura** | Todo Chile / por región / internacional. |
| **Búsqueda** | Texto libre sobre comercio, categoría, descripción, comuna y región (sin tildes, multi-palabra). |

Detalles de UX incluidos:

- **Contadores facetados**: cada opción muestra cuántos resultados daría, y las
  opciones sin resultados quedan deshabilitadas.
- **Chips de filtros activos** con borrado individual + "Limpiar todo".
- **Estado en la URL**: cualquier combinación de filtros es un enlace compartible
  (`?dias=jueves&regiones=Valpara%C3%ADso&nacional=0`).
- **Orden**: relevancia, mayor descuento, disponibles hoy primero, mayor tope, A-Z.
- **Vista** cuadrícula o lista.
- **Día actual en zona `America/Santiago`**, con `Hoy · <día>` como atajo.
- **Favoritos** en `localStorage` y copiado del detalle al portapapeles.
- **Estado vacío** con salidas concretas (quitar día, quitar región, incluir
  cobertura nacional, bajar el mínimo) y accesos directos por categoría.
- **Accesibilidad**: `aria-pressed`, `aria-expanded`, `aria-live` en el contador,
  foco visible, atajo `/` para el buscador, `Esc` cierra el panel móvil.
- **Responsive**: sobre 1080 px la columna de filtros es fija; bajo eso se
  convierte en panel deslizante con overlay y botón "Filtros (n)".

## Sobre los datos (importante)

`data/source-beneficios.json` es el archivo original: 165 beneficios, 11 campos.
`scripts/prepare-data.mjs` lo normaliza (corrige mojibake tipo `RegiÃ³n`,
descompone `"Viña del Mar, Reñaca"` en comunas, `"AMBOS"` en canales) y deriva
campos que el origen **no trae**:

| Campo | Origen |
| --- | --- |
| `tipo` (Descuento/Cashback) | Derivado de `moneda_beneficio`: `MULTIPLICADOR` → Cashback. |
| `dias` | **Derivado**: el origen no tiene programación semanal. Hash estable por comercio para que el filtro por día sea demostrable. |
| `descripcion`, `valorTexto`, `ubicacion` | Texto generado a partir de los campos existentes. |
| `alcance` | `TODOS_LAS_REGIONES` → nacional, `INTERNACIONAL` → internacional, resto regional. |
| `imagen` | Placeholder SVG generado localmente (sin requests externos). |

Si el origen incorpora la columna real `dias`, el script **la respeta** y no la
sobreescribe: basta con agregarla al JSON y volver a correr `pnpm prepare-data`.
Lo mismo para reemplazar los placeholders por imágenes reales (`imagen` en el
JSON generado o los archivos de `public/img/comercios/`).

## Notas de entorno (Windows)

En este entorno pnpm corre en modo `hoisted` (`pnpm-workspace.yaml`) porque Node
no resuelve las *junctions* del layout aislado. Además, los sandboxes que
bloquean *named pipes* impiden que esbuild levante su servicio, por lo que
`vite build` / `vite dev` requieren permisos ampliados; para previsualizar sin
esbuild está `pnpm serve`, que usa el mismo código.
