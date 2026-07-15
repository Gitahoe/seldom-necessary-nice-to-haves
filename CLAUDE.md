# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GPTP (General-Purpose Text Parser) is a local, dependency-free, browser-based text manipulation tool. Pure HTML/CSS/vanilla JS, no build step, no package manager, no tests. Runs by opening `index.html` directly (works over `file://`).

Ignore `./_dev/`, it is an archive folder.

## Code style

All JavaScript in this repo follows `./.claude/rules/personal-js-style.md`. Highlights worth remembering when editing or adding files:

- **Module pattern**: every JS file starts with `/** @module Name */` and wraps everything in `const Name = (function () { ... }) ();`. For files that need to register on the App namespace (which is everything here), bridge at the bottom with `App.<key> = Name;` or push onto a collection (e.g. `App.encoders.list.push (Name);`, `App.libraries.push (Name);`).
- **Naming**: PascalCase for the module/class const, `__SCREAMING_SNAKE__` for constants (always wrapped in double underscores), camelCase for variables and functions.
- **JSDoc**: every non-trivial function gets a JSDoc block ending in `@memberOf module:Name`. Single-line descriptions sit directly above the `@param` tags with no blank line between them; descriptions that include bullet (`-`) or numbered (`1.`) lists get a blank line before the tags.
- **Loops**: traditional `for (let i = 0 ; i < n ; i++)` (with spaces around the semicolons). No `forEach`, no `.map`/`.filter` with callbacks, no anonymous functions inside event listeners. Promote callbacks to named functions and bind via `addEventListener ("event", named)`.
- **Booleans**: prefer `1`/`0` and `=== 1` in your own logic; only let `true`/`false` leak across DOM-API boundaries (`el.disabled`, `classList.toggle (cls, bool)`).
- **`undefined` not `null`**, `===` not `==`, no default values in signatures (test `=== undefined` inside the body).
- **Formatting**: tabs, space before every `(`, semicolons after the closing `}` of function and class definitions, empty line after each function's opening `{`.
- **No Unicode typography**: no em-dash, en-dash, smart quotes, or ellipsis. Use `-`, `'`, `"`, `...`. Mathematical/functional Unicode (arrows, set operators, French accents in regex data) is fine because it isn't typography.

## Running

Open `index.html` in any modern browser. There is no dev server, no `npm install`, no build. Changes to source files take effect on reload.

Clipboard fallback: some browsers restrict the async Clipboard API on `file://`, so `App.charsets` (the Charsets UI) and the `#copyOutput` button both fall back to `document.execCommand ("copy")`.

## Architecture

Single-page app organized around a global `window.App` namespace. Scripts are loaded in a specific order by `index.html` (no module system); each script attaches one slice of state/behavior to `App` and waits for `App.utils` / `App.dom` to exist before doing anything.

### Boot sequence (`libs/index.js`)

The shell module is `const Shell = (function () { ... }) ()` in `libs/index.js`. On parse it publishes `App.utils`, `App.showAlert`, `App.refreshStats`, `App.commitSnapshot` (function references; their internals are safe to call only after DOMContentLoaded). The `Shell.init` function is registered as the DOMContentLoaded handler and does:

1. Cache `panel1` plus panel-2 and panel-3 element bundles (each bundles the textarea, the custom-HTML div, the toggle button, and the stats span), then publish `App.dom = { panel1, panel2, panel3 }` pointing at the three textareas. The DOM ids are `#panel1` / `#panel2` / `#panel3` for the textareas; `#panel2Custom` / `#panel3Custom` for the structured-HTML render areas; `#togglePanel2` / `#togglePanel3` for the view-toggle buttons; `#panel3Wrapper` for panel 3's hideable wrapper (panel 2 is always visible).
2. Wire every event handler (history Prev/Next, file imports, case-toggle, clear/copy/download buttons, ops tabs, library tabs).
3. Iterate `App.libraries` in registration order and call each library's `init`.
4. Refresh stats and the history label so the initial UI matches state.

The shell's cross-cutting systems:

- **Alerts**: `App.showAlert (msg, kind)` shows a transient toast via `#alert`. Valid kinds: `"success"`, `"warn"`, `"error"`.
- **Stats**: `App.refreshStats ()` updates char/line counters on all three panels (panel3 only contributes when its wrapper is visible; HTML-mode reads `textContent` of `#panel3Custom`).
- **History**: undo-style snapshot stack of the `panel1` textarea (max 100 entries). Coordinated state inside the shell IIFE: `history`, `cursor` (-1 means viewing the live editable value), `liveValue`, `dirty` (1/0). `App.commitSnapshot ()` pushes the current value when it differs from the latest entry. Feature modules call it after producing output so the previous input remains reachable via the Prev button. The diff module deliberately does not touch history.
- **Ops tabs (scoped per region)**: each `.ops` container owns an independent active tab. Clicking a `.tab` swaps only that region's `.tab-panel` **and hides panel 3** so the previous module's result doesn't bleed across modules. The HTML carries `data-region="library"` on per-library ops and `data-region="utils"` on the global utilities ops; only `library` tabs drive dual mode. Tabs marked `data-mode="dual"` (currently `setops` and `diff` inside GPTP) put the app into **dual-input mode**: adds `body.mode-dual`, makes `#panel2` editable so it acts as **Input 2**, and swaps DOM labels/placeholders via `data-label-default` / `data-label-dual` (and `data-placeholder-*`). CSS classes `single-only` and `dual-only` toggle visibility of file-import and clipboard buttons accordingly. The shell's `refreshDualMode (tabBtn)` recomputes mode whenever the active library tab changes (tab click or library switch). To add a dual-input feature, set `data-mode="dual"` on its tab button.
- **Library selector**: a row of `.library-tab` buttons above the library ops. Clicking one toggles `.active` on the matching `.library-ops[data-library=...]` (the others are CSS-hidden), re-runs `refreshDualMode` against the new library's active tab, and hides panel 3.
- **Output panels (panel 2 and panel 3)**: both expose the same symmetric API. Panel 2 is the right-hand output panel and is always visible; panel 3 is a full-width result panel beneath the two top panels (`.panel-result { grid-column: 1 / -1 }`) and is hidden until something is rendered into it.
  - `App.panel2.set ({ text?, html? })` and `App.panel3.set ({ text?, html? })`: render the given variant(s). Both panels accept a plain-text variant (placed in the `<textarea>`), a custom-HTML variant (placed in the sibling `<div>`), or both. When both are present the toggle button (`#togglePanel2` / `#togglePanel3`) becomes visible and the panel starts in HTML mode; otherwise the toggle stays hidden. Modules choose which variant(s) make sense for their result.
  - `App.panel2.clear ()` / `App.panel3.clear ()`: empty both variants, hide the toggle, drop back to text mode. Panel 3 also re-hides its wrapper.
  - `App.panel3.hide ()`: hides the panel-3 wrapper without altering content (panel 2 has no equivalent because it's always visible).
  - `App.panel2.text ()` / `App.panel3.text ()`: return the plaintext variant. If only the HTML variant was set, falls back to the custom div's `.textContent`. Used by the shell's Copy / Download / Use-as-input buttons — those always operate on the plaintext, no matter which view mode is currently showing.
  - Tab and library switches call `clearPanel` on both panel 2 and panel 3 so each module starts with a clean slate.
  - Both panels' button rows include their generic action buttons (Copy / Use as input / Download / Clear), and modules don't need to wire their own; setting via `set` is enough.
  - Panel 3 has its own generic action row: Copy / Download / Use as input (moves the result into panel1 with history snapshots) / Clear. Modules don't need to wire their own.

### File layout

```
libs/
  index.js                shell module (Shell): I/O, history, alerts, tabs, library selector, library init iteration
  gptp/
    index.js              GPTP library bootstrap (Gptp): document.writes its modules, registers App.libraries entry
    modules/
      replace.js  count.js  setops.js  diff.js
  encoders/
    index.js              Encoder library bootstrap (Encoders): picker UI + selection + encode/decode dispatch
    modules/
      base64.js  url.js  hex.js  binary.js  morse.js  caesar.js  keyboard.js     each pushes onto App.encoders.list
  utils/
    index.js              Utils bootstrap (Utils) for the utils ops panel at the bottom of the layout
    charsets.js           charset data (App.charsetList) + UI module (App.charsets) in one file
```

### Library-loader pattern

`index.html` carries exactly one `<script>` tag per library plus the shell. Each library's `index.js` uses `document.write` inside its IIFE to inject `<script>` tags for the files in its own `modules/` directory (executed synchronously during parse), then bridges itself onto `App.libraries`:

```js
/** @module Foo */

window.App = window.App || {};
App.libraries = App.libraries || [];

const Foo = (function () {

    const __MODULES__ = ["a", "b"];
    for (let i = 0 ; i < __MODULES__.length ; i++)
        document.write ("<script src=\"libs/foo/modules/" + __MODULES__[i] + ".js\"></script>");

    /**
     * Call each registered module's init if present.
     * @memberOf module:Foo
     */
    function init () {

        if (App.a !== undefined && App.a.init !== undefined)
            App.a.init ();
        // etc
    };

    return {
        name: "foo",
        init: init,
    };
}) ();
App.libraries.push (Foo);
```

At `DOMContentLoaded` the shell iterates `App.libraries` in registration order and calls each `init`. The shell `<script>` loads **first** in `index.html` so `App.utils`, `App.showAlert`, etc. exist as soon as library module files run; but the shell's `DOMContentLoaded` handler still runs last, after every `document.write`-injected module has finished parsing.

**Why `document.write`**: it is the only mechanism that synchronously injects `<script>` tags into the parser stream from a top-level script, preserving file:// support (no fetch needed) and guaranteeing in-order execution before DOMContentLoaded. Dynamic `appendChild` of script elements would fire async and race the bootstrap.

**Adding a new library**: create `libs/<name>/index.js` matching the pattern, drop modules into `libs/<name>/modules/`, declare its tabs and panels inside a new `<div class="ops library-ops" data-library="<name>" data-region="library">` in `index.html`, add a matching `<button class="library-tab" data-library="<name>">` in `.library-tabs`, and add one `<script src="libs/<name>/index.js">` tag. No shell changes needed - `App.libraries` does the rest.

### GPTP modules (`libs/gptp/modules/`)

Each module is `const Name = (function () { ... }) ()` and bridges to App with `App.<name> = Name;` at the bottom. They all depend on `App.utils`, `App.dom` (which exposes `panel1`, `panel2`, `panel3`), `App.showAlert`, `App.refreshStats`, `App.panel3` (for modules with a custom result display), and (where they mutate panel1) `App.commitSnapshot`.

- **`replace.js` -> `App.replace`**: bulk find/replace with per-pair options (case-insensitive, regex, whole-word) stored on `dataset` attributes of each `.pair` element. A shared `#optionsPopover` is positioned next to whichever pair gear button was clicked (`popoverPair` tracks ownership). Two execution paths:
  - **Without rest row**: each compiled pair runs sequentially via `String.prototype.replace` over the running result, so later pairs see earlier pairs' output.
  - **With rest row** (`runWithRest`): a single left-to-right pass over the **original** input using sticky regexes (`y` flag); any character not matched by any pair is replaced by the rest value. Pairs are tried in DOM order at each position; first match wins.
- **`count.js` -> `App.count`**: one needle per line in `#countNeedles`, counts non-overlapping (or overlapping via a manual `lastIndex` walk) matches. Renders **both** result variants into panel 2 via `App.panel2.set ({ text, html })`: the HTML breakdown (`.count-list` wrapping `.count-row` per needle plus a `.total-row` at the bottom) and a tab-separated text representation (`count\tneedle` per row, then `---`, then `TOTAL\t<sum>`). The toggle button lets the user switch views; Copy / Download always use the text. A broken regex needle yields -1 and renders as `ERR`.
- **`setops.js` -> `App.setops`** *(dual-input)*: treats panel1 and panel2 as line bags and computes intersection, union, A minus B, B minus A, symmetric difference. Set semantics: duplicates within a side fold to one occurrence, identified by an options-aware key (`keyOf` applies `trim` then `toLowerCase` when those options are on); the rendered output is the original (un-normalized) line, first occurrence wins via the `Map`-based `bagOf`. Result is written to panel 3 via `App.panel3.set ({ text })` (text-only — no HTML variant needed for a line list). The setops tab only carries the operation buttons and Switch text; the panel-3 generic buttons handle copy/clear/use-as-input.
- **`diff.js` -> `App.diff`** *(dual-input)*: side-by-side line comparison. In dual mode `#panel2` is **Input 2**, not output. Renders both variants into panel 3 via `App.panel3.set ({ text, html })`: the HTML side-by-side `<table class="text-compare">` for richness, and a unified-diff style text variant (`pushTextRow` prefixes each row with `  ` / `- ` / `+ `; `changed` rows emit both `-` and `+` lines). The algorithm:
  1. `lineOps` runs LCS over the line arrays and emits an `equal` / `add` / `remove` op stream.
  2. `buildRows` walks ops; consecutive remove+add runs are paired into `changed` rows when `similarity (l, r) >= __PAIR_SIMILARITY__` (0.5). Otherwise they become separate `removed` / `added` rows. Tune this knob if pairing feels too aggressive or too sparse.
  3. `charDiff` runs character-level LCS for `changed` rows; `mergeSpans` collapses adjacent same-type chars.
  - **Cost guards**: `charDiff` and `similarity` short-circuit to multiset approximation or no-diff when `m * n > __CHARDIFF_CELL_CAP__` (200_000). `onRunDiff` refuses inputs where `aLines.length * bLines.length > __LINEDIFF_CELL_CAP__` (4_000_000). Touch these limits carefully; they exist to keep the synchronous LCS from freezing the page.

### Encoders library (`libs/encoders/`)

A single-panel library (no internal tabs): one shared list of algorithms, encode/decode buttons at the top, optional parameter inputs above them, a filter, then the list.

- **`index.js`** (`Encoders`): document.writes each algorithm file in `modules/`, publishes shared byte helpers (`App.encoders.BYTE_FORMAT_PARAM`, `App.encoders.toBytes`, `App.encoders.fromBytes`), and pushes `{ name: "encoders", init }` onto `App.libraries`. The init renders `App.encoders.list` into `#encoderList`, manages selection (`.encoder-row.selected`), builds the params control strip in `#encoderParams` from the selected encoder's schema, and dispatches encode/decode against the current selection. Output goes into `panel2` (the output panel in single-input mode); `commitSnapshot ()` runs after so the prior input is reachable via history.
- **Algorithm files (`modules/*.js`)**: each registers itself by pushing onto `App.encoders.list` (the list is initialized defensively at the top of each file with `App.encoders = App.encoders || { list: [] }`, so load order doesn't matter as long as init runs after all algorithms have registered, which DOMContentLoaded guarantees).
- **Registration shape**:
  ```
  { id, name, example, params?, encode?(input, params), decode?(input, params) }
  ```
  - `example` is a one-line preview shown next to the name in the row (e.g. `"hello -> aGVsbG8="`).
  - `params` is optional; an array of `{ key, label, type: "number"|"checkbox"|"text"|"select", default, min?, max?, options?, ui? }`. The picker builds inputs from this schema; values are read off `[data-param]` elements at run time and passed as the second argument to encode/decode. `select` requires an `options: string[]` array. Each param may also carry a `ui (value, container)` callback; when present, the picker appends a `<span class="encoder-param-ui">` next to the input and calls the callback once at render and on every `input` event (Caesar uses this to show `abcdefghijklmnopqrstuvwxyz -> <shifted>`).
  - **Byte-oriented encoders** (base64, hex, binary) spread `App.encoders.BYTE_FORMAT_PARAM` into their `params` and route bytes through `App.encoders.toBytes (input, encoding)` / `App.encoders.fromBytes (bytes, encoding)`. ASCII mode throws on any byte > 0x7F on either side, so users get a clear error instead of corrupted output. Character-oriented encoders (morse, caesar, keyboard) deliberately do not carry this param.
  - Either `encode` or `decode` may be omitted (the missing direction alerts "does not support"). Throwing inside encode/decode is the supported error path; the message is shown via `App.showAlert (..., "error")`.

### Utility modules (`libs/utils/`)

- **`charsets.js`**: both the data and the UI live in this one file. The data is `App.charsetList`, a hand-curated list of `{ family, sets: [{ name, regex, desc? }] }`. The `regex` string is the literal source text the user pastes into a find or count field; escape sequences (`\\w`, `\\s`, `\\x00`) are JS-string-escaped so the user sees `\w` / `\s` / `\x00` after copying. When editing the regex strings, every backslash needs doubling. The UI module is `App.charsets`, which renders the data into collapsible `<details>` groups inside the utils ops panel (`#tab-charsets`). Click a row to copy the regex; clicking the `.charset-regex` `<code>` itself is intentionally a no-op so the user can text-select a fragment. The filter input matches name, description, and regex source; families with no visible rows are hidden, and families with matches auto-expand only while a filter is active (manual open/close state is preserved when the filter is cleared).

### CSS conventions (`style/theme.css`)

All colors are CSS custom properties at `:root` (dark theme only). State-driven visibility uses classes set on `<body>` (e.g. `mode-dual`) combined with `.single-only` / `.dual-only` modifiers on elements. Library visibility is driven by `.library-ops.active` (only the active library's ops panel renders).

## Conventions to preserve

- No build step, no dependencies, no framework. Don't introduce npm, bundlers, or import/export syntax; `index.html` script-tag order plus each library's `document.write` list is the dependency graph.
- Adding a new feature to an existing library: drop a new module file into `libs/<lib>/modules/`, add its filename to that library's `__MODULES__` array in `libs/<lib>/index.js`, and (if the module exposes an `init`) call it from the library's registered `init`. No changes to `index.html` or the shell.
- All text inserted into the DOM must go through `App.utils.escapeHtml`. All user-supplied literal text used to build a `RegExp` must go through `App.utils.escapeRegex` first (unless `regex` mode is on for that input).
- Use `App.showAlert (msg, kind)` for user feedback rather than `alert ()` or `console`. Valid kinds: `"success"`, `"warn"`, `"error"`.
- Call `App.commitSnapshot ()` after any operation that programmatically changes `input.value` and should be recoverable via the history Prev/Next buttons.
