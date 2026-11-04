// Copyright (c) 2025, Akwad Programming and contributors
// For license information, please see license.txt


// Shared styling and rendering helpers for JS-based Report Print Formats
frappe.provide("frappe.akwad_report");

(function (ns) {
	// Structure only. Colors and fonts belong to Akwad Print Style, which
	// get_style_tag() embeds from boot, so the Print Style selected in Print
	// Settings does not matter. wkhtmltopdf 0.12.6.1 renders the PDF: no flex,
	// no gap, no CSS variables (spec Lesson 16).
	ns.CSS = `
.akwad-report .akwad-report-title {
	text-align: center;
	margin: 0 0 10px;
}

.akwad-report .akwad-report-title h2 {
	margin: 0;
	font-size: 20px;
	font-weight: 600;
	text-transform: uppercase;
}

.akwad-report table.akwad-report-header {
	width: 100%;
	border-collapse: collapse;
	margin: 0 0 10px;
}

.akwad-report table.akwad-report-header td {
	width: 50%;
	padding: 0;
	vertical-align: top;
}

.akwad-report .filter-row {
	margin-bottom: 2px;
	line-height: 1.5;
}

.akwad-report .akwad-report-filters {
	margin: 0 0 14px;
	padding: 8px 14px;
	font-size: 11px;
}

.akwad-report table.akwad-report-table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
}

.akwad-report table.akwad-report-table thead th {
	text-align: center;
	font-weight: 600;
	font-size: 11px;
	padding: 6px 8px;
}

.akwad-report table.akwad-report-table tbody td {
	padding: 5px 8px;
	vertical-align: top;
	word-wrap: break-word;
}

.akwad-report .akwad-row-group td,
.akwad-report .akwad-row-total td {
	font-weight: 600;
}

.akwad-report .akwad-row-closing td {
	font-weight: 700;
}

.akwad-report .akwad-indent-1 { padding-left: 18px !important; }
.akwad-report .akwad-indent-2 { padding-left: 36px !important; }
.akwad-report .akwad-indent-3 { padding-left: 54px !important; }
.akwad-report .akwad-indent-4 { padding-left: 72px !important; }

.akwad-report .text-left { text-align: left; }
.akwad-report .text-right { text-align: right; }
.akwad-report .text-center { text-align: center; }
.akwad-report .text-muted { font-size: 10px; }

.akwad-report .akwad-report-footer {
	margin-top: 10px;
	font-size: 10px;
	text-align: right;
}

.akwad-report .akwad-letterhead-footer {
	margin-top: 16px;
	padding-top: 8px;
	font-size: 11px;
}

@media print {
	.akwad-report table.akwad-report-table thead { display: table-header-group; }
	.akwad-report tr { page-break-inside: avoid; }
}
`;

	ns.get_style_tag = function () {
		return "<style>" + ns.CSS + (frappe.boot.akwad_report_theme_css || "") + "</style>";
	};

	function labeled_row(label, value) {
		return value
			? '<div class="filter-row"><strong>' +
					label +
					":</strong> " +
					frappe.utils.escape_html(value) +
					"</div>"
			: "";
	}

	// `filters_html` is core's own applied-filter list (the print dialog's
	// "Include filters" box, passed to the template as `subtitle`).
	ns.build_header = function (opts) {
		opts = opts || {};

		var html = '<div class="akwad-report-title"><h2>' + frappe.utils.escape_html(opts.title || "") + "</h2></div>";
		html +=
			'<table class="akwad-report-header"><tr><td>' +
			labeled_row(__("Company"), opts.company) +
			'</td><td style="text-align: right;">' +
			labeled_row(__("Period"), opts.period) +
			"</td></tr></table>";

		if (opts.filters_html) {
			html += '<div class="akwad-report-filters">' + opts.filters_html + "</div>";
		}

		return html;
	};

	// Wanted fieldnames (e.g. from print_settings.extra_columns, chosen in
	// the print dialog's template picker — see report_print_dialog.bundle.js),
	// intersected with the columns this report run actually returned — a
	// field gated off by the report's own filters for this run drops out.
	ns.get_extra_columns = function (wanted_fieldnames, available_columns) {
		var by_fieldname = {};
		(available_columns || []).forEach(function (c) {
			by_fieldname[c.fieldname] = c;
		});
		return (wanted_fieldnames || [])
			.map(function (f) {
				return by_fieldname[f];
			})
			.filter(Boolean);
	};

	ns.render_extra_headers = function (columns) {
		return (columns || [])
			.map(function (c) {
				return '<th style="text-align: left;">' + frappe.utils.escape_html(__(c.label)) + "</th>";
			})
			.join("");
	};

	// `show` gates value rendering (e.g. false for group/total rows), but a
	// <td> is always emitted per column so colspans stay aligned.
	ns.render_extra_cells = function (row, columns, show) {
		return (columns || [])
			.map(function (c) {
				var value = show ? frappe.format(row[c.fieldname], c, { for_print: true }) : "";
				return '<td class="text-left">' + (value || "") + "</td>";
			})
			.join("");
	};

	// Depth-first walk over a flat or nested (children[]) row list
	ns.render_rows = function (rows, render_row, opts) {
		opts = opts || {};
		var children_field = opts.children_field || "children";
		var html = "";

		function walk(list, depth) {
			(list || []).forEach(function (row) {
				html += render_row(row, depth) || "";
				if (row[children_field] && row[children_field].length) {
					walk(row[children_field], depth + 1);
				}
			});
		}

		walk(rows, 0);
		return html;
	};

	ns.footer = function () {
		return (
			'<div class="akwad-report-footer">' +
			__("Printed on {0}", [frappe.datetime.str_to_user(frappe.datetime.get_datetime_as_string())]) +
			"</div>"
		);
	};

	// Letter Head footer
	ns.letterhead_footer = function (print_settings) {
		if (!print_settings || !print_settings.with_letter_head) return "";
		var footer = print_settings.letter_head && print_settings.letter_head.footer;
		if (!footer) return "";
		return '<div class="akwad-letterhead-footer">' + footer + "</div>";
	};
})(frappe.akwad_report);
