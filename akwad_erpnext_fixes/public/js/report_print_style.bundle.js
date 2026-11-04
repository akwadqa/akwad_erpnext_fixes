// Copyright (c) 2025, Akwad Programming and contributors
// For license information, please see license.txt


// Shared styling and rendering helpers for JS-based Report Print Formats
frappe.provide("frappe.akwad_report");

(function (ns) {
	// Structure only. Colors, fonts and borders belong to Akwad Print Style,
	// which get_style_tag() embeds from boot, so the Print Style selected in
	// Print Settings does not matter. wkhtmltopdf 0.12.6.1 renders the PDF: no
	// flex, no gap, no CSS variables (spec Lesson 16).
	// Cell padding is !important because the embedded style's `.print-format
	// td` rule (for the DocType formats) is too.
	ns.CSS = `
.akwad-report .akwad-report-title {
	text-align: center;
	padding: 12px 0 10px;
	margin: 0 0 16px;
}

.akwad-report .akwad-report-title h2 {
	margin: 0;
	font-size: 19px;
	font-weight: 600;
	letter-spacing: 3px;
	text-transform: uppercase;
}

.akwad-report .akwad-report-company {
	margin: 6px 0 0;
	font-size: 13px;
	font-weight: 500;
}

.akwad-report .akwad-report-period {
	margin: 2px 0 0;
	font-size: 12px;
}

.akwad-report .akwad-report-filters {
	margin: 0 0 18px;
	padding: 8px 12px;
	font-size: 11px;
	line-height: 1.7;
}

.akwad-report .akwad-report-filters .filter-row {
	display: inline-block;
	vertical-align: top;
	margin: 3px 0;
	line-height: 1.3;
	font-weight: 500;
}

.akwad-report .akwad-report-filters .filter-row + .filter-row:before {
	content: "·";
	margin: 0 8px;
	font-weight: 400;
}

.akwad-report .akwad-report-filters strong {
	font-weight: 500;
	margin-right: 4px;
}

.akwad-report .akwad-report-options {
	display: block;
	margin-top: 5px;
	line-height: 1;
}

.akwad-report .akwad-report-options strong {
	margin-right: 6px;
	vertical-align: middle;
}

.akwad-report .akwad-pill {
	display: inline-block;
	padding: 2px 7px;
	margin: 0 4px 4px 0;
	font-size: 10.5px;
	line-height: 14px;
	font-weight: 500;
	vertical-align: middle;
}

.akwad-report table.akwad-report-table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
}

.akwad-report table.akwad-report-table thead th {
	text-align: left;
	font-weight: 500;
	font-size: 10px;
	letter-spacing: 1.2px;
	text-transform: uppercase;
	padding: 6px !important;
}

.akwad-report table.akwad-report-table tbody td {
	padding: 6px !important;
	vertical-align: top;
	word-wrap: break-word;
}

.akwad-report .akwad-row-spacer td {
	padding: 4px 0 !important;
}

.akwad-report .akwad-cell-date {
	white-space: nowrap;
}

.akwad-report .akwad-row-opening td {
	font-style: italic;
}

.akwad-report .akwad-row-group td,
.akwad-report .akwad-row-total td,
.akwad-report .akwad-row-closing td {
	font-weight: 600;
}

.akwad-report .akwad-indent-1 { padding-left: 18px !important; }
.akwad-report .akwad-indent-2 { padding-left: 36px !important; }
.akwad-report .akwad-indent-3 { padding-left: 54px !important; }
.akwad-report .akwad-indent-4 { padding-left: 72px !important; }

.akwad-report .text-left { text-align: left; }
.akwad-report .text-right { text-align: right; }
.akwad-report .text-center { text-align: center; }
.akwad-report .text-muted { font-size: 10.5px; }

.akwad-report .akwad-report-footer {
	margin-top: 22px;
	font-size: 10.5px;
	font-weight: 500;
	text-align: right;
}

.akwad-report .akwad-letterhead-footer {
	margin-top: 28px;
	padding-top: 8px;
	font-size: 10.5px;
	text-align: center;
}

@media print {
	.akwad-report table.akwad-report-table thead { display: table-header-group; }
	.akwad-report tr { page-break-inside: avoid; }
}
`;

	ns.get_style_tag = function () {
		return "<style>" + ns.CSS + (frappe.boot.akwad_report_theme_css || "") + "</style>";
	};

	// Centred title block (title, company, period) followed by the filter
	// strip. `filters_html` is core's own applied-filter list (the print
	// dialog's "Include filters" box, passed to the template as `subtitle`).
	ns.build_header = function (opts) {
		opts = opts || {};

		var html = '<div class="akwad-report-title"><h2>' + frappe.utils.escape_html(opts.title || "") + "</h2>";
		html += labeled_block("akwad-report-company", opts.company);
		html += labeled_block("akwad-report-period", opts.period);
		html += "</div>";

		if (opts.filters_html) {
			html += ns.render_filter_strip(opts.filters_html);
		}

		return html;
	};

	// One run-in line of "Label value" pairs; Yes/No filters (Check fields)
	// become on/off pills on an "Options" line instead. Falls back to core's
	// markup untouched when its row shape is not recognised.
	ns.render_filter_strip = function (filters_html) {
		var rows = parse_filter_rows(filters_html);
		if (!rows.length) {
			return '<div class="akwad-report-filters">' + filters_html + "</div>";
		}

		var html = rows
			.filter(function (row) {
				return !is_flag(row);
			})
			.map(function (row) {
				return '<span class="filter-row"><strong>' + row.label + "</strong>" + row.value + "</span>";
			})
			.join("");

		var flags = rows.filter(is_flag);
		if (flags.length) {
			html +=
				'<span class="akwad-report-options"><strong>' +
				__("Options") +
				"</strong>" +
				flags.map(render_pill).join("") +
				"</span>";
		}

		return '<div class="akwad-report-filters">' + html + "</div>";
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
				return "<th>" + frappe.utils.escape_html(__(c.label)) + "</th>";
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

	function labeled_block(css_class, value) {
		return value ? '<div class="' + css_class + '">' + frappe.utils.escape_html(value) + "</div>" : "";
	}

	// Core's row shape (query_report.js: get_filters_html_for_print):
	// <div class="filter-row"><strong>Label:</strong> value</div>
	function parse_filter_rows(filters_html) {
		var rows = [];
		var row_pattern = /<div class="filter-row">\s*<strong>([\s\S]*?):<\/strong>\s*([\s\S]*?)\s*<\/div>/g;
		var match;
		while ((match = row_pattern.exec(filters_html))) {
			rows.push({ label: match[1], value: match[2] });
		}
		return rows;
	}

	function is_flag(row) {
		return row.value === __("Yes") || row.value === __("No");
	}

	function render_pill(row) {
		var css_class = row.value === __("Yes") ? "akwad-pill akwad-pill-on" : "akwad-pill";
		return '<span class="' + css_class + '">' + row.label + "</span>";
	}
})(frappe.akwad_report);
