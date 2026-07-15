/** @module Morse */

window.App = window.App || {};
App.encoders = App.encoders || { list : [] };

const Morse = (function () {

	/** Letter/digit/punct to ITU-R M.1677-1 Morse code. @type {object} */
	const __MORSE__ = {
		"A": ".-",    "B": "-...",  "C": "-.-.",  "D": "-..",   "E": ".",
		"F": "..-.",  "G": "--.",   "H": "....",  "I": "..",    "J": ".---",
		"K": "-.-",   "L": ".-..",  "M": "--",    "N": "-.",    "O": "---",
		"P": ".--.",  "Q": "--.-",  "R": ".-.",   "S": "...",   "T": "-",
		"U": "..-",   "V": "...-",  "W": ".--",   "X": "-..-",  "Y": "-.--",
		"Z": "--..",
		"0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
		"5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
		".": ".-.-.-",  ",": "--..--",  "?": "..--..",  "'": ".----.",
		"!": "-.-.--",  "/": "-..-.",   "(": "-.--.",   ")": "-.--.-",
		"&": ".-...",   ":": "---...",  ";": "-.-.-.",  "=": "-...-",
		"+": ".-.-.",   "-": "-....-",  "_": "..--.-",  "\"": ".-..-.",
		"$": "...-..-", "@": ".--.-.",
	};

	/** Reverse lookup, Morse code back to character. @type {object} */
	const __MORSE_INV__ = {};
	for (let key in __MORSE__)
		__MORSE_INV__[__MORSE__[key]] = key;

	/**
	 * Encode by mapping each character to its Morse code.
	 * - Words split on whitespace, joined back with " / "
	 * - Characters without a mapping are dropped
	 *
	 * @param {string} input Plain text.
	 * @return {string} Morse-encoded text.
	 * @memberOf module:Morse
	 */
	function encode (input) {

		const upper = input.toUpperCase ();
		const chunks = upper.split (/(\s+)/);
		const parts = [];

		for (let i = 0 ; i < chunks.length ; i++) {

			const chunk = chunks[i];
			if (chunk === "")
				continue;
			if (/\s/.test (chunk)) {
				parts.push ("/");
				continue;
			}

			const codes = [];
			for (let j = 0 ; j < chunk.length ; j++) {
				const code = __MORSE__[chunk[j]];
				if (code !== undefined)
					codes.push (code);
			}

			if (codes.length > 0)
				parts.push (codes.join (" "));
		}
		
		return parts.join (" ");
	};

	/**
	 * Decode by splitting on " / " for words and whitespace for letters; unknown codes drop to empty.
	 * @param {string} input Morse-encoded text.
	 * @return {string} Decoded text.
	 * @memberOf module:Morse
	 */
	function decode (input) {

		const words = input.trim ().split (/\s*\/\s*/);
		const out = [];
		for (let i = 0 ; i < words.length ; i++) {
			const codes = words[i].split (/\s+/);
			let word = "";
			for (let j = 0 ; j < codes.length ; j++) {
				const ch = __MORSE_INV__[codes[j]];
				if (ch !== undefined)
					word += ch;
			}
			out.push (word);
		}
		return out.join (" ");
	};

	return {
		id: "morse",
		name: "Morse code",
		example: "SOS -> ... --- ...",
		encode: encode,
		decode: decode,
	};
}) ();
App.encoders.list.push (Morse);
