// Run: node --test akwad_erpnext_fixes/tests/report_print_bundles.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function load(bundle, frappe_overrides = {}) {
	const frappe = {
		provide(name) {
			this.akwad_report = this.akwad_report || {};
		},
		utils: { escape_html: (s) => String(s) },
		boot: {},
		ui: {},
		...frappe_overrides,
	};
	const sandbox = { frappe, __: (s) => s, $: () => {} };
	vm.createContext(sandbox);
	const file = path.join(__dirname, "../public/js", bundle);
	vm.runInContext(fs.readFileSync(file, "utf8"), sandbox);
	return frappe.akwad_report;
}

const CORE_ROWS =
	'<div class="filter-row">\n\t<strong>Company:</strong> Acme\n</div>' +
	'<div class="filter-row">\n\t<strong>Include Dimensions:</strong> Yes\n</div>' +
	'<div class="filter-row">\n\t<strong>Show Remarks:</strong> No\n</div>';

test("build_header renders a centred title block with company and period", () => {
	const ns = load("report_print_style.bundle.js");
	const html = ns.build_header({ title: "T", company: "Acme", period: "a to b" });
	assert.match(html, /akwad-report-title"><h2>T<\/h2><div class="akwad-report-company">Acme<\/div><div class="akwad-report-period">a to b<\/div>/);
	assert.doesNotMatch(html, /akwad-report-filters/);
});

test("filter strip keeps value filters inline and turns Yes/No filters into on/off pills", () => {
	const ns = load("report_print_style.bundle.js");
	const html = ns.build_header({ title: "T", filters_html: CORE_ROWS });
	assert.match(html, /<span class="filter-row"><strong>Company<\/strong>Acme<\/span>/);
	assert.match(html, /akwad-report-options"><strong>Options<\/strong>/);
	assert.match(html, /<span class="akwad-pill akwad-pill-on">Include Dimensions<\/span>/);
	assert.match(html, /<span class="akwad-pill">Show Remarks<\/span>/);
	assert.doesNotMatch(html, /Yes|No</);
});

test("filter strip falls back to core's markup when the row shape is unknown", () => {
	const ns = load("report_print_style.bundle.js");
	const html = ns.build_header({ title: "T", filters_html: '<p class="filter-row">X</p>' });
	assert.match(html, /akwad-report-filters"><p class="filter-row">X<\/p>/);
});

test("build_header omits the filter box when filters_html is empty", () => {
	const ns = load("report_print_style.bundle.js");
	assert.doesNotMatch(ns.build_header({ title: "T", filters_html: null }), /akwad-report-filters/);
});

test("structural CSS carries no color, font-family or var()", () => {
	const ns = load("report_print_style.bundle.js");
	assert.doesNotMatch(ns.CSS, /#[0-9a-f]{3,6}\b|font-family|var\(|display:\s*flex|gap:/i);
});

test("get_style_tag embeds the Akwad theme from boot, with the structural CSS", () => {
	const ns = load("report_print_style.bundle.js", { boot: { akwad_report_theme_css: ".akwad-report{color:#111}" } });
	const tag = ns.get_style_tag();
	assert.ok(tag.includes(".akwad-report{color:#111}"));
	assert.ok(tag.includes("akwad-report-table"));
});

test("always-included line uses printed_columns, not excluded fieldnames", () => {
	const ns = load("report_print_dialog.bundle.js");
	const report = {
		excluded_fieldnames: ["voucher_no", "debit"],
		printed_columns: ["Date", "Particulars", "Debit"],
	};
	const picker = new ns.TemplatePicker(report, [
		{ fieldname: "voucher_no", label: "Voucher No" },
		{ fieldname: "cost_center", label: "Cost Center" },
	]);
	assert.deepStrictEqual(picker.static_column_labels, ["Date", "Particulars", "Debit"]);
	assert.deepStrictEqual(picker.column_options.map((o) => o.value), ["cost_center"]);
});
