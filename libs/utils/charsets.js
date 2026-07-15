/** @module Charsets */

window.App = window.App || {};

const Charsets = (function () {

	/**
	 * Hand-curated families of regex character classes. Each family has a name and a list of sets; each set has a name, a regex string (literal pastable text), and an optional description.
	 * @type {object[]}
	 * @memberOf module:Charsets
	 */
	const __CHARSET_LIST__ = [
		{
			family: "Letters (Latin)",
			sets: [
				{ name: "Lowercase",  regex: "[a-z]", desc: "a-z" },
				{ name: "Uppercase",  regex: "[A-Z]", desc: "A-Z" },
				{ name: "Any case",   regex: "[a-zA-Z]" },
				{ name: "Vowels",     regex: "[aeiouyAEIOUY]" },
				{ name: "Consonants", regex: "[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]" },
			],
		},
		{
			family: "French",
			sets: [
				{ name: "Accents (lowercase)",     regex: "[àâäéèêëîïôöùûüÿæœç]" },
				{ name: "Accents (uppercase)",     regex: "[ÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÆŒÇ]" },
				{ name: "Accents (any case)",      regex: "[àâäéèêëîïôöùûüÿæœçÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÆŒÇ]" },
				{ name: "Vowels with accents",     regex: "[aeiouyàâäéèêëîïôöùûüÿAEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜŸ]" },
				{ name: "Consonants + cedilla",    regex: "[bcdfghjklmnpqrstvwxzçBCDFGHJKLMNPQRSTVWXZÇ]" },
				{ name: "Full French alphabet",    regex: "[a-zA-ZàâäéèêëîïôöùûüÿæœçÀÂÄÉÈÊËÎÏÔÖÙÛÜŸÆŒÇ]" },
			],
		},
		{
			family: "Numbers",
			sets: [
				{ name: "Binary",                  regex: "[01]",         desc: "Base 2" },
				{ name: "Octal",                   regex: "[0-7]",        desc: "Base 8" },
				{ name: "Decimal",                 regex: "[0-9]",        desc: "Base 10 - equivalent to \\d" },
				{ name: "Hexadecimal (lowercase)", regex: "[0-9a-f]",     desc: "Base 16" },
				{ name: "Hexadecimal (uppercase)", regex: "[0-9A-F]" },
				{ name: "Hexadecimal (any case)",  regex: "[0-9a-fA-F]" },
				{ name: "Base 36 (any case)",      regex: "[0-9a-zA-Z]" },
			],
		},
		{
			family: "Alphanumeric",
			sets: [
				{ name: "ASCII alphanumeric",      regex: "[a-zA-Z0-9]" },
				{ name: "Word characters",         regex: "\\w", desc: "a-z, A-Z, 0-9, underscore" },
				{ name: "Word + French accents",   regex: "[\\w\\u00C0-\\u017F]" },
				{ name: "Non-word",                regex: "\\W" },
			],
		},
		{
			family: "Punctuation",
			sets: [
				{ name: "ASCII punctuation",       regex: "[!\"#$%&'()*+,./:;<=>?@\\[\\\\\\]^_`{|}~-]" },
				{ name: "Sentence punctuation",    regex: "[.,!?;:]" },
				{ name: "Straight quotes",         regex: "[\"']" },
				{ name: "Curly quotes",            regex: "[‘’“”]", desc: "U+2018, U+2019, U+201C, U+201D" },
				{ name: "French guillemets",       regex: "[«»]", desc: "U+00AB, U+00BB" },
				{ name: "Brackets / parens",       regex: "[\\[\\](){}<>]" },
				{ name: "Math operators",          regex: "[+\\-*/=<>%]" },
			],
		},
		{
			family: "Whitespace & control",
			sets: [
				{ name: "Any whitespace",          regex: "\\s", desc: "Space, tab, newline, etc." },
				{ name: "Non-whitespace",          regex: "\\S" },
				{ name: "Space + tab",             regex: "[ \\t]" },
				{ name: "Line breaks",             regex: "[\\r\\n]" },
				{ name: "ASCII control characters", regex: "[\\x00-\\x1F\\x7F]" },
			],
		},
		{
			family: "Other scripts & ranges",
			sets: [
				{ name: "Latin extended (diacritics)", regex: "[\\u00C0-\\u024F]" },
				{ name: "Greek",                       regex: "[\\u0370-\\u03FF]" },
				{ name: "Cyrillic",                    regex: "[\\u0400-\\u04FF]" },
				{ name: "CJK ideographs (common)",     regex: "[\\u4E00-\\u9FFF]" },
				{ name: "Emoji (BMP basic range)",     regex: "[\\u2600-\\u27BF]" },
				{ name: "Any ASCII char",              regex: "[\\x00-\\x7F]" },
				{ name: "Non-ASCII char",              regex: "[^\\x00-\\x7F]" },
			],
		},
	];

	/**
	 * Copy a regex string to the clipboard, falling back to execCommand on file:// in older browsers.
	 * @param {string} regex Regex source to copy.
	 * @param {string} name Charset name shown in the alert.
	 * @memberOf module:Charsets
	 */
	async function copy (regex, name) {

		try {
			await navigator.clipboard.writeText (regex);
			App.showAlert ("Copied " + name, "success");
		} catch (_e1) {
			const ta = document.createElement ("textarea");
			ta.value = regex;
			ta.style.position = "fixed";
			ta.style.opacity = "0";
			document.body.appendChild (ta);
			ta.select ();
			try {
				document.execCommand ("copy");
				App.showAlert ("Copied " + name, "success");
			} catch (_e2) {
				App.showAlert ("Copy failed", "error");
			}
			document.body.removeChild (ta);
		}
	};

	/**
	 * Row click handler; copies the row's regex unless the user clicked the regex code element itself (which lets them select fragments manually).
	 * @param {Event} event Click event.
	 * @memberOf module:Charsets
	 */
	function onRowClick (event) {

		if (event.target.closest (".charset-regex") !== null)
			return;
		const row = event.currentTarget;
		copy (row.dataset.regex, row.dataset.name);
	};

	/**
	 * Render the charset families as collapsible details groups.
	 * @param {HTMLElement} container The #charsetList element.
	 * @memberOf module:Charsets
	 */
	function render (container) {

		const escapeHtml = App.utils.escapeHtml;
		container.innerHTML = "";
		for (let i = 0 ; i < __CHARSET_LIST__.length ; i++) {
			const family = __CHARSET_LIST__[i];
			const familyEl = document.createElement ("details");
			familyEl.className = "charset-family";
			const summary = document.createElement ("summary");
			summary.className = "charset-family-title";
			summary.innerHTML = "<span class=\"charset-family-name\">" + escapeHtml (family.family) +
				"</span><span class=\"charset-family-count\">" + family.sets.length + "</span>";
			familyEl.appendChild (summary);
			const rowsWrap = document.createElement ("div");
			rowsWrap.className = "charset-rows";
			for (let j = 0 ; j < family.sets.length ; j++) {
				const set = family.sets[j];
				const row = document.createElement ("div");
				row.className = "charset-row";
				row.title = "Click to copy: " + set.regex;
				row.dataset.regex = set.regex;
				row.dataset.name = set.name;
				const descHtml = (set.desc !== undefined) ?
					"<span class=\"charset-desc\">" + escapeHtml (set.desc) + "</span>" :
					"";
				row.innerHTML = "<div class=\"charset-info\"><span class=\"charset-name\">" +
					escapeHtml (set.name) + "</span>" + descHtml + "</div>" +
					"<code class=\"charset-regex\" title=\"Select part of this manually to copy a fragment\">" +
					escapeHtml (set.regex) + "</code>";
				row.addEventListener ("click", onRowClick);
				rowsWrap.appendChild (row);
			}
			familyEl.appendChild (rowsWrap);
			container.appendChild (familyEl);
		}
	};

	/**
	 * Filter input handler; hides rows whose name/desc/regex don't match the query and auto-expands families with matches while filtering.
	 * @param {Event} event Input event.
	 * @memberOf module:Charsets
	 */
	function onFilterInput (event) {

		const filter = event.currentTarget;
		const q = filter.value.trim ().toLowerCase ();
		const container = App.utils.$ ("charsetList");
		const rows = container.querySelectorAll (".charset-row");
		for (let i = 0 ; i < rows.length ; i++) {
			const row = rows[i];
			const nameEl = row.querySelector (".charset-name");
			const descEl = row.querySelector (".charset-desc");
			const regexEl = row.querySelector (".charset-regex");
			const name = (nameEl !== null) ? nameEl.textContent.toLowerCase () : "";
			const desc = (descEl !== null) ? descEl.textContent.toLowerCase () : "";
			const regex = (regexEl !== null) ? regexEl.textContent.toLowerCase () : "";
			const match = (q === "" || name.indexOf (q) !== -1 ||
				desc.indexOf (q) !== -1 || regex.indexOf (q) !== -1) ? 1 : 0;
			row.style.display = (match === 1) ? "" : "none";
		}

		const families = container.querySelectorAll (".charset-family");
		for (let i = 0 ; i < families.length ; i++) {
			const fam = families[i];
			const famRows = fam.querySelectorAll (".charset-row");
			let anyVisible = 0;
			for (let j = 0 ; j < famRows.length ; j++) {
				if (famRows[j].style.display !== "none") {
					anyVisible = 1;
					break;
				}
			}
			fam.style.display = (anyVisible === 1) ? "" : "none";
			if (q !== "" && anyVisible === 1)
				fam.open = true;
		}
	};

	/**
	 * Render the list and wire the filter input. Invoked by the utils library bootstrap at DOMContentLoaded.
	 * @memberOf module:Charsets
	 */
	function init () {

		const container = App.utils.$ ("charsetList");
		if (container === null)
			return;
		render (container);
		const filter = App.utils.$ ("charsetFilter");
		if (filter !== null)
			filter.addEventListener ("input", onFilterInput);
	};

	return {
		init: init,
	};
}) ();
App.charsets = Charsets;
