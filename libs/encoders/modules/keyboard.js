/** @module Keyboard */

/*	Keyboard layout transliteration. For each character in the input, find its
	physical key position on the "From" layout (looking through both unshifted
	and shifted rows, 47 keys each) and emit the character at the same position
	on the "To" layout. Useful for recovering text typed on the wrong layout,
	or for previewing what text would look like on another. Each layout is
	{ lower, upper } - two 47-char strings indexed by QWERTY US ANSI physical
	position: 13 number-row + 13 top-letter + 11 home-row + 10 bottom-row keys.
	ISO-only keys (e.g. the AZERTY extra punct key right of M) use a sensible
	ANSI fallback. Characters not at any position on the source layout pass
	through unchanged. Case is preserved implicitly: lookup tries lower first,
	then upper, and the matching index into the other layout's string already
	carries the same case slot. */

window.App = window.App || {};
App.encoders = App.encoders || { list : [] };

const Keyboard = (function () {

	/**
	 * Per-layout key data, 47 unshifted + 47 shifted chars indexed by QWERTY US ANSI physical position.
	 * @type {object["<layout_name>":{lower:string, upper:string}]}
	 */
	const __LAYOUTS__ = {
		QWERTY: {
			lower: "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./",
			upper: "~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:\"ZXCVBNM<>?",
		},
		AZERTY: {
			lower: "²&é\"'(-è_çà)=azertyuiop^$\\qsdfghjklmùwxcvbn,;:!",
			upper: "³1234567890°+AZERTYUIOP¨£|QSDFGHJKLM%WXCVBN?./§",
		},
		QWERTZ: {
			lower: "^1234567890ß´qwertzuiopü+\\asdfghjklöäyxcvbnm,.-",
			upper: "°!\"§$%&/()=?`QWERTZUIOPÜ*|ASDFGHJKLÖÄYXCVBNM;:_",
		},
		DVORAK: {
			lower: "`1234567890[]',.pyfgcrl/=\\aoeuidhtns-;qjkxbmwvz",
			upper: "~!@#$%^&*(){}\"<>PYFGCRL?+|AOEUIDHTNS_:QJKXBMWVZ",
		},
		COLEMAK: {
			lower: "`1234567890-=qwfpgjluy;[]\\arstdhneio'zxcvbkm,./",
			upper: "~!@#$%^&*()_+QWFPGJLUY:{}|ARSTDHNEIO\"ZXCVBKM<>?",
		},
	};

	/** Available layout names in fixed order. @type {string[]} */
	const __NAMES__ = ["QWERTY", "AZERTY", "QWERTZ", "DVORAK", "COLEMAK"];

	/**
	 * Map each character of input from its position on the From layout to the character at the same position on the To layout.
	 * - Tries lower row first, then upper row
	 * - Characters not found on the From layout pass through unchanged
	 *
	 * @param {string} input Text to transliterate.
	 * @param {string} fromKey Source layout name.
	 * @param {string} toKey Target layout name.
	 * @return {string} Transliterated text.
	 * @memberOf module:Keyboard
	 */
	function transliterate (input, fromKey, toKey) {

		const from = __LAYOUTS__[fromKey];
		const to = __LAYOUTS__[toKey];

		if (from === undefined || to === undefined)
			throw new Error ("Unknown layout");
		if (from === to)
			return input;

		let out = "";
		for (let i = 0 ; i < input.length ; i++) {
			const ch = input[i];
			let idx = from.lower.indexOf (ch);
			if (idx !== -1) {
				out += to.lower[idx];
				continue;
			}
			idx = from.upper.indexOf (ch);
			if (idx !== -1) {
				out += to.upper[idx];
				continue;
			}
			out += ch;
		}
		
		return out;
	};

	/**
	 * Encode from p.from to p.to.
	 * @param {string} input Plain text.
	 * @param {{from:string, to:string}} p Encoder params.
	 * @return {string} Transliterated text.
	 * @memberOf module:Keyboard
	 */
	function encode (input, p) {

		return transliterate (input, p.from, p.to);
	};

	/**
	 * Decode reverses the From/To direction.
	 * @param {string} input Transliterated text.
	 * @param {{from:string, to:string}} p Encoder params.
	 * @return {string} Recovered text.
	 * @memberOf module:Keyboard
	 */
	function decode (input, p) {

		return transliterate (input, p.to, p.from);
	};

	return {
		id: "keyboard",
		name: "Keyboard layout",
		example: "qwerty -> azerty",
		params: [
			{ key: "from", label: "From", type: "select", options: __NAMES__, default: "QWERTY" },
			{ key: "to",   label: "To",   type: "select", options: __NAMES__, default: "AZERTY" },
		],
		encode: encode,
		decode: decode,
	};
}) ();
App.encoders.list.push (Keyboard);
