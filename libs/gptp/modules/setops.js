/** @module Setops */

window.App = window.App || {};

const Setops = (function () {

	/** Label per op key shown in the success alert. @type {object} */
	const __LABELS__ = {
		intersect: "A ∩ B",
		union:     "A ∪ B",
		"diff-ab": "A − B",
		"diff-ba": "B − A",
		symdiff:   "A △ B",
	};

	/**
	 * Read the four checkboxes into a normalized options object.
	 * @return {{ci:1|0, trim:1|0, ignoreEmpty:1|0, sort:1|0}} Options.
	 * @memberOf module:Setops
	 */
	function getOpts () {

		const $ = App.utils.$;
		return {
			ci: ($ ("setopsCI").checked === true) ? 1 : 0,
			trim: ($ ("setopsTrim").checked === true) ? 1 : 0,
			ignoreEmpty: ($ ("setopsIgnoreEmpty").checked === true) ? 1 : 0,
			sort: ($ ("setopsSort").checked === true) ? 1 : 0,
		};
	};

	/**
	 * Compute the comparison key for a line after applying trim/case-insensitive options.
	 * @param {string} line Source line.
	 * @param {object} opts Options.
	 * @return {string} Comparison key.
	 * @memberOf module:Setops
	 */
	function keyOf (line, opts) {

		let k = line;
		if (opts.trim === 1)
			k = k.trim ();
		if (opts.ci === 1)
			k = k.toLowerCase ();
		return k;
	};

	/**
	 * Build a Map of comparison key to original line; first occurrence wins so users see their source form.
	 * @param {string[]} lines Lines to bag.
	 * @param {object} opts Options.
	 * @return {Map} Map of key to original line.
	 * @memberOf module:Setops
	 */
	function bagOf (lines, opts) {

		const map = new Map ();
		for (let i = 0 ; i < lines.length ; i++) {
			const k = keyOf (lines[i], opts);
			if (opts.ignoreEmpty === 1 && k === "")
				continue;
			if (map.has (k) === false)
				map.set (k, lines[i]);
		}
		return map;
	};

	/**
	 * Run the named line-set operation against two bags; optionally sort the result.
	 * @param {string} op One of "intersect", "union", "diff-ab", "diff-ba", "symdiff".
	 * @param {string[]} aLines Lines from Input 1.
	 * @param {string[]} bLines Lines from Input 2.
	 * @param {object} opts Options.
	 * @return {string[]} Result lines.
	 * @memberOf module:Setops
	 */
	function operate (op, aLines, bLines, opts) {

		const A = bagOf (aLines, opts);
		const B = bagOf (bLines, opts);
		const out = [];

		if (op === "intersect") {
			const entries = Array.from (A.entries ());
			for (let i = 0 ; i < entries.length ; i++) {
				if (B.has (entries[i][0]))
					out.push (entries[i][1]);
			}
		} else if (op === "union") {
			const aValues = Array.from (A.values ());
			for (let i = 0 ; i < aValues.length ; i++)
				out.push (aValues[i]);
			const bEntries = Array.from (B.entries ());
			for (let i = 0 ; i < bEntries.length ; i++) {
				if (A.has (bEntries[i][0]) === false)
					out.push (bEntries[i][1]);
			}
		} else if (op === "diff-ab") {
			const entries = Array.from (A.entries ());
			for (let i = 0 ; i < entries.length ; i++) {
				if (B.has (entries[i][0]) === false)
					out.push (entries[i][1]);
			}
		} else if (op === "diff-ba") {
			const entries = Array.from (B.entries ());
			for (let i = 0 ; i < entries.length ; i++) {
				if (A.has (entries[i][0]) === false)
					out.push (entries[i][1]);
			}
		} else if (op === "symdiff") {
			const aEntries = Array.from (A.entries ());
			for (let i = 0 ; i < aEntries.length ; i++) {
				if (B.has (aEntries[i][0]) === false)
					out.push (aEntries[i][1]);
			}
			const bEntries = Array.from (B.entries ());
			for (let i = 0 ; i < bEntries.length ; i++) {
				if (A.has (bEntries[i][0]) === false)
					out.push (bEntries[i][1]);
			}
		}

		if (opts.sort === 1)
			out.sort ();
		return out;
	};

	/**
	 * Run the chosen op against panel1 and panel2 and write the joined result lines into panel 3.
	 * @param {string} op Operation key.
	 * @memberOf module:Setops
	 */
	function run (op) {

		const panel1 = App.dom.panel1;
		const panel2 = App.dom.panel2;
		const a = panel1.value;
		const b = panel2.value;

		if (a === "" && b === "") {
			App.showAlert ("Both inputs empty", "warn");
			return;
		}

		const opts = getOpts ();
		const result = operate (op, a.split ("\n"), b.split ("\n"), opts);
		App.panel3.set ({ text: result.join ("\n") });

		const label = (__LABELS__[op] !== undefined) ? __LABELS__[op] : op;
		App.showAlert (label + ": " + result.length + " line(s)", "success");
	};

	function onOpClick (event) {

		run (event.currentTarget.dataset.op);
	};

	/**
	 * Swap panel1 and panel2 contents.
	 * @memberOf module:Setops
	 */
	function onSwitchInputs () {

		const panel1 = App.dom.panel1;
		const panel2 = App.dom.panel2;
		const tmp = panel1.value;
		panel1.value = panel2.value;
		panel2.value = tmp;
		App.refreshStats ();
		App.showAlert ("Texts switched", "success");
	};

	/**
	 * Wire the op buttons and the Switch text button.
	 * @memberOf module:Setops
	 */
	function init () {

		const $ = App.utils.$;
		const wrap = $ ("tab-setops");
		if (wrap === null)
			return;

		const opButtons = wrap.querySelectorAll ("[data-op]");
		for (let i = 0 ; i < opButtons.length ; i++)
			opButtons[i].addEventListener ("click", onOpClick);

		$ ("switchInputsSetops").addEventListener ("click", onSwitchInputs);
	};

	return {
		init: init,
	};
}) ();
App.setops = Setops;
