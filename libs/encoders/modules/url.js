/** @module Url */

window.App = window.App || {};
App.encoders = App.encoders || { list : [] };

const Url = (function () {

	/**
	 * Percent-escape every character that isn't an RFC 3986 unreserved character; wraps encodeURIComponent.
	 * @param {string} input Text to encode.
	 * @return {string} Percent-encoded text.
	 * @memberOf module:Url
	 */
	function encode (input) {

		return encodeURIComponent (input);
	};

	/**
	 * Reverse percent-encoding; wraps decodeURIComponent.
	 * @param {string} input Percent-encoded text.
	 * @return {string} Decoded text.
	 * @memberOf module:Url
	 */
	function decode (input) {

		return decodeURIComponent (input);
	};

	return {
		id: "url",
		name: "URL (percent-encoding)",
		example: "a b -> a%20b",
		encode: encode,
		decode: decode,
	};
}) ();
App.encoders.list.push (Url);
