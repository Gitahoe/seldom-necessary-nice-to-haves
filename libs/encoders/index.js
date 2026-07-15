/** @module Encoders */

/*	Encoder library bootstrap. Renders the encoder picker, manages selection and
	the dynamically-built params section, runs encode/decode against the current
	selection, and publishes shared helpers (App.encoders.BYTE_FORMAT_PARAM,
	App.encoders.toBytes, App.encoders.fromBytes) for the byte-oriented algorithm
	modules to use. Algorithm modules push their spec onto App.encoders.list:
	{ id, name, example, params?, encode?(input, params), decode?(input, params) }.
	If an encoder throws, the error message bubbles up to App.showAlert. */

window.App = window.App || {};
App.encoders = App.encoders || { list : [] };
App.libraries = App.libraries || [];

const Encoders = (function () {

	// ! Make sure to update this if you add/remove modules!
	/** Encoder algorithm filenames loaded via document.write. @type {string[]} */
	const __MODULES__ = [
		"base64",
		"url",
		"hex",
		"binary",
		"morse",
		"caesar",
		"keyboard",
	];

	/**
	 * Shared byte-format param spread into base64, hex, binary; ASCII mode refuses any byte > 0x7F on either side.
	 * @type {{key:string, label:string, type:string, options:string[], default:string}}
	 * @memberOf module:Encoders
	 */
	const __BYTE_FORMAT_PARAM__ = {
		key: "encoding",
		label: "Format",
		type: "select",
		options: ["UTF-8", "ASCII"],
		default: "UTF-8",
	};

	/** Currently selected encoder spec, or undefined when nothing is picked. @type {object} */
	let selected = undefined;

	for (let i = 0 ; i < __MODULES__.length ; i++)
		document.write ("<script src=\"libs/encoders/modules/" + __MODULES__[i] + ".js\"></script>");

	/**
	 * Convert input string to bytes; throws on non-ASCII when ASCII format is selected.
	 * @param {string} input Text to encode.
	 * @param {string} encoding Format key from BYTE_FORMAT_PARAM.options.
	 * @return {Uint8Array} Byte representation.
	 * @memberOf module:Encoders
	 */
	function toBytes (input, encoding) {

		const bytes = new TextEncoder ().encode (input);
		if (encoding === "ASCII") {
			for (let i = 0 ; i < bytes.length ; i++) {
				if (bytes[i] > 0x7F)
					throw new Error ("Input contains non-ASCII characters");
			}
		}
		return bytes;
	};

	/**
	 * Convert bytes back to text; throws on non-ASCII when ASCII format is selected.
	 * @param {Uint8Array} bytes Byte representation.
	 * @param {string} encoding Format key from BYTE_FORMAT_PARAM.options.
	 * @return {string} Decoded text.
	 * @memberOf module:Encoders
	 */
	function fromBytes (bytes, encoding) {

		if (encoding === "ASCII") {
			for (let i = 0 ; i < bytes.length ; i++) {
				if (bytes[i] > 0x7F)
					throw new Error ("Decoded bytes contain non-ASCII values");
			}
		}
		return new TextDecoder ().decode (bytes);
	};

	// expose shared helpers for byte-oriented algorithm modules
	App.encoders.BYTE_FORMAT_PARAM = __BYTE_FORMAT_PARAM__;
	App.encoders.toBytes = toBytes;
	App.encoders.fromBytes = fromBytes;

	/**
	 * Read the typed value off a param control.
	 * @param {HTMLElement} el Input element with a data-param attribute.
	 * @return {*} Typed value (1/0 for checkbox, number or undefined for number, string otherwise).
	 * @memberOf module:Encoders
	 */
	function valueOf (el) {

		if (el.type === "checkbox")
			return (el.checked === true) ? 1 : 0;
		if (el.type === "number")
			return (el.value === "") ? undefined : Number (el.value);
		return el.value;
	};

	/**
	 * Build a per-param ui preview update callback that the picker binds to the input's "input" event.
	 * @param {object} p Param spec.
	 * @param {HTMLElement} inputEl Input element to read.
	 * @param {HTMLElement} uiSpan Span to render into.
	 * @return {Function} Bound update function.
	 * @memberOf module:Encoders
	 */
	function makeUiUpdate (p, inputEl, uiSpan) {

		return function () {

			p.ui (valueOf (inputEl), uiSpan);
		};
	};

	/**
	 * Build the params control strip for the selected encoder.
	 * - Empty params list hides the container
	 * - Each param renders into a label with type-appropriate input
	 * - Optional p.ui(value, container) callback renders a live preview next to the input
	 *
	 * @param {HTMLElement} container The #encoderParams element.
	 * @param {object} encoder Selected encoder spec.
	 * @memberOf module:Encoders
	 */
	function renderParamControls (container, encoder) {

		container.innerHTML = "";
		const params = (encoder !== undefined) ? encoder.params : undefined;
		if (params === undefined || params.length === 0) {
			container.hidden = true;
			return;
		}
		container.hidden = false;
		for (let i = 0 ; i < params.length ; i++) {
			const p = params[i];
			const label = document.createElement ("label");
			label.className = "encoder-param";
			if (p.type === "checkbox") {
				label.innerHTML = "<input type=\"checkbox\" data-param=\"" + p.key + "\"" +
					((p.default === 1 || p.default === true) ? " checked" : "") + "> " + p.label;
			} else if (p.type === "number") {
				const min = (p.min !== undefined) ? " min=\"" + p.min + "\"" : "";
				const max = (p.max !== undefined) ? " max=\"" + p.max + "\"" : "";
				label.innerHTML = "<span>" + p.label + "</span><input type=\"number\" data-param=\"" +
					p.key + "\" value=\"" + p.default + "\"" + min + max + ">";
			} else if (p.type === "select") {
				let opts = "";
				const choices = (p.options !== undefined) ? p.options : [];
				for (let j = 0 ; j < choices.length ; j++) {
					opts += "<option value=\"" + choices[j] + "\"" +
						((choices[j] === p.default) ? " selected" : "") + ">" + choices[j] + "</option>";
				}
				label.innerHTML = "<span>" + p.label + "</span><select data-param=\"" +
					p.key + "\">" + opts + "</select>";
			} else {
				const value = (p.default !== undefined) ? p.default : "";
				label.innerHTML = "<span>" + p.label + "</span><input type=\"text\" data-param=\"" +
					p.key + "\" value=\"" + value + "\">";
			}
			container.appendChild (label);
			if (typeof p.ui === "function") {
				const uiSpan = document.createElement ("span");
				uiSpan.className = "encoder-param-ui";
				label.appendChild (uiSpan);
				const inputEl = label.querySelector ("[data-param]");
				const update = makeUiUpdate (p, inputEl, uiSpan);
				inputEl.addEventListener ("input", update);
				update ();
			}
		}
	};

	/**
	 * Read all current param values into a plain object keyed by param.key.
	 * @param {HTMLElement} container The #encoderParams element.
	 * @return {object} Map of param key to typed value.
	 * @memberOf module:Encoders
	 */
	function readParamValues (container) {

		const values = {};
		const inputs = container.querySelectorAll ("[data-param]");
		for (let i = 0 ; i < inputs.length ; i++)
			values[inputs[i].dataset.param] = valueOf (inputs[i]);
		return values;
	};

	/**
	 * Look up the encoder with the given id; undefined if not found.
	 * @param {string} id Encoder id.
	 * @return {object} Encoder spec or undefined.
	 * @memberOf module:Encoders
	 */
	function findEncoder (id) {

		for (let i = 0 ; i < App.encoders.list.length ; i++) {
			if (App.encoders.list[i].id === id)
				return App.encoders.list[i];
		}
		return undefined;
	};

	/**
	 * Mark the row with matching id as selected, update the header label, rebuild the param controls.
	 * @param {string} id Encoder id to select.
	 * @memberOf module:Encoders
	 */
	function selectEncoder (id) {

		const enc = findEncoder (id);
		if (enc === undefined)
			return;
		selected = enc;
		const rows = document.querySelectorAll (".encoder-row");
		for (let i = 0 ; i < rows.length ; i++)
			rows[i].classList.toggle ("selected", rows[i].dataset.encoderId === id);
		App.utils.$ ("encoderSelectedName").textContent = "Selected: " + enc.name;
		renderParamControls (App.utils.$ ("encoderParams"), enc);
	};

	/**
	 * Row click handler. Reads the encoder id off the row's dataset.
	 * @param {Event} event Click event.
	 * @memberOf module:Encoders
	 */
	function onRowClick (event) {

		selectEncoder (event.currentTarget.dataset.encoderId);
	};

	/**
	 * Build the encoder list rows from App.encoders.list.
	 * @param {HTMLElement} container The #encoderList element.
	 * @memberOf module:Encoders
	 */
	function renderList (container) {

		const escapeHtml = App.utils.escapeHtml;
		container.innerHTML = "";
		for (let i = 0 ; i < App.encoders.list.length ; i++) {
			const enc = App.encoders.list[i];
			const row = document.createElement ("div");
			row.className = "encoder-row";
			row.dataset.encoderId = enc.id;
			row.title = "Click to select " + enc.name;
			const ex = (enc.example !== undefined) ?
				"<span class=\"encoder-example\">" + escapeHtml (enc.example) + "</span>" :
				"";
			row.innerHTML = "<span class=\"encoder-name\">" +
				escapeHtml (enc.name) + "</span>" + ex;
			row.addEventListener ("click", onRowClick);
			container.appendChild (row);
		}
	};

	/**
	 * Run the currently-selected encoder in the given direction.
	 * 1. Refuse if no encoder is selected.
	 * 2. Refuse if the encoder doesn't expose this direction.
	 * 3. Refuse if input is empty.
	 * 4. Apply the function, commit history, alert on result.
	 *
	 * @param {string} direction Either "encode" or "decode".
	 * @memberOf module:Encoders
	 */
	function run (direction) {

		if (selected === undefined) {
			App.showAlert ("Select an encoder first", "warn");
			return;
		}

		const fn = (direction === "encode") ? selected.encode : selected.decode;
		if (typeof fn !== "function") {
			App.showAlert (selected.name + " does not support " + direction, "warn");
			return;
		}

		const src = App.dom.panel1.value;
		if (src === "") {
			App.showAlert ("Input is empty", "warn");
			return;
		}

		const params = readParamValues (App.utils.$ ("encoderParams"));
		try {
			App.panel2.set ({ text: fn (src, params) });
			App.commitSnapshot ();
			App.showAlert (selected.name + ": " + direction + "d", "success");
		} catch (e) {
			App.showAlert (selected.name + " " + direction + " failed: " + e.message, "error");
		}
	};

	function onEncodeClick () { run ("encode"); };
	function onDecodeClick () { run ("decode"); };

	/**
	 * Filter input handler. Hides rows whose name and example don't contain the query.
	 * @memberOf module:Encoders
	 */
	function onFilterInput () {

		const q = App.utils.$ ("encoderFilter").value.trim ().toLowerCase ();
		const rows = App.utils.$ ("encoderList").querySelectorAll (".encoder-row");
		for (let i = 0 ; i < rows.length ; i++) {
			const row = rows[i];
			const nameEl = row.querySelector (".encoder-name");
			const exEl = row.querySelector (".encoder-example");
			const name = (nameEl !== null) ? nameEl.textContent.toLowerCase () : "";
			const ex = (exEl !== null) ? exEl.textContent.toLowerCase () : "";
			const match = (q === "" || name.indexOf (q) !== -1 || ex.indexOf (q) !== -1) ? 1 : 0;
			row.style.display = (match === 1) ? "" : "none";
		}
	};

	/**
	 * Render the list and bind the filter and Encode/Decode buttons. Called by the shell at DOMContentLoaded.
	 * @memberOf module:Encoders
	 */
	function init () {

		const list = App.utils.$ ("encoderList");
		if (list === null)
			return;
		renderList (list);
		App.utils.$ ("encoderFilter").addEventListener ("input", onFilterInput);
		App.utils.$ ("runEncode").addEventListener ("click", onEncodeClick);
		App.utils.$ ("runDecode").addEventListener ("click", onDecodeClick);
	};

	return {
		name: "encoders",
		init: init,
	};
}) ();
App.libraries.push (Encoders);
