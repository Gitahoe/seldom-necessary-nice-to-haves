/** @module Replace */

window.App = window.App || {};

const Replace = (function () {

	/** Width budget used to clamp the options popover within the viewport. @type {200} */
	const __POPOVER_WIDTH__ = 200;

	/** Pairs container element (#replacePairs); populated on init. @type {HTMLElement} */
	let pairsContainer = undefined;

	/** Shared options popover element (#optionsPopover); populated on init. @type {HTMLElement} */
	let popover = undefined;

	/** The .pair element that owns the currently-open popover, or undefined. @type {HTMLElement} */
	let popoverPair = undefined;

	/**
	 * Read the three boolean options off a .pair element's dataset.
	 * @param {HTMLElement} pair The .pair element.
	 * @return {{ci:1|0, regex:1|0, ww:1|0}} Options.
	 * @memberOf module:Replace
	 */
	function getPairOpts (pair) {

		return {
			ci: (pair.dataset.ci === "1") ? 1 : 0,
			regex: (pair.dataset.regex === "1") ? 1 : 0,
			ww: (pair.dataset.ww === "1") ? 1 : 0,
		};
	};

	/**
	 * Build the regex pattern body and flags for a pair; reports any RegExp construction error in the returned object.
	 * @param {string} findValue Raw find value.
	 * @param {{ci:1|0, regex:1|0, ww:1|0}} opts Pair options.
	 * @return {{source:string, flags:string, error:string}} Built pattern info; error is "" on success.
	 * @memberOf module:Replace
	 */
	function buildPattern (findValue, opts) {

		let body = (opts.regex === 1) ? findValue : App.utils.escapeRegex (findValue);
		if (opts.ww === 1)
			body = "\\b(?:" + body + ")\\b";
		const flags = "g" + ((opts.ci === 1) ? "i" : "");
		try {
			new RegExp (body, flags);
			return { source: body, flags: flags, error: "" };
		} catch (err) {
			return { source: body, flags: flags, error: err.message };
		}
	};

	/**
	 * Refresh the small regex preview shown under a pair with empty/ok/error styling.
	 * @param {HTMLElement} pair The .pair element.
	 * @memberOf module:Replace
	 */
	function updatePreview (pair) {

		const escapeHtml = App.utils.escapeHtml;
		const findEl = pair.querySelector (".find");
		const previewEl = pair.querySelector (".regex-preview");
		if (previewEl === null)
			return;

		const v = findEl.value;
		if (v === "") {
			previewEl.className = "regex-preview empty";
			previewEl.textContent = "empty - row will be skipped";
			previewEl.removeAttribute ("title");
			return;
		}

		const built = buildPattern (v, getPairOpts (pair));
		const rendered = "/" + built.source + "/" + built.flags;
		if (built.error !== "") {
			previewEl.className = "regex-preview error";
			previewEl.innerHTML = "<span class=\"label\">regex</span>" +
				escapeHtml (rendered) + " - " + escapeHtml (built.error);
			previewEl.title = "Invalid regex: " + built.error + "\nPattern: " + rendered;
		} else {
			previewEl.className = "regex-preview ok";
			previewEl.innerHTML = "<span class=\"label\">regex</span>" + escapeHtml (rendered);
			previewEl.title = rendered;
		}
	};

	/**
	 * Highlight the replace input as "needs attention" when find is non-empty but replace is empty.
	 * @param {HTMLElement} pair The .pair element.
	 * @memberOf module:Replace
	 */
	function updateNeedsAttention (pair) {

		const findEl = pair.querySelector (".find");
		const replEl = pair.querySelector (".repl");
		if (findEl === null || replEl === null)
			return;
		if (findEl.value !== "" && replEl.value === "")
			replEl.classList.add ("needs-attention");
		else
			replEl.classList.remove ("needs-attention");
	};

	/**
	 * Refresh the gear button's visual indicator and tooltip based on which options are set.
	 * @param {HTMLElement} pair The .pair element.
	 * @memberOf module:Replace
	 */
	function updateOptsButton (pair) {

		const btn = pair.querySelector (".pairOptions");
		if (btn === null)
			return;

		const opts = getPairOpts (pair);
		const any = (opts.ci === 1 || opts.regex === 1 || opts.ww === 1) ? 1 : 0;
		btn.classList.toggle ("has-opts", any === 1);

		const labels = [];
		if (opts.ci === 1)
			labels.push ("case-insensitive");
		if (opts.regex === 1)
			labels.push ("regex");
		if (opts.ww === 1)
			labels.push ("whole word");
		btn.title = (labels.length > 0) ? "Options: " + labels.join (", ") : "Options (none set)";
	};

	/**
	 * Open the shared options popover next to a pair's gear button; clamps to the viewport.
	 * @param {HTMLElement} pair The .pair element.
	 * @param {HTMLElement} btn The clicked .pairOptions button.
	 * @memberOf module:Replace
	 */
	function openPopover (pair, btn) {

		popoverPair = pair;
		const opts = getPairOpts (pair);
		popover.querySelector ("[data-opt=\"ci\"]").checked = (opts.ci === 1);
		popover.querySelector ("[data-opt=\"regex\"]").checked = (opts.regex === 1);
		popover.querySelector ("[data-opt=\"ww\"]").checked = (opts.ww === 1);
		popover.hidden = false;

		const r = btn.getBoundingClientRect ();
		let left = r.left + window.scrollX;
		if (left + __POPOVER_WIDTH__ > window.scrollX + document.documentElement.clientWidth - 8)
			left = window.scrollX + document.documentElement.clientWidth - __POPOVER_WIDTH__ - 8;
		popover.style.left = left + "px";
		popover.style.top = (r.bottom + window.scrollY + 4) + "px";
	};

	function closePopover () {

		popover.hidden = true;
		popoverPair = undefined;
	};

	function onPairOptionsClick (event) {

		event.stopPropagation ();
		const pair = event.currentTarget.closest (".pair");
		if (popoverPair === pair)
			closePopover ();
		else
			openPopover (pair, event.currentTarget);
	};

	function onRemovePairClick (event) {

		const pair = event.currentTarget.closest (".pair");
		if (popoverPair === pair)
			closePopover ();
		pair.remove ();
		ensureAtLeastOnePair ();
	};

	function onFindInput (event) {

		const pair = event.currentTarget.closest (".pair");
		updatePreview (pair);
		updateNeedsAttention (pair);
	};

	function onReplInput (event) {

		updateNeedsAttention (event.currentTarget.closest (".pair"));
	};

	/**
	 * Create a new find/replace pair and append it (before the rest row when one is present).
	 * @param {string} [find] Initial find value; defaults to "".
	 * @param {string} [repl] Initial replace value; defaults to "".
	 * @memberOf module:Replace
	 */
	function addPair (find, repl) {

		if (find === undefined)
			find = "";
		if (repl === undefined)
			repl = "";

		const pair = document.createElement ("div");
		pair.className = "pair";
		pair.dataset.ci = "0";
		pair.dataset.regex = "0";
		pair.dataset.ww = "0";
		pair.innerHTML =
			"<div class=\"pair-grid\">" +
			"<input type=\"text\" class=\"find\" placeholder=\"find\" />" +
			"<span class=\"arrow\">&rarr;</span>" +
			"<input type=\"text\" class=\"repl\" placeholder=\"replace\" />" +
			"<button class=\"pairOptions\" title=\"Options\">&#9881;</button>" +
			"<button class=\"btn-red removePair\" title=\"Remove\">&times;</button>" +
			"</div>" +
			"<div class=\"regex-preview empty\">empty - row will be skipped</div>";

		const findEl = pair.querySelector (".find");
		const replEl = pair.querySelector (".repl");
		findEl.value = find;
		replEl.value = repl;
		findEl.addEventListener ("input", onFindInput);
		replEl.addEventListener ("input", onReplInput);
		pair.querySelector (".pairOptions").addEventListener ("click", onPairOptionsClick);
		pair.querySelector (".removePair").addEventListener ("click", onRemovePairClick);

		const restRow = pairsContainer.querySelector (".pair.rest");
		if (restRow !== null)
			pairsContainer.insertBefore (pair, restRow);
		else
			pairsContainer.appendChild (pair);

		updatePreview (pair);
		updateNeedsAttention (pair);
		updateOptsButton (pair);
	};

	function ensureAtLeastOnePair () {

		if (pairsContainer.querySelector (".pair:not(.rest)") === null)
			addPair ();
	};

	/**
	 * Add the "rest" row that applies a literal value to anything not matched by other pairs.
	 * @memberOf module:Replace
	 */
	function addRestRow () {

		if (pairsContainer.querySelector (".pair.rest") !== null)
			return;

		const rest = document.createElement ("div");
		rest.className = "pair rest";
		rest.innerHTML =
			"<div class=\"pair-grid\">" +
			"<span class=\"rest-label\">rest &rarr;</span>" +
			"<input type=\"text\" class=\"repl rest-repl\" placeholder=\"value for everything else (literal)\" />" +
			"<button class=\"btn-red removeRest\" title=\"Disable rest\">&times;</button>" +
			"</div>";
		rest.querySelector (".removeRest").addEventListener ("click", removeRestRow);
		pairsContainer.appendChild (rest);

		const toggleBtn = App.utils.$ ("toggleRest");
		toggleBtn.textContent = "- Rest";
		toggleBtn.title = "Disable the rest row";
	};

	/**
	 * Remove the rest row and reset the toggle button label.
	 * @memberOf module:Replace
	 */
	function removeRestRow () {

		const rest = pairsContainer.querySelector (".pair.rest");
		if (rest !== null)
			rest.remove ();
		const toggleBtn = App.utils.$ ("toggleRest");
		toggleBtn.textContent = "+ Rest";
		toggleBtn.title = "Add a rest row that replaces everything not matched by other pairs";
	};

	/**
	 * Compile every active pair (skipping empty find values) into runnable regex specs.
	 * @return {{compiled:object[], errored:1|0}} Compiled list and an error flag.
	 * @memberOf module:Replace
	 */
	function compilePairs () {

		const compiled = [];
		let errored = 0;
		const pairs = pairsContainer.querySelectorAll (".pair:not(.rest)");

		for (let i = 0 ; i < pairs.length ; i++) {
			const pair = pairs[i];
			const find = pair.querySelector (".find").value;
			const repl = pair.querySelector (".repl").value;
			if (find === "")
				continue;
			const built = buildPattern (find, getPairOpts (pair));
			if (built.error !== "") {
				App.showAlert ("Bad regex: " + find, "error");
				errored = 1;
				continue;
			}
			compiled.push ({
				source: built.source,
				flags: built.flags,
				repl: repl,
				regex: new RegExp (built.source, built.flags),
				sticky: new RegExp (built.source, built.flags.replace ("g", "") + "y"),
			});
		}
		return { compiled: compiled, errored: errored };
	};

	/**
	 * Single-pass replacement with a rest value.
	 * 1. Walk the source position by position.
	 * 2. Try each compiled pair via its sticky regex; first non-empty match wins.
	 * 3. Characters that no pair matches are replaced by the rest value, collapsed into one rest insertion per unmatched run.
	 *
	 * @param {string} src Source text.
	 * @param {object[]} compiled Compiled pair list.
	 * @param {string} restValue Replacement for unmatched characters.
	 * @return {{result:string, replacements:number}} Result text and replacement count.
	 * @memberOf module:Replace
	 */
	function runWithRest (src, compiled, restValue) {

		let pos = 0;
		let result = "";
		let pendingRest = 0;
		let replacements = 0;

		while (pos < src.length) {
			let matched = undefined;
			for (let i = 0 ; i < compiled.length ; i++) {
				const cp = compiled[i];
				cp.sticky.lastIndex = pos;
				const m = cp.sticky.exec (src);
				if (m !== null && m[0].length > 0) {
					matched = { m: m, cp: cp };
					break;
				}
			}
			if (matched !== undefined) {
				if (pendingRest === 1) {
					result += restValue;
					pendingRest = 0;
				}
				result += matched.m[0].replace (matched.cp.regex, matched.cp.repl);
				pos += matched.m[0].length;
				replacements++;
			} else {
				pendingRest = 1;
				pos++;
			}
		}

		if (pendingRest === 1)
			result += restValue;
		return { result: result, replacements: replacements };
	};

	function onPopoverChange (event) {

		if (popoverPair === undefined)
			return;
		const cb = event.currentTarget;
		const key = cb.dataset.opt;
		popoverPair.dataset[key] = (cb.checked === true) ? "1" : "0";
		updatePreview (popoverPair);
		updateOptsButton (popoverPair);
	};

	function onDocumentMousedown (event) {

		if (popover.hidden)
			return;
		if (popover.contains (event.target))
			return;
		if (event.target.closest (".pairOptions") !== null)
			return;
		closePopover ();
	};

	function onDocumentKeydown (event) {

		if (event.key === "Escape" && popover.hidden === false)
			closePopover ();
	};

	function onToggleRestClick () {

		if (pairsContainer.querySelector (".pair.rest") !== null)
			removeRestRow ();
		else
			addRestRow ();
	};

	function onAddPairClick () {

		addPair ();
	};

	function onClearReplacePairsClick () {

		closePopover ();
		pairsContainer.innerHTML = "";
		addPair ();
		App.utils.$ ("toggleRest").textContent = "+ Rest";
	};

	/**
	 * Run all compiled pairs against the input.
	 * - Without a rest row: each pair runs sequentially over the running result
	 * - With a rest row: a single sticky-regex pass; everything unmatched becomes the rest value
	 *
	 * @memberOf module:Replace
	 */
	function onRunReplaceClick () {

		const src = App.dom.panel1.value;
		if (src === "") {
			App.showAlert ("Input is empty", "warn");
			return;
		}

		const compiledInfo = compilePairs ();
		if (compiledInfo.errored === 1)
			return;

		const compiled = compiledInfo.compiled;
		const restRow = pairsContainer.querySelector (".pair.rest");
		const appliedPairs = compiled.length;
		let result;
		let totalReplacements;

		if (restRow !== null) {
			const restValue = restRow.querySelector (".rest-repl").value;
			if (compiled.length === 0) {
				App.showAlert ("No active pairs - rest would replace everything", "warn");
				return;
			}
			const r = runWithRest (src, compiled, restValue);
			result = r.result;
			totalReplacements = r.replacements;
		} else {
			result = src;
			totalReplacements = 0;
			for (let i = 0 ; i < compiled.length ; i++) {
				const cp = compiled[i];
				const before = result;
				const matches = before.match (cp.regex);
				result = before.replace (cp.regex, cp.repl);
				if (matches !== null)
					totalReplacements += matches.length;
			}
		}

		App.panel2.set ({ text: result });
		App.commitSnapshot ();

		if (totalReplacements === 0)
			App.showAlert ("Ran " + appliedPairs + " pair(s); no matches found", "warn");
		else
			App.showAlert (totalReplacements + " replacement(s) across " + appliedPairs + " pair(s)", "success");
	};

	/**
	 * Wire popover handlers and the rest-toggle/add/clear/run buttons; create the initial empty pair.
	 * @memberOf module:Replace
	 */
	function init () {

		const $ = App.utils.$;
		pairsContainer = $ ("replacePairs");
		popover = $ ("optionsPopover");

		const popoverCheckboxes = popover.querySelectorAll ("input[type=\"checkbox\"]");
		for (let i = 0 ; i < popoverCheckboxes.length ; i++)
			popoverCheckboxes[i].addEventListener ("change", onPopoverChange);

		document.addEventListener ("mousedown", onDocumentMousedown);
		document.addEventListener ("keydown", onDocumentKeydown);

		$ ("toggleRest").addEventListener ("click", onToggleRestClick);
		$ ("addReplacePair").addEventListener ("click", onAddPairClick);
		$ ("clearReplacePairs").addEventListener ("click", onClearReplacePairsClick);
		$ ("runReplace").addEventListener ("click", onRunReplaceClick);

		addPair ();
	};

	return {
		init: init,
	};
}) ();
App.replace = Replace;
