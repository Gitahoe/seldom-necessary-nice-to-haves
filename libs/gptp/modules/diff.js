/** @module Diff */

window.App = window.App || {};

const Diff = (function () {

	/** Similarity threshold for pairing remove+add as a single "changed" row. @type {0.5} */
	const __PAIR_SIMILARITY__ = 0.5;

	/** Skip char-level LCS when m*n exceeds this many cells. @type {number} */
	const __CHARDIFF_CELL_CAP__ = 200000;

	/** Refuse to run line-level diff when aLines.length * bLines.length exceeds this. @type {number} */
	const __LINEDIFF_CELL_CAP__ = 4000000;

	/**
	 * Build the LCS dp table for two sequences (strings or arrays).
	 * @param {string|Array} a First sequence.
	 * @param {string|Array} b Second sequence.
	 * @return {Int32Array[]} 2D table where dp[i][j] is the LCS length of a[..i] and b[..j].
	 * @memberOf module:Diff
	 */
	function lcsTable (a, b) {

		const m = a.length;
		const n = b.length;
		const dp = [];

		for (let i = 0 ; i <= m ; i++)
			dp.push (new Int32Array (n + 1));

		for (let i = 1 ; i <= m ; i++) {
			for (let j = 1 ; j <= n ; j++) {
				if (a[i - 1] === b[j - 1])
					dp[i][j] = dp[i - 1][j - 1] + 1;
				else
					dp[i][j] = Math.max (dp[i - 1][j], dp[i][j - 1]);
			}
		}
		return dp;
	};

	/**
	 * Walk the LCS table to produce a stream of equal/add/remove ops on two line arrays.
	 * @param {string[]} aLines Left lines.
	 * @param {string[]} bLines Right lines.
	 * @return {object[]} Ordered ops with type "equal", "add", or "remove".
	 * @memberOf module:Diff
	 */
	function lineOps (aLines, bLines) {

		const dp = lcsTable (aLines, bLines);
		const ops = [];
		let i = aLines.length;
		let j = bLines.length;

		while (i > 0 || j > 0) {
			if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
				ops.push ({ type: "equal", left: aLines[i - 1], right: bLines[j - 1] });
				i--;
				j--;
			} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
				ops.push ({ type: "add", right: bLines[j - 1] });
				j--;
			} else {
				ops.push ({ type: "remove", left: aLines[i - 1] });
				i--;
			}
		}
		ops.reverse ();
		return ops;
	};

	/**
	 * Character-level diff between two strings; falls back to a single all-diff span when the LCS table would exceed __CHARDIFF_CELL_CAP__ cells.
	 * @param {string} a Left string.
	 * @param {string} b Right string.
	 * @return {{left:object[], right:object[]}} Spans for each side.
	 * @memberOf module:Diff
	 */
	function charDiff (a, b) {

		if (a.length * b.length > __CHARDIFF_CELL_CAP__) {
			return {
				left: [{ type: "diff", text: a }],
				right: [{ type: "diff", text: b }],
			};
		}

		const dp = lcsTable (a, b);
		const leftRev = [];
		const rightRev = [];
		let i = a.length;
		let j = b.length;

		while (i > 0 || j > 0) {
			if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
				leftRev.push ({ type: "equal", ch: a[i - 1] });
				rightRev.push ({ type: "equal", ch: b[j - 1] });
				i--;
				j--;
			} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
				rightRev.push ({ type: "diff", ch: b[j - 1] });
				j--;
			} else {
				leftRev.push ({ type: "diff", ch: a[i - 1] });
				i--;
			}
		}

		leftRev.reverse ();
		rightRev.reverse ();
		return {
			left: mergeSpans (leftRev),
			right: mergeSpans (rightRev),
		};
	};

	/**
	 * Merge adjacent same-type items by concatenating their `ch` into a single `text`.
	 * @param {object[]} items Per-character items from charDiff.
	 * @return {object[]} Merged spans.
	 * @memberOf module:Diff
	 */
	function mergeSpans (items) {

		const out = [];
		for (let i = 0 ; i < items.length ; i++) {
			const it = items[i];
			if (out.length > 0 && out[out.length - 1].type === it.type)
				out[out.length - 1].text += it.ch;
			else
				out.push ({ type: it.type, text: it.ch });
		}
		return out;
	};

	/**
	 * Compute a 0..1 similarity score between two lines (LCS length over max length); uses a multiset approximation for very long lines.
	 * @param {string} a Left line.
	 * @param {string} b Right line.
	 * @return {number} Similarity in [0, 1].
	 * @memberOf module:Diff
	 */
	function similarity (a, b) {

		if (a === b)
			return 1;
		const m = a.length;
		const n = b.length;
		if (m === 0 && n === 0)
			return 1;
		if (m === 0 || n === 0)
			return 0;

		if (m * n > __CHARDIFF_CELL_CAP__) {
			const counts = Object.create (null);
			for (let i = 0 ; i < a.length ; i++) {
				const ch = a[i];
				counts[ch] = (counts[ch] !== undefined ? counts[ch] : 0) + 1;
			}
			let common = 0;
			for (let i = 0 ; i < b.length ; i++) {
				if (counts[b[i]] > 0) {
					common++;
					counts[b[i]]--;
				}
			}
			return common / Math.max (m, n);
		}

		const dp = lcsTable (a, b);
		return dp[m][n] / Math.max (m, n);
	};

	/**
	 * Walk a line-level op stream into renderable rows.
	 * 1. Equal ops become "equal" rows carrying both line numbers.
	 * 2. Consecutive remove+add runs are paired into "changed" rows when similarity >= __PAIR_SIMILARITY__.
	 * 3. Dissimilar or unmatched extras become separate "removed" or "added" rows.
	 *
	 * @param {object[]} ops Line-level op stream from lineOps.
	 * @return {object[]} Renderable rows.
	 * @memberOf module:Diff
	 */
	function buildRows (ops) {

		const rows = [];
		let leftNum = 0;
		let rightNum = 0;
		let i = 0;

		while (i < ops.length) {
			const op = ops[i];
			if (op.type === "equal") {
				leftNum++;
				rightNum++;
				rows.push ({ kind: "equal", left: op.left, right: op.right, ln: leftNum, rn: rightNum });
				i++;
				continue;
			}

			const removes = [];
			const adds = [];
			while (i < ops.length && ops[i].type !== "equal") {
				if (ops[i].type === "remove")
					removes.push (ops[i].left);
				else
					adds.push (ops[i].right);
				i++;
			}

			const max = Math.max (removes.length, adds.length);
			for (let k = 0 ; k < max ; k++) {
				const l = removes[k];
				const r = adds[k];
				if (l !== undefined && r !== undefined && similarity (l, r) >= __PAIR_SIMILARITY__) {
					leftNum++;
					rightNum++;
					rows.push ({ kind: "changed", left: l, right: r, ln: leftNum, rn: rightNum, charSpans: charDiff (l, r) });
				} else {
					if (l !== undefined) {
						leftNum++;
						rows.push ({ kind: "removed", left: l, right: "", ln: leftNum, rn: undefined });
					}
					if (r !== undefined) {
						rightNum++;
						rows.push ({ kind: "added", left: "", right: r, ln: undefined, rn: rightNum });
					}
				}
			}
		}
		return rows;
	};

	/**
	 * Concatenate char-diff spans into escape-safe HTML.
	 * @param {object[]} spans Spans from charDiff.
	 * @return {string} HTML fragment.
	 * @memberOf module:Diff
	 */
	function spansToHtml (spans) {

		const escapeHtml = App.utils.escapeHtml;
		let out = "";
		for (let i = 0 ; i < spans.length ; i++) {
			const s = spans[i];
			if (s.type === "diff")
				out += "<span class=\"diff-char\">" + escapeHtml (s.text) + "</span>";
			else
				out += escapeHtml (s.text);
		}
		return out;
	};

	/**
	 * Render a single diff row as a `<tr>` HTML fragment.
	 * @param {object} row Row from buildRows.
	 * @return {string} HTML fragment.
	 * @memberOf module:Diff
	 */
	function renderRow (row) {

		const escapeHtml = App.utils.escapeHtml;
		let leftHtml;
		let rightHtml;

		if (row.kind === "changed") {
			leftHtml = spansToHtml (row.charSpans.left);
			rightHtml = spansToHtml (row.charSpans.right);
		} else if (row.kind === "removed") {
			leftHtml = (row.left === "") ?
				"<span class=\"diff-empty\">(empty line)</span>" :
				"<span class=\"diff-char\">" + escapeHtml (row.left) + "</span>";
			rightHtml = "";
		} else if (row.kind === "added") {
			leftHtml = "";
			rightHtml = (row.right === "") ?
				"<span class=\"diff-empty\">(empty line)</span>" :
				"<span class=\"diff-char\">" + escapeHtml (row.right) + "</span>";
		} else {
			leftHtml = escapeHtml (row.left);
			rightHtml = escapeHtml (row.right);
		}

		const lnL = (row.ln !== undefined) ? row.ln : "";
		const lnR = (row.rn !== undefined) ? row.rn : "";
		return "<tr class=\"diff-row diff-" + row.kind + "\">" +
			"<td class=\"diff-linenum\">" + lnL + "</td>" +
			"<td class=\"diff-content\"><pre>" + leftHtml + "</pre></td>" +
			"<td class=\"diff-linenum\">" + lnR + "</td>" +
			"<td class=\"diff-content\"><pre>" + rightHtml + "</pre></td>" +
			"</tr>";
	};

	/**
	 * Read both textareas, compute line and char ops, render the result table; refuses inputs over __LINEDIFF_CELL_CAP__.
	 * @memberOf module:Diff
	 */
	function onRunDiff () {

		const panel1 = App.dom.panel1;
		const panel2 = App.dom.panel2;
		const a = panel1.value;
		const b = panel2.value;

		if (a === "" && b === "") {
			App.showAlert ("Both inputs empty", "warn");
			return;
		}

		const aLines = a.split ("\n");
		const bLines = b.split ("\n");
		if (aLines.length * bLines.length > __LINEDIFF_CELL_CAP__) {
			App.showAlert ("Inputs too large to diff (lines x lines > 4M)", "error");
			return;
		}

		const ops = lineOps (aLines, bLines);
		const rows = buildRows (ops);
		const rowHtml = [];
		const textLines = [];
		for (let i = 0 ; i < rows.length ; i++) {
			rowHtml.push (renderRow (rows[i]));
			pushTextRow (rows[i], textLines);
		}
		App.panel3.set ({
			text: textLines.join ("\n"),
			html: "<table class=\"text-compare\"><tbody>" + rowHtml.join ("") + "</tbody></table>",
		});

		let diffCount = 0;
		for (let i = 0 ; i < rows.length ; i++) {
			if (rows[i].kind !== "equal")
				diffCount++;
		}
		if (diffCount === 0)
			App.showAlert ("Texts are identical", "success");
		else
			App.showAlert (diffCount + " differing line(s)", "success");
	};

	/**
	 * Append one row's unified-diff representation to the running text-variant lines.
	 * - "equal" -> "  " + line
	 * - "removed" -> "- " + left
	 * - "added" -> "+ " + right
	 * - "changed" -> "- " + left followed by "+ " + right
	 *
	 * @param {object} row Row from buildRows.
	 * @param {string[]} out Accumulator the line is pushed onto.
	 * @memberOf module:Diff
	 */
	function pushTextRow (row, out) {

		if (row.kind === "equal") {
			out.push ("  " + row.left);
		} else if (row.kind === "removed") {
			out.push ("- " + row.left);
		} else if (row.kind === "added") {
			out.push ("+ " + row.right);
		} else if (row.kind === "changed") {
			out.push ("- " + row.left);
			out.push ("+ " + row.right);
		}
	};

	/**
	 * Swap panel1 and panel2 contents.
	 * @memberOf module:Diff
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
	 * Wire the Compare and Switch buttons if they exist.
	 * @memberOf module:Diff
	 */
	function init () {

		const $ = App.utils.$;
		const runBtn = $ ("runDiff");
		const switchBtn = $ ("switchInputs");
		if (runBtn !== null)
			runBtn.addEventListener ("click", onRunDiff);
		if (switchBtn !== null)
			switchBtn.addEventListener ("click", onSwitchInputs);
	};

	return {
		init: init,
	};
}) ();
App.diff = Diff;
