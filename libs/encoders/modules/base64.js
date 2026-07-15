/** @module Base64 */

window.App = window.App || {};
App.encoders = App.encoders || { list : [] };

const Base64 = (function () {

	/**
	 * Encode via byte trip.
	 * - Raw btoa on a JS string would corrupt any non-ASCII codepoint
	 * - toBytes applies the selected Format param (UTF-8 or ASCII)
	 *
	 * @param {string} input Text to encode.
	 * @param {{encoding:string}} p Encoder params.
	 * @return {string} Base64-encoded text.
	 * @memberOf module:Base64
	 */
	function encode (input, p) {

		const bytes = App.encoders.toBytes (input, p.encoding);
		let bin = "";
		for (let i = 0 ; i < bytes.length ; i++)
			bin += String.fromCharCode (bytes[i]);
		return btoa (bin);
	};

	/**
	 * Decode by stripping whitespace, calling atob, routing through fromBytes.
	 * @param {string} input Base64-encoded text.
	 * @param {{encoding:string}} p Encoder params.
	 * @return {string} Decoded text.
	 * @memberOf module:Base64
	 */
	function decode (input, p) {

		const bin = atob (input.replace (/\s+/g, ""));
		const bytes = new Uint8Array (bin.length);
		for (let i = 0 ; i < bin.length ; i++)
			bytes[i] = bin.charCodeAt (i);
		return App.encoders.fromBytes (bytes, p.encoding);
	};

	return {
		id: "base64",
		name: "Base64",
		example: "hello -> aGVsbG8=",
		params: [App.encoders.BYTE_FORMAT_PARAM],
		encode: encode,
		decode: decode,
	};
}) ();
App.encoders.list.push (Base64);
