/** @module Utils */

window.App = window.App || {};
App.libraries = App.libraries || [];

const Utils = (function () {

	// ! Make sure to update this if you add/remove modules!
	/** Module filenames (without extension) loaded via document.write. @type {string[]} */
	const __MODULES__ = [
		"charsets",
	];

	for (let i = 0 ; i < __MODULES__.length ; i++)
		document.write ("<script src=\"libs/utils/" + __MODULES__[i] + ".js\"></script>");

	/**
	 * Call each registered utility's init if present. Invoked by the shell at DOMContentLoaded.
	 * @memberOf module:Utils
	 */
	function init () {

		if (App.charsets !== undefined && App.charsets.init !== undefined)
			App.charsets.init ();
	};

	return {
		name: "utils",
		init: init,
	};
}) ();
App.libraries.push (Utils);
