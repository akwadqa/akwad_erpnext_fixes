import frappe

PRINT_STYLE_NAME = "Akwad Print Style"
DEFAULT_ACCENT = "#00589c"


def execute():
	try:
		css_content = """ @import url("https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,300..900;1,300..900&display=swap");

			:root {
				--akwad-accent: #00589c;
			}

			.pf-font {
				font-family: "Rubik", sans-serif;
			}

			.pf-heading {
				margin: 10px 0;
				width: 100%;
				text-align: right;
				text-transform: uppercase;
				font-size: 40px;
				font-weight: normal;
			}

			.pf-color {
				color: var(--akwad-accent);
			}

			.print-format td, .print-format th {
				padding: 2px 4px !important;
			}

			.pf-item-table {
				width: 100%;
				margin: 20px 0;
			}

			.pf-item-table td {
				border: 1px dashed black;
				vertical-align: middle !important;
			}

			.pf-item-table th {
				font-weight: normal;
				color: white;
				background-color: var(--akwad-accent);
				text-align: center;
			}

			.pf-terms {
				margin-top: 100px;
			}

			/* Report theme ("Classic Masar Mix", spec Phase 9). Literal colors
			   only: wkhtmltopdf (PDF) ignores var(). Rubik is not installed on the
			   PDF server, so PDFs fall back to the next family. */
			.akwad-report {
				font-family: "Rubik", "Helvetica Neue", Arial, sans-serif;
				font-size: 12px;
				line-height: 1.45;
				color: #202020;
			}

			.akwad-report .akwad-report-title {
				border-top: 1px solid #00589c;
				border-bottom: 1px solid #00589c;
			}

			.akwad-report .akwad-report-title h2 {
				color: #00589c;
			}

			.akwad-report .akwad-report-period,
			.akwad-report .akwad-report-filters strong,
			.akwad-report .akwad-cell-date,
			.akwad-report .akwad-row-opening td,
			.akwad-report .text-muted,
			.akwad-report .akwad-report-footer,
			.akwad-report .akwad-letterhead-footer {
				color: #646464;
			}

			.akwad-report .akwad-report-filters {
				background: #f8f9fa;
				border: 1px solid #e8e8e8;
				border-radius: 8px;
			}

			.akwad-report .akwad-report-filters .filter-row + .filter-row:before {
				color: #a3a3a3;
			}

			.akwad-report .akwad-pill {
				background: #ffffff;
				border: 1px solid #e8e8e8;
				border-radius: 4px;
				color: #646464;
			}

			.akwad-report .akwad-pill-on {
				background: #eef8ff;
				border-color: #bce2ff;
				color: #00589c;
			}

			.akwad-report table.akwad-report-table thead th {
				color: #00589c;
				border-top: 1px solid #00589c;
				border-bottom: 1px solid #00589c;
			}

			.akwad-report table.akwad-report-table tbody td {
				border-bottom: 1px solid #e8e8e8;
			}

			.akwad-report .akwad-row-spacer td {
				border-bottom: none;
			}

			.akwad-report .akwad-row-group td {
				background: #f8f9fa;
			}

			.akwad-report .akwad-row-total td {
				border-top: 1px solid #202020;
			}

			.akwad-report .akwad-row-closing td {
				border-top: 1px solid #00589c;
				border-bottom: 3px double #00589c;
			}

			.akwad-report .akwad-row-closing td:last-child {
				color: #00589c;
			}

			.akwad-report .akwad-letterhead-footer {
				border-top: 1px solid #e8e8e8;
			}
		"""

		if frappe.db.exists("Print Style", PRINT_STYLE_NAME):
			doc = frappe.get_doc("Print Style", PRINT_STYLE_NAME)
			doc.css = css_content
			doc.save(ignore_permissions=True)
		else:
			frappe.get_doc(
				{
					"doctype": "Print Style",
					"print_style_name": PRINT_STYLE_NAME,
					"disabled": 0,
					"standard": 0,
					"css": css_content,
				}
			).insert(ignore_permissions=True)

		frappe.db.commit()

	except Exception:
		frappe.log_error("Patch Error: Create/Update Akwad Print Style", frappe.get_traceback())
		raise
