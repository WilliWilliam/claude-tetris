# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Hold (reservar pieza)**: guarda la pieza actual con `C` o `Shift` y recupérala más tarde; solo se puede usar una vez por pieza (el slot se atenúa mientras está bloqueado).
- **Combos**: limpiar líneas en colocaciones consecutivas multiplica la puntuación (x2, x3, x4…).
- **T-spin**, **Back-to-Back** (Tetris o T-spin seguidos, ×1.5) y **Perfect Clear** (dejar el tablero vacío) con bonus.
- **Efectos**: textos flotantes sobre el tablero, destello en Perfect Clear y **sonido sintetizado** (Web Audio) con botón para silenciarlo.
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.
- **Modo claro / oscuro**: botón para alternar el tema visual, con el modo oscuro como valor por defecto y la preferencia guardada entre sesiones.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `C` / `Shift` | Reservar pieza (hold)         |
| `P`       | Pausar / reanudar                 |

---

## Cómo funciona

El juego se compone de varios archivos que cooperan. Los scripts son clásicos (sin módulos ES) y se cargan en este orden, compartiendo el ámbito global: `pieces.js` → `audio.js` → `scoring.js` → `game.js`.

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel izquierdo con el slot `HOLD` y un panel derecho con `SCORE`, `LINES`, `LEVEL`, `COMBO`, vista de la siguiente pieza y la lista de controles.
- Un overlay para los estados **PAUSA** y **GAME OVER**.

### 2. `style.css`

Aporta el aspecto visual con estética _retro arcade_: tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays. Los colores se definen como variables CSS (`--bg`, `--board-bg`, `--grid-color`, etc.) con dos paletas —`[data-theme="dark"]` (por defecto) y `[data-theme="light"]`— que se alternan con el botón de tema.

### 3. `pieces.js`, `audio.js` y `scoring.js`

- **`pieces.js`**: constantes del tablero (`COLS`, `ROWS`, `BLOCK`), `COLORS`, `PIECES`, `createPiece(type)` y `randomPiece()`.
- **`audio.js`**: efectos de sonido sintetizados con la Web Audio API (sin archivos de audio). El `AudioContext` se crea con la primera tecla o clic; el silencio se guarda en `localStorage`.
- **`scoring.js`**: función pura `evaluateClear()` que calcula puntos, combo, B2B y las etiquetas a mostrar:
  - Líneas: `[0, 100, 300, 500, 800]`; T-spin: `[400, 800, 1200, 1600]` (0–3 líneas).
  - B2B: Tetris o T-spin con líneas tras otro igual → ×1.5.
  - Combo: multiplicador igual al número de colocaciones seguidas que limpian líneas.
  - Perfect Clear: bonus `[0, 800, 1200, 1800, 2000]`.
  - Todo se multiplica por el nivel que había antes de la limpieza.

### 4. `game.js`

Contiene el estado, el bucle, la entrada y el dibujado. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–7) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.
- **Hold** (`holdPiece`): guarda la pieza actual o la intercambia con la reservada (que reaparece en su posición inicial); se desbloquea al fijar la pieza.
- **T-spin** (`isTSpin`): regla de las 3 esquinas; la T debe fijarse justo después de una rotación (mover o bajar anula el giro).

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / hold / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y tres elementos `<canvas>` (tablero, hold y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.
- **Web Audio API** — para los efectos de sonido generados por código.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── pieces.js       # Tablero, piezas y colores
├── audio.js        # Efectos de sonido (Web Audio)
├── scoring.js      # Puntuación: combos, T-spin, B2B, Perfect Clear
├── game.js         # Estado, bucle, entrada y dibujado
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `pieces.js`, `scoring.js` y `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 7 colores             |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
