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

test("build_header renders core's filters_html and no duplicate meta list", () => {
	const ns = load("report_print_style.bundle.js");
	const html = ns.build_header({
		title: "T",
		company: "Acme",
		period: "a to b",
		filters_html: '<div class="filter-row">X</div>',
	});
	assert.match(html, /akwad-report-filters[^>]*><div class="filter-row">X<\/div>/);
	assert.match(html, /Acme/);
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
