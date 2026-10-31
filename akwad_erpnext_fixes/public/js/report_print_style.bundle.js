// Copyright (c) 2025, Akwad Programming and contributors
// For license information, please see license.txt


// Shared styling and rendering helpers for JS-based Report Print Formats
frappe.provide("frappe.akwad_report");

(function (ns) {
	ns.CSS = `
.akwad-report {
	--akwad-accent: #00589c;
	font-family: "Rubik", "Inter", sans-serif;
	font-size: 12px;
	color: #171717;
}

.akwad-report .akwad-report-title {
	text-align: center;
	margin: 0 0 10px;
}

.akwad-report .akwad-report-title h2 {
	margin: 0;
	font-size: 20px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

.akwad-report .akwad-report-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 12px;
	margin: 0 0 10px;
}

.akwad-report .akwad-report-header .col {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.akwad-report .filter-row {
	margin-bottom: 2px;
	line-height: 1.5;
}

.akwad-report strong {
	color: #7c7c7c;
	font-weight: 500;
}

.akwad-report .akwad-report-filters {
	display: flex;
	flex-wrap: wrap;
	gap: 6px 24px;
	margin: 0 0 14px;
	padding: 10px 14px;
	background: #f8f8f8;
	border-left: 3px solid var(--akwad-accent);
	font-size: 11px;
}

.akwad-report .akwad-report-filters .filter-row {
	display: flex;
	flex-direction: column;
	margin-bottom: 0;
	min-width: 150px;
}

.akwad-report .akwad-report-filters strong {
	color: var(--akwad-accent);
	font-weight: 600;
	font-size: 9px;
	text-transform: uppercase;
	letter-spacing: 0.4px;
	margin-bottom: 1px;
}

.akwad-report .akwad-report-filters span {
	color: #171717;
}

.akwad-report table.akwad-report-table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
}

.akwad-report table.akwad-report-table thead th {
	background: #f0f0f0;
	text-align: center;
	font-weight: 600;
	font-size: 11px;
	border-top: 2px solid var(--akwad-accent);
	border-bottom: 2px solid var(--akwad-accent);
	padding: 6px 8px;
}

.akwad-report table.akwad-report-table tbody td {
	padding: 5px 8px;
	border-bottom: 1px solid #ededed;
	vertical-align: top;
	word-wrap: break-word;
}

.akwad-report table.akwad-report-table tbody tr:last-child td {
	border-bottom: none;
}

.akwad-report .akwad-row-group td {
	font-weight: 600;
	background: #fafafa;
}

.akwad-report .akwad-row-total td {
	font-weight: 600;
	border-top: 1px solid #171717;
}

.akwad-report .akwad-row-closing td {
	font-weight: 700;
	border-top: 2px solid var(--akwad-accent);
	border-bottom: 3px double var(--akwad-accent);
}

.akwad-report .akwad-indent-1 { padding-left: 18px !important; }
.akwad-report .akwad-indent-2 { padding-left: 36px !important; }
.akwad-report .akwad-indent-3 { padding-left: 54px !important; }
.akwad-report .akwad-indent-4 { padding-left: 72px !important; }

.akwad-report .text-left { text-align: left; }
.akwad-report .text-right { text-align: right; font-variant-numeric: tabular-nums; }
.akwad-report .text-center { text-align: center; }
.akwad-report .text-muted { color: #7c7c7c; font-size: 10px; }

.akwad-report .akwad-report-footer {
	margin-top: 10px;
	font-size: 10px;
	color: #7c7c7c;
	text-align: right;
}

.akwad-report .akwad-letterhead-footer {
	margin-top: 16px;
	padding-top: 8px;
	border-top: 1px solid #ededed;
	font-size: 11px;
	color: #171717;
}

@media print {
	.akwad-report table.akwad-report-table thead { display: table-header-group; }
	.akwad-report tr { page-break-inside: avoid; }
}
`;

	ns.get_style_tag = function () {
		return "<style>" + ns.CSS + "</style>";
	};

	// Drops a leading label prefix from a filter's raw option value
	ns.strip_prefix = function (value, prefix) {
		if (!value) return value;
		var re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i");
		return value.replace(re, "");
	};

	// MultiSelectList filters return [] rather than "" when unset, and []
	// is truthy, so plain `m.value` checks let empty filters through.
	function has_value(value) {
		return Array.isArray(value) ? value.length > 0 : !!value;
	}

	function format_value(value) {
		return Array.isArray(value) ? value.join(", ") : String(value);
	}

	ns.build_header = function (opts) {
		opts = opts || {};
		var meta = (opts.meta || []).filter(function (m) {
			return m && has_value(m.value);
		});

		var meta_html = meta
			.map(function (m) {
				return (
					'<div class="filter-row"><strong>' +
					frappe.utils.escape_html(m.label) +
					"</strong><span>" +
					frappe.utils.escape_html(format_value(m.value)) +
					"</span></div>"
				);
			})
			.join("");

		var company_html = opts.company
			? '<div class="filter-row"><strong>' +
			  __("Company") +
			  ":</strong> " +
			  frappe.utils.escape_html(opts.company) +
			  "</div>"
			: "";

		var period_html = opts.period
			? '<div class="filter-row"><strong>' +
			  __("Period") +
			  ":</strong> " +
			  frappe.utils.escape_html(opts.period) +
			  "</div>"
			: "";

		var html = "";
		html += '<div class="akwad-report-title"><h2>' + frappe.utils.escape_html(opts.title || "") + "</h2></div>";
		html +=
			'<div class="akwad-report-header"><div class="col">' +
			company_html +
			'</div><div class="col" style="text-align: right;">' +
			period_html +
			"</div></div>";

		if (meta_html) {
			html += '<div class="akwad-report-filters">' + meta_html + "</div>";
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
