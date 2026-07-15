/** @module Count */

window.App = window.App || {};

const Count = (function () {

	/**
	 * Count non-overlapping (or overlapping when opts.overlapping === 1) matches of needle in haystack; returns -1 on regex error.
	 * @param {string} haystack Text to search.
	 * @param {string} needle Pattern source (literal unless opts.regex === 1).
	 * @param {{caseInsensitive:1|0, regex:1|0, overlapping:1|0}} opts Search options.
	 * @return {number} Match count, or -1 on regex error.
	 * @memberOf module:Count
	 */
	function countOccurrences (haystack, needle, opts) {

		if (needle === "")
			return 0;

		let re;
		try {
			const body = (opts.regex === 1) ? needle : App.utils.escapeRegex (needle);
			const flags = "g" + ((opts.caseInsensitive === 1) ? "i" : "");
			re = new RegExp (body, flags);
		} catch (_e) {
			return -1;
		}

		if (opts.overlapping !== 1) {
			const m = haystack.match (re);
			return (m !== null) ? m.length : 0;
		}

		let count = 0;
		let pos = 0;
		re.lastIndex = 0;
		while (pos <= haystack.length) {
			re.lastIndex = pos;
			const r = re.exec (haystack);
			if (r === null)
				break;
			count++;
			pos = r.index + 1;
		}
		return count;
	};

	/**
	 * Read needles and options, run countOccurrences for each, render both variants (tab-separated text + structured HTML) into panel 2.
	 * @memberOf module:Count
	 */
	function onRunCount () {

		const panel1 = App.dom.panel1;
		const $ = App.utils.$;
		const escapeHtml = App.utils.escapeHtml;

		const src = panel1.value;
		const rawLines = $ ("countNeedles").value.split ("\n");
		const needles = [];
		for (let i = 0 ; i < rawLines.length ; i++) {
			if (rawLines[i].length > 0)
				needles.push (rawLines[i]);
		}

		if (src === "") {
			App.showAlert ("Input is empty", "warn");
			return;
		}
		if (needles.length === 0) {
			App.showAlert ("No needles provided", "warn");
			return;
		}

		const opts = {
			caseInsensitive: ($ ("countCaseInsensitive").checked === true) ? 1 : 0,
			regex: ($ ("countRegex").checked === true) ? 1 : 0,
			overlapping: ($ ("countOverlapping").checked === true) ? 1 : 0,
		};

		let anyError = 0;
		let total = 0;
		const htmlRows = ["<div class=\"count-list\">"];
		const textRows = [];
		for (let i = 0 ; i < needles.length ; i++) {
			const needle = needles[i];
			const c = countOccurrences (src, needle, opts);
			const safe = escapeHtml (needle);
			if (c === -1) {
				anyError = 1;
				htmlRows.push ("<div class=\"count-row\"><span class=\"needle\" title=\"" +
					safe + "\">" + safe + "</span><span class=\"count zero\">ERR</span></div>");
				textRows.push ("ERR\t" + needle);
			} else {
				total += c;
				const zeroClass = (c === 0) ? " zero" : "";
				htmlRows.push ("<div class=\"count-row\"><span class=\"needle\" title=\"" +
					safe + "\">" + safe + "</span><span class=\"count" + zeroClass +
					"\">" + c + "</span></div>");
				textRows.push (c + "\t" + needle);
			}
		}
		htmlRows.push ("<div class=\"total-row\"><span>TOTAL</span><span>" + total + "</span></div>");
		htmlRows.push ("</div>");
		textRows.push ("---");
		textRows.push ("TOTAL\t" + total);

		App.panel2.set ({ text: textRows.join ("\n"), html: htmlRows.join ("") });

		if (anyError === 1)
			App.showAlert ("One or more regex needles failed", "error");
		else
			App.showAlert ("Counted " + needles.length + " needle(s); total " + total, "success");
	};

	function onClearNeedles () {

		App.utils.$ ("countNeedles").value = "";
		App.panel2.clear ();
	};

	/**
	 * Wire the Count and Clear buttons.
	 * @memberOf module:Count
	 */
	function init () {

		const $ = App.utils.$;
		$ ("runCount").addEventListener ("click", onRunCount);
		$ ("clearNeedles").addEventListener ("click", onClearNeedles);
	};

	return {
		init: init,
	};
}) ();
App.count = Count;
