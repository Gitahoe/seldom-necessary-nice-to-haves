/** @module Gptp */

window.App = window.App || {};
App.libraries = App.libraries || [];

const Gptp = (function () {

	// ! Make sure to update this if you add/remove modules!
	/** Module filenames (without extension) loaded via document.write. @type {string[]} */
	const __MODULES__ = [
		"replace",
		"count",
		"setops",
		"diff",
	];

	for (let i = 0 ; i < __MODULES__.length ; i++)
		document.write ("<script src=\"libs/gptp/modules/" + __MODULES__[i] + ".js\"></script>");

	/**
	 * Call each registered module's init if present. Invoked by the shell at DOMContentLoaded.
	 * @memberOf module:Gptp
	 */
	function init () {

		if (App.replace !== undefined && App.replace.init !== undefined)
			App.replace.init ();
		if (App.count !== undefined && App.count.init !== undefined)
			App.count.init ();
		if (App.setops !== undefined && App.setops.init !== undefined)
			App.setops.init ();
		if (App.diff !== undefined && App.diff.init !== undefined)
			App.diff.init ();
	};

	return {
		name: "gptp",
		init: init,
	};
}) ();
App.libraries.push (Gptp);
