/** @module Caesar */

window.App = window.App || {};
App.encoders = App.encoders || { list : [] };

const Caesar = (function () {

	/** Reference alphabet shown in the live preview. @type {string} */
	const __ALPHABET__ = "abcdefghijklmnopqrstuvwxyz";

	/**
	 * Rotate letters by n positions. Works on both cases; non-letters pass through unchanged.
	 * @param {string} s Text to rotate.
	 * @param {number} n Shift amount (positive or negative).
	 * @return {string} Rotated text.
	 * @memberOf module:Caesar
	 */
	function caesarShift (s, n) {

		const k = ((n % 26) + 26) % 26;
		let out = "";
		for (let i = 0 ; i < s.length ; i++) {
			const code = s.charCodeAt (i);
			if (code >= 65 && code <= 90)
				out += String.fromCharCode ((code - 65 + k) % 26 + 65);
			else if (code >= 97 && code <= 122)
				out += String.fromCharCode ((code - 97 + k) % 26 + 97);
			else
				out += s[i];
		}
		return out;
	};

	/**
	 * Resolve a shift value from the params object. Tolerates undefined, empty string, and non-finite Number inputs.
	 * @param {*} value Raw shift value from the picker.
	 * @return {number} Shift to apply.
	 * @memberOf module:Caesar
	 */
	function resolveShift (value) {

		if (value === undefined || value === "")
			return 0;
		const n = Number (value);
		return Number.isFinite (n) ? n : 0;
	};

	/**
	 * Render the shift preview shown next to the Shift input.
	 * @param {*} value Current shift value.
	 * @param {Element} container Span to render into.
	 * @memberOf module:Caesar
	 */
	function shiftPreview (value, container) {

		container.textContent = __ALPHABET__ + " -> " +
			caesarShift (__ALPHABET__, resolveShift (value));
	};

	/**
	 * Encode by shifting forward.
	 * @param {string} input Plain text.
	 * @param {{shift:*}} p Encoder params.
	 * @return {string} Encoded text.
	 * @memberOf module:Caesar
	 */
	function encode (input, p) {

		return caesarShift (input, resolveShift (p.shift));
	};

	/**
	 * Decode by shifting backward.
	 * @param {string} input Encoded text.
	 * @param {{shift:*}} p Encoder params.
	 * @return {string} Decoded text.
	 * @memberOf module:Caesar
	 */
	function decode (input, p) {

		return caesarShift (input, -resolveShift (p.shift));
	};

	return {
		id: "caesar",
		name: "Caesar cipher",
		example: "abc -> def (shift 3)",
		params: [{
			key: "shift",
			label: "Shift",
			type: "number",
			default: 3,
			min: -25,
			max: 25,
			ui: shiftPreview,
		}],
		encode: encode,
		decode: decode,
	};
}) ();
App.encoders.list.push (Caesar);
