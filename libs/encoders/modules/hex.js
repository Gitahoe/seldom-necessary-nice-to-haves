/** @module Hex */

window.App = window.App || {};
App.encoders = App.encoders || { list : [] };

const Hex = (function () {

	/**
	 * Encode bytes as lowercase 2-digit hex pairs with no separator.
	 * @param {string} input Text to encode.
	 * @param {{encoding:string}} p Encoder params.
	 * @return {string} Hex string.
	 * @memberOf module:Hex
	 */
	function encode (input, p) {

		const bytes = App.encoders.toBytes (input, p.encoding);
		let out = "";
		for (let i = 0 ; i < bytes.length ; i++)
			out += bytes[i].toString (16).padStart (2, "0");
		return out;
	};

	/**
	 * Decode by stripping whitespace, validating, then parsing pairs.
	 * - Throws if length is odd
	 * - Throws if any non-hex character is present
	 *
	 * @param {string} input Hex string.
	 * @param {{encoding:string}} p Encoder params.
	 * @return {string} Decoded text.
	 * @memberOf module:Hex
	 */
	function decode (input, p) {

		const cleaned = input.replace (/\s+/g, "");
		if (cleaned.length % 2 !== 0)
			throw new Error ("Hex string must have even length");
		if (!/^[0-9a-fA-F]*$/.test (cleaned))
			throw new Error ("Non-hex characters in input");
		const bytes = new Uint8Array (cleaned.length / 2);
		for (let i = 0 ; i < bytes.length ; i++)
			bytes[i] = parseInt (cleaned.substr (i * 2, 2), 16);
		return App.encoders.fromBytes (bytes, p.encoding);
	};

	return {
		id: "hex",
		name: "Hex",
		example: "Hi -> 4869",
		params: [App.encoders.BYTE_FORMAT_PARAM],
		encode: encode,
		decode: decode,
	};
}) ();
App.encoders.list.push (Hex);
