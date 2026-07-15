/** @module Shell */

/*	Bootstrap for the String Manipulator tool. Sets up shared utilities (App.utils,
	App.dom, App.showAlert, App.refreshStats, App.commitSnapshot, App.panel2,
	App.panel3), the alerts/stats/history systems, panel button handlers, the
	case-toggle buttons, ops tabs scoped per region, the library selector, and
	finally calls init on every library registered to App.libraries. */

window.App = window.App || {};

const Shell = (function () {

	/** Maximum number of input snapshots kept in history. @type {100} */
	const __HISTORY_MAX__ = 100;

	/** Largest file accepted by the file-import inputs, in bytes. @type {number} */
	const __FILE_SIZE_LIMIT__ = 20 * 1024 * 1024;

	/** Milliseconds the alert toast stays visible. @type {2200} */
	const __ALERT_DURATION_MS__ = 2200;

	/** HTML escape table. @type {object} */
	const __ESCAPE_HTML_MAP__ = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;",
	};

	/** Label shown on a panel toggle button when the textarea is currently visible (clicking will show HTML). @type {string} */
	const __STRING_SHOW_HTML__ = "HTML";

	/** Label shown on a panel toggle button when the custom HTML is currently visible (clicking will show text). @type {string} */
	const __STRING_SHOW_TEXT__ = "TXT";

	/** Panel 1 textarea (Input / Input 1). @type {HTMLTextAreaElement} */
	let panel1 = undefined;

	/** Panel 2 element bundle (textarea, custom-html div, toggle button, stats span). @type {object} */
	let panel2Els = undefined;

	/** Panel 3 element bundle (wrapper, textarea, custom-html div, toggle button, stats span). @type {object} */
	let panel3Els = undefined;

	/** Alert container, populated on DOMContentLoaded. @type {HTMLElement} */
	let alertEl = undefined;

	/** Pending alert hide timer. @type {*} */
	let alertTimer = undefined;

	/** Fixed-position "Scroll down for utils" hint shown when the utils panel is below the viewport. @type {HTMLElement} */
	let utilsScrollHint = undefined;

	/** Input history snapshots, oldest first, capped at __HISTORY_MAX__. @type {string[]} */
	const history = [];

	/** Position in history: -1 means viewing the live editable input, otherwise an index into history. @type {number} */
	let cursor = -1;

	/** Working copy of the live input tracked separately from history. @type {string} */
	let liveValue = "";

	/** 1 when the live input has unsaved divergence from history, 0 otherwise. @type {1|0} */
	let dirty = 0;

	// ===========================================================================
	// Helpers
	// ===========================================================================

	/**
	 * Shortcut for document.getElementById.
	 * @param {string} id Element id.
	 * @return {HTMLElement} Element or null.
	 * @memberOf module:Shell
	 */
	function $ (id) {

		return document.getElementById (id);
	};

	/**
	 * Escape the five HTML-significant characters so a string can be safely interpolated into innerHTML.
	 * @param {string} s String to escape.
	 * @return {string} Escaped string.
	 * @memberOf module:Shell
	 */
	function escapeHtml (s) {

		return s.replace (/[&<>"']/g, lookupEscape);
	};

	function lookupEscape (ch) {

		return __ESCAPE_HTML_MAP__[ch];
	};

	/**
	 * Escape a string for literal use inside a regex pattern.
	 * @param {string} s String to escape.
	 * @return {string} Escaped string.
	 * @memberOf module:Shell
	 */
	function escapeRegex (s) {

		return s.replace (/[.*+?^${}()|[\]\\]/g, "\\$&");
	};

	// ===========================================================================
	// Alerts
	// ===========================================================================

	/**
	 * Show a transient toast for __ALERT_DURATION_MS__ ms.
	 * @param {string} msg Message to display.
	 * @param {string} [kind] One of "success", "warn", "error"; defaults to "success".
	 * @memberOf module:Shell
	 */
	function showAlert (msg, kind) {

		if (kind === undefined)
			kind = "success";
		alertEl.textContent = msg;
		alertEl.className = "alert show " + kind;
		clearTimeout (alertTimer);
		alertTimer = setTimeout (hideAlert, __ALERT_DURATION_MS__);
	};

	function hideAlert () {

		alertEl.classList.remove ("show");
	};

	// ===========================================================================
	// Stats
	// ===========================================================================

	/**
	 * Update a stats span based on a textarea or text-bearing element. textContent is used when the element exposes no .value.
	 * @param {HTMLElement} el Element to measure.
	 * @param {HTMLElement} statEl Span to write into.
	 * @memberOf module:Shell
	 */
	function updateStats (el, statEl) {

		const v = (el.value !== undefined) ? el.value : el.textContent;
		const lines = (v.length === 0) ? 0 : v.split ("\n").length;
		statEl.textContent = v.length + " chars - " + lines + " lines";
	};

	/**
	 * Refresh stats for all three panels; panel 2 and 3 read either their textarea (text mode) or custom div (HTML mode).
	 * @memberOf module:Shell
	 */
	function refreshStats () {

		updateStats (panel1, $ ("panel1Stats"));
		updateStats (panelVisibleSurface (panel2Els), panel2Els.stats);
		if (panel3Els.stats !== undefined)
			updateStats (panelVisibleSurface (panel3Els), panel3Els.stats);
	};

	// ===========================================================================
	// History
	// ===========================================================================

	/**
	 * Push the current liveValue onto history if it differs from the latest entry; oldest dropped past __HISTORY_MAX__.
	 * @memberOf module:Shell
	 */
	function pushLiveIntoHistory () {

		if (liveValue === "")
			return;
		if (history.length > 0 && history[history.length - 1] === liveValue)
			return;
		history.push (liveValue);
		if (history.length > __HISTORY_MAX__)
			history.shift ();
	};

	/**
	 * Mark history as dirty after a user edit; resets cursor to live.
	 * @memberOf module:Shell
	 */
	function markHistoryDirty () {

		cursor = -1;
		liveValue = panel1.value;
		dirty = 1;
		updateHistoryInfo ();
	};

	/**
	 * Commit the current panel1 value into history.
	 * 1. If viewing a past entry, push that pending live value back onto history first.
	 * 2. If panel1 is empty, just reset state.
	 * 3. Otherwise push the value if it differs from the latest history entry.
	 *
	 * @memberOf module:Shell
	 */
	function commitSnapshot () {

		if (cursor !== -1) {
			pushLiveIntoHistory ();
			cursor = -1;
			liveValue = panel1.value;
			dirty = 0;
			updateHistoryInfo ();
			return;
		}
		const v = panel1.value;
		if (v === "") {
			liveValue = "";
			dirty = 0;
			updateHistoryInfo ();
			return;
		}
		if (history.length === 0 || history[history.length - 1] !== v) {
			history.push (v);
			if (history.length > __HISTORY_MAX__)
				history.shift ();
		}
		liveValue = v;
		dirty = 0;
		updateHistoryInfo ();
	};

	/**
	 * Refresh the "history: N/M" label and enable/disable the Prev/Next buttons.
	 * @memberOf module:Shell
	 */
	function updateHistoryInfo () {

		const liveDistinct = (cursor === -1 && dirty === 1 &&
			(history.length === 0 || history[history.length - 1] !== liveValue)) ? 1 : 0;
		const total = history.length + liveDistinct;
		const pos = (total === 0) ? 0 : ((cursor === -1) ? total : cursor + 1);
		$ ("historyInfo").textContent = "history: " + pos + "/" + total;
		$ ("historyPrev").disabled = (history.length === 0 ||
			cursor === 0 ||
			(cursor === -1 && history.length === 1 && history[0] === liveValue));
		$ ("historyNext").disabled = (cursor === -1 ||
			(cursor === history.length - 1 && history[cursor] === liveValue));
	};

	// ===========================================================================
	// Panel 1 and 2 specific handlers
	// ===========================================================================

	function onPanel1Input () {

		updateStats (panel1, $ ("panel1Stats"));
		markHistoryDirty ();
	};

	function onPanel2Input () {

		updateStats (panelVisibleSurface (panel2Els), panel2Els.stats);
	};

	/**
	 * Step back one entry in history; surfaces a warning when already at the oldest.
	 * @memberOf module:Shell
	 */
	function onHistoryPrev () {

		if (history.length === 0) {
			showAlert ("No history yet", "warn");
			return;
		}
		if (cursor === -1) {
			liveValue = panel1.value;
			cursor = history.length - 1;
			if (history[cursor] === liveValue && cursor > 0)
				cursor--;
		} else if (cursor > 0) {
			cursor--;
		} else {
			showAlert ("Reached oldest entry", "warn");
			return;
		}
		panel1.value = history[cursor];
		refreshStats ();
		updateHistoryInfo ();
	};

	/**
	 * Step forward one entry in history; returns to the live editable value past the newest entry.
	 * @memberOf module:Shell
	 */
	function onHistoryNext () {

		if (cursor === -1) {
			showAlert ("Already at current input", "warn");
			return;
		}
		if (cursor < history.length - 1) {
			cursor++;
			panel1.value = history[cursor];
		} else {
			cursor = -1;
			panel1.value = liveValue;
		}
		refreshStats ();
		updateHistoryInfo ();
	};

	/**
	 * Clear panel1; snapshots the previous value into history so Prev can recover it.
	 * @memberOf module:Shell
	 */
	function onClearPanel1Click () {

		if (panel1.value === "")
			return;
		commitSnapshot ();
		panel1.value = "";
		refreshStats ();
		markHistoryDirty ();
		showAlert ("Input cleared", "success");
	};

	/**
	 * Move panel2's plaintext into panel1 (the "Use as input" button between the two panels).
	 * @memberOf module:Shell
	 */
	function onUseAsInputClick () {

		const text = panelText (panel2Els);
		if (text === "") {
			showAlert ("Output is empty", "warn");
			return;
		}
		panel1.value = text;
		liveValue = text;
		cursor = -1;
		dirty = 1;
		refreshStats ();
		updateHistoryInfo ();
		showAlert ("Output moved to input", "success");
	};

	// ===========================================================================
	// Generic panel button handlers
	// ===========================================================================

	/**
	 * Toggle the target textarea between all-uppercase and lowercase.
	 * - If currently all-uppercase, lowercase it; otherwise uppercase
	 * - Panel1 toggles snapshot history before and after so Prev recovers the original casing
	 *
	 * @param {Event} event Click event.
	 * @memberOf module:Shell
	 */
	function onCaseToggleClick (event) {

		const btn = event.currentTarget;
		const target = $ (btn.dataset.target);
		if (target === null || target.value === undefined || target.value === "") {
			showAlert ("Nothing to change", "warn");
			return;
		}
		const next = (target.value === target.value.toUpperCase ()) ?
			target.value.toLowerCase () :
			target.value.toUpperCase ();
		if (target === panel1) {
			commitSnapshot ();
			target.value = next;
			refreshStats ();
			commitSnapshot ();
		} else {
			target.value = next;
			refreshStats ();
		}
	};

	async function onCopyPanelClick (targetPanel) {

		await runCopyToClipboard (panelText (targetPanel));
	};

	function onDownloadPanelClick (targetPanel) {

		const text = panelText (targetPanel);
		if (text === "") {
			showAlert ("Nothing to download", "warn");
			return;
		}
		downloadText (text, "result-" + Date.now () + ".txt");
	};

	function onClearPanelClick (targetPanel) {

		clearPanel (targetPanel);
		refreshStats ();
	};

	// ===========================================================================
	// Generic panel helpers
	// ===========================================================================

	/**
	 * Bundle the DOM elements that make up a managed panel into a single object the helpers below operate on.
	 * @param {HTMLElement|undefined} wrapper Panel wrapper element (undefined when the panel is always-visible).
	 * @param {HTMLTextAreaElement} textarea The textarea half of the panel content.
	 * @param {HTMLElement} custom The custom-HTML half of the panel content.
	 * @param {HTMLButtonElement} toggle Toggle button that swaps modes when both variants are present.
	 * @param {HTMLElement} use Use as input button.
	 * @param {HTMLElement} stats Stats span for char/line counts.
	 * @return {{wrapper:*, textarea:HTMLTextAreaElement, custom:HTMLElement, toggle:HTMLButtonElement, use:HTMLElement, stats:HTMLElement}}
	 * @memberOf module:Shell
	 */
	function makePanelEls (wrapper, textarea, custom, toggle, use, stats) {

		return {
			wrapper: wrapper,
			textarea: textarea,
			custom: custom,
			toggle: toggle,
			use: use,
			stats: stats,
		};
	};

	/**
	 * Return the currently visible content surface for stat counting.
	 * @param {object} els Panel element bundle.
	 * @return {HTMLElement}
	 * @memberOf module:Shell
	 */
	function panelVisibleSurface (els) {

		return (els.custom.hidden === false) ? els.custom : els.textarea;
	};

	/**
	 * Plaintext variant of a panel's content; falls back to the custom div's textContent when no plaintext was set.
	 * @param {object} els Panel element bundle.
	 * @return {string}
	 * @memberOf module:Shell
	 */
	function panelText (els) {

		if (els.textarea.value !== "")
			return els.textarea.value;
		return els.custom.textContent;
	};

	function showPanelTextMode (els) {

		els.textarea.hidden = false;
		els.custom.hidden = true;
		els.toggle.textContent = __STRING_SHOW_HTML__;
	};

	function showPanelHtmlMode (els) {

		els.textarea.hidden = true;
		els.custom.hidden = false;
		els.toggle.textContent = __STRING_SHOW_TEXT__;
	};

	/**
	 * Populate a panel with text and/or HTML variants.
	 * 1. Both variants present: toggle becomes visible, panel starts in HTML mode.
	 * 2. Only HTML present: HTML mode, toggle hidden.
	 * 3. Only text present (the default): text mode, toggle hidden.
	 *
	 * @param {object} els Panel element bundle.
	 * @param {{text:string?, html:string?}} opts Variants. At least one must be present.
	 * @memberOf module:Shell
	 */
	function setPanel (els, opts) {

		const hasText = (opts !== undefined && opts.text !== undefined) ? 1 : 0;
		const hasHtml = (opts !== undefined && opts.html !== undefined) ? 1 : 0;
		if (hasText === 0 && hasHtml === 0) {
			showAlert ("No content provided for panel", "error");
			return;
		}

		els.textarea.value = (hasText === 1) ? opts.text : "";
		els.custom.innerHTML = (hasHtml === 1) ? opts.html : "";
		els.toggle.hidden = (hasText === 1 && hasHtml === 1) ? false : true;

		if (hasHtml === 1)
			showPanelHtmlMode (els);
		else
			showPanelTextMode (els);

		if (els.wrapper !== undefined)
			els.wrapper.hidden = false;

		refreshStats ();
	};

	/**
	 * Swap a panel between text and HTML modes. Only meaningful when both variants are set.
	 * @param {object} els Panel element bundle.
	 * @memberOf module:Shell
	 */
	function togglePanelView (els) {

		if (els.custom.hidden === false)
			showPanelTextMode (els);
		else
			showPanelHtmlMode (els);
		refreshStats ();
	};

	/**
	 * Empty both variants of a panel, reset it to text mode, hide the toggle, and hide the wrapper when present.
	 * @param {object} els Panel element bundle.
	 * @memberOf module:Shell
	 */
	function clearPanel (els) {

		els.textarea.value = "";
		els.custom.innerHTML = "";
		els.toggle.hidden = true;
		showPanelTextMode (els);
		if (els.wrapper !== undefined)
			els.wrapper.hidden = true;
	};

	/**
	 * Hide a panel's wrapper without altering its content. No-op for always-visible panels (panel 2).
	 * @param {object} els Panel element bundle.
	 * @memberOf module:Shell
	 */
	function hidePanel (els) {

		if (els.wrapper !== undefined)
			els.wrapper.hidden = true;
	};

		/**
	 * File-import handler that loads the selected file into the given textarea.
	 * - Refuses files over __FILE_SIZE_LIMIT__
	 * - When target is panel1, snapshots history before and after
	 *
	 * @param {Event} event Input change event.
	 * @param {HTMLTextAreaElement} target Destination textarea.
	 * @memberOf module:Shell
	 */
	function importIntoTarget (event, target) {

		const f = event.target.files[0];
		if (f === undefined)
			return;
		if (f.size > __FILE_SIZE_LIMIT__) {
			showAlert ("File over 20 MB; refusing to load", "error");
			event.target.value = "";
			return;
		}
		const reader = new FileReader ();
		reader.onload = function () {

			if (target === panel1) {
				commitSnapshot ();
				target.value = reader.result;
				refreshStats ();
				commitSnapshot ();
			} else {
				target.value = reader.result;
				refreshStats ();
			}
			showAlert ("Imported " + f.name + " (" + f.size + " bytes)", "success");
		};
		reader.onerror = function () {

			showAlert ("Failed to read file", "error");
		};
		reader.readAsText (f);
		event.target.value = "";
	};

	/**
	 * Trigger a browser download of plain text content.
	 * @param {string} text Content.
	 * @param {string} filename Filename to suggest.
	 * @memberOf module:Shell
	 */
	function downloadText (text, filename) {

		const blob = new Blob ([text], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL (blob);
		const a = document.createElement ("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild (a);
		a.click ();
		document.body.removeChild (a);
		URL.revokeObjectURL (url);
	};

	/**
	 * Copy arbitrary text to the clipboard with execCommand fallback for file://; surfaces an alert.
	 * @param {string} text Text to copy.
	 * @memberOf module:Shell
	 */
	async function runCopyToClipboard (text) {

		if (text === "") {
			showAlert ("Nothing to copy", "warn");
			return;
		}
		try {
			await navigator.clipboard.writeText (text);
			showAlert ("Copied to clipboard", "success");
		} catch (_e) {
			const ta = document.createElement ("textarea");
			ta.value = text;
			ta.style.position = "fixed";
			ta.style.opacity = "0";
			document.body.appendChild (ta);
			ta.select ();
			try {
				document.execCommand ("copy");
				showAlert ("Copied (fallback)", "success");
			} catch (_e2) {
				showAlert ("Copy failed", "error");
			}
			document.body.removeChild (ta);
		}
	};

	// ===========================================================================
	// Ops tabs and dual mode
	// ===========================================================================

	/**
	 * Update the dual-input mode body class, panel2 read-only state, and data-label-* / data-placeholder-* swaps based on whether tabBtn carries data-mode="dual".
	 * @param {HTMLElement} tabBtn Active tab element, or null.
	 * @memberOf module:Shell
	 */
	function refreshDualMode (tabBtn) {

		const isDual = (tabBtn !== null && tabBtn !== undefined && tabBtn.dataset.mode === "dual") ? 1 : 0;
		document.body.classList.toggle ("mode-dual", isDual === 1);
		panel2Els.textarea.readOnly = (isDual !== 1);
		const labels = document.querySelectorAll ("[data-label-default]");
		for (let i = 0 ; i < labels.length ; i++) {
			const el = labels[i];
			el.textContent = (isDual === 1 && el.dataset.labelDual !== undefined) ?
				el.dataset.labelDual : el.dataset.labelDefault;
		}
		const placeholders = document.querySelectorAll ("[data-placeholder-default]");
		for (let i = 0 ; i < placeholders.length ; i++) {
			const el = placeholders[i];
			el.placeholder = (isDual === 1 && el.dataset.placeholderDual !== undefined) ?
				el.dataset.placeholderDual : el.dataset.placeholderDefault;
		}
	};

	/**
	 * Activate the named tab inside the given .ops region; only library-region tabs drive dual mode. Both result panels are cleared on every switch so the previous module's output doesn't bleed across.
	 * @param {HTMLElement} opsRegion The .ops container.
	 * @param {string} tabName Tab name to activate.
	 * @memberOf module:Shell
	 */
	function setActiveTab (opsRegion, tabName) {

		const tabs = opsRegion.querySelectorAll (".tab");
		for (let i = 0 ; i < tabs.length ; i++)
			tabs[i].classList.remove ("active");
		const panels = opsRegion.querySelectorAll (".tab-panel");
		for (let i = 0 ; i < panels.length ; i++)
			panels[i].classList.remove ("active");
		const tabBtn = opsRegion.querySelector (".tab[data-tab=\"" + tabName + "\"]");
		const panel = opsRegion.querySelector ("#tab-" + tabName);
		if (tabBtn !== null)
			tabBtn.classList.add ("active");
		if (panel !== null)
			panel.classList.add ("active");
		if (opsRegion.dataset.region === "library")
			refreshDualMode (tabBtn);
		clearPanel (panel2Els);
		clearPanel (panel3Els);
		refreshStats ();
	};

	function onTabClick (event) {

		const tab = event.currentTarget;
		setActiveTab (tab.closest (".ops"), tab.dataset.tab);
	};

	// ===========================================================================
	// Library selector
	// ===========================================================================

	/**
	 * Activate the library with the given name; CSS hides any .library-ops not matching. Clears both result panels so a previous library's output doesn't carry over.
	 * @param {string} name Library name.
	 * @memberOf module:Shell
	 */
	function setActiveLibrary (name) {

		const tabs = document.querySelectorAll (".library-tab");
		for (let i = 0 ; i < tabs.length ; i++)
			tabs[i].classList.toggle ("active", tabs[i].dataset.library === name);
		const ops = document.querySelectorAll (".library-ops");
		for (let i = 0 ; i < ops.length ; i++)
			ops[i].classList.toggle ("active", ops[i].dataset.library === name);
		const activeLibOps = document.querySelector (".library-ops.active");
		const activeTab = (activeLibOps !== null) ? activeLibOps.querySelector (".tab.active") : undefined;
		refreshDualMode (activeTab);
		clearPanel (panel2Els);
		clearPanel (panel3Els);
		refreshStats ();
	};

	function onLibraryTabClick (event) {

		setActiveLibrary (event.currentTarget.dataset.library);
	};

	// ===========================================================================
	// Utils scroll hint
	// ===========================================================================

	/**
	 * IntersectionObserver callback that toggles the "Scroll down for utils" hint.
	 * - Show the hint when the utils panel is entirely below the viewport
	 * - Hide it once any pixel is visible or after the user has scrolled past
	 *
	 * @param {IntersectionObserverEntry[]} entries
	 * @memberOf module:Shell
	 */
	function onUtilsIntersect (entries) {

		for (let i = 0 ; i < entries.length ; i++) {
			const entry = entries[i];
			const isBelow = (entry.isIntersecting === false && entry.boundingClientRect.top > 0) ? 1 : 0;
			utilsScrollHint.classList.toggle ("show", isBelow === 1);
		}
	};

	// ===========================================================================
	// Bootstrap
	// ===========================================================================

	/**
	 * DOMContentLoaded handler.
	 * 1. Cache DOM references and publish App.dom + App.panel2 + App.panel3.
	 * 2. Wire every event handler (panels, history, file imports, case-toggle, panel3 buttons, ops tabs, library tabs).
	 * 3. Call init on every library registered to App.libraries.
	 * 4. Refresh stats and the history label to reflect initial state.
	 *
	 * @memberOf module:Shell
	 */
	function init () {

		panel1 = $ ("panel1");
		panel2Els = makePanelEls (undefined, $ ("panel2"), $ ("panel2Custom"), $ ("togglePanel2"), $ ("usePanel2"), $ ("panel2Stats"));
		panel3Els = makePanelEls ($ ("panel3Wrapper"), $ ("panel3"), $ ("panel3Custom"), $ ("togglePanel3"), $ ("panel3Stats"));
		alertEl = $ ("alert");
		App.dom = { panel1: panel1, panel2: panel2Els.textarea, panel3: panel3Els.textarea };

		panel1.addEventListener ("input", onPanel1Input);
		panel2Els.textarea.addEventListener ("input", onPanel2Input);
		panel1.addEventListener ("blur", commitSnapshot);

		const caseToggles = document.querySelectorAll (".case-toggle");
		for (let i = 0 ; i < caseToggles.length ; i++)
			caseToggles[i].addEventListener ("click", onCaseToggleClick);

		$ ("clearPanel1").addEventListener ("click", onClearPanel1Click);
		$ ("fileImportPanel1").addEventListener ("change", () => importIntoTarget (event, panel1));
		$ ("historyPrev").addEventListener ("click", onHistoryPrev);
		$ ("historyNext").addEventListener ("click", onHistoryNext);

		$ ("clearPanel2").addEventListener ("click", () => onClearPanelClick(panel2Els));
		$ ("copyPanel2").addEventListener ("click", () => onCopyPanelClick(panel2Els));
		$ ("downloadPanel2").addEventListener ("click", () => onDownloadPanelClick(panel2Els));
		$ ("usePanel2").addEventListener ("click", onUseAsInputClick);
		$ ("togglePanel2").addEventListener ("click",  () => togglePanelView(panel2Els));
		const fileImportPanel2 = $ ("fileImportPanel2");
		if (fileImportPanel2 !== null)
			fileImportPanel2.addEventListener ("change", () => importIntoTarget (event, panel2Els.textarea));

		$ ("copyPanel3").addEventListener ("click", () => onCopyPanelClick(panel3Els));
		$ ("downloadPanel3").addEventListener ("click", () => onDownloadPanelClick(panel3Els));
		$ ("clearPanel3").addEventListener ("click", () => onClearPanelClick(panel3Els));
		$ ("togglePanel3").addEventListener ("click", () => togglePanelView(panel3Els));

		const allTabs = document.querySelectorAll (".ops .tab");
		for (let i = 0 ; i < allTabs.length ; i++)
			allTabs[i].addEventListener ("click", onTabClick);

		const libraryTabs = document.querySelectorAll (".library-tab");
		for (let i = 0 ; i < libraryTabs.length ; i++)
			libraryTabs[i].addEventListener ("click", onLibraryTabClick);

		utilsScrollHint = $ ("utilsScrollHint");
		const utilsPanel = document.querySelector (".utils-ops");
		if (utilsScrollHint !== null && utilsPanel !== null)
			new IntersectionObserver (onUtilsIntersect, { threshold: 0 }).observe (utilsPanel);

		const libs = (App.libraries !== undefined) ? App.libraries : [];
		for (let i = 0 ; i < libs.length ; i++)
			libs[i].init ();

		refreshStats ();
		updateHistoryInfo ();
	};

	// publish shared helpers as soon as the IIFE runs so module scripts see them
	App.utils = { $: $, escapeHtml: escapeHtml, escapeRegex: escapeRegex };
	App.showAlert = showAlert;
	App.refreshStats = refreshStats;
	App.commitSnapshot = commitSnapshot;
	App.panel2 = {
		set: function (opts) { setPanel (panel2Els, opts); },
		clear: function () { clearPanel (panel2Els); refreshStats (); },
		text: function () { return panelText (panel2Els); },
	};
	App.panel3 = {
		set: function (opts) { setPanel (panel3Els, opts); },
		clear: function () { clearPanel (panel3Els); refreshStats (); },
		hide: function () { hidePanel (panel3Els); },
		text: function () { return panelText (panel3Els); },
	};

	document.addEventListener ("DOMContentLoaded", init);

	return {};
}) ();
