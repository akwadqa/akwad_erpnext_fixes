// Copyright (c) 2026, Akwad Programming and contributors
// For license information, please see license.txt

const COLUMNS_QUERY =
	"akwad_erpnext_fixes.akwad_erpnext_fixes.doctype.report_print_template.report_print_template.get_report_columns_query";

frappe.ui.form.on("Report Print Template", {
	refresh(frm) {
		frm.fields_dict.columns.grid.get_field("field").get_query = function () {
			return {
				query: COLUMNS_QUERY,
				// Autocomplete forwards only `params` to the query (unlike Link's
				// `filters`), so `report` would never reach the server.
				params: { report: frm.doc.report },
			};
		};
		load_column_labels(frm);
	},

	report(frm) {
		load_column_labels(frm);
	},
});

// Autocomplete cells show the raw stored fieldname until the control's own
// data cache fills, and core only fills it after a keystroke triggers the
// live query. Pre-seed both render paths eagerly: the meta formatter for
// static (non-editing) grid cells, df.options for edit-mode controls.
function load_column_labels(frm) {
	if (!frm.doc.report || frm._column_labels_report === frm.doc.report) return;
	frm._column_labels_report = frm.doc.report;

	frappe
		.call(COLUMNS_QUERY, { report: frm.doc.report })
		.then((r) => apply_column_labels(frm, r.message || []));
}

function apply_column_labels(frm, options) {
	const labels = {};
	options.forEach((option) => (labels[option.value] = option.label));

	frappe.meta.docfield_map["Report Print Template Column"]["field"].formatter = (value) =>
		labels[value] || value;

	const grid = frm.fields_dict.columns.grid;
	grid.update_docfield_property("field", "options", options);
	grid.refresh();
}
