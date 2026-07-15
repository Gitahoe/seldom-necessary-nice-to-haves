/** @module Binary */

window.App = window.App || {};
App.encoders = App.encoders || { list : [] };

const Binary = (function () {

	/**
	 * Encode each byte as 8 bits, space-separated.
	 * @param {string} input Text to encode.
	 * @param {{encoding:string}} p Encoder params.
	 * @return {string} Space-separated 8-bit groups.
	 * @memberOf module:Binary
	 */
	function encode (input, p) {

		const bytes = App.encoders.toBytes (input, p.encoding);
		const parts = [];
		for (let i = 0 ; i < bytes.length ; i++)
			parts.push (bytes[i].toString (2).padStart (8, "0"));
		return parts.join (" ");
	};

	/**
	 * Decode whitespace-separated 8-bit groups.
	 * - Throws on any token that isn't exactly 8 chars of 0 or 1
	 *
	 * @param {string} input Whitespace-separated 8-bit groups.
	 * @param {{encoding:string}} p Encoder params.
	 * @return {string} Decoded text.
	 * @memberOf module:Binary
	 */
	function decode (input, p) {

		const trimmed = input.trim ();
		const raw = (trimmed === "") ? [] : trimmed.split (/\s+/);
		const tokens = [];

		for (let i = 0 ; i < raw.length ; i++) {
			if (raw[i] !== "")
				tokens.push (raw[i]);
		}

		for (let i = 0 ; i < tokens.length ; i++) {
			if (!/^[01]{8}$/.test (tokens[i]))
				throw new Error ("Each byte must be 8 bits of 0 or 1");
		}
		
		const bytes = new Uint8Array (tokens.length);
		for (let i = 0 ; i < tokens.length ; i++)
			bytes[i] = parseInt (tokens[i], 2);

		return App.encoders.fromBytes (bytes, p.encoding);
	};

	return {
		id: "binary",
		name: "Binary",
		example: "Hi -> 01001000 01101001",
		params: [App.encoders.BYTE_FORMAT_PARAM],
		encode: encode,
		decode: decode,
	};
}) ();
App.encoders.list.push (Binary);
