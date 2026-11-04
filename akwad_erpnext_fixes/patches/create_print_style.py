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

			/* Report theme. Literal colors only: wkhtmltopdf (PDF) ignores var(). */
			.akwad-report {
				font-family: "Rubik", "Inter", sans-serif;
				font-size: 12px;
				color: #171717;
			}

			.akwad-report .akwad-report-title h2 {
				letter-spacing: 0.5px;
			}

			.akwad-report strong {
				color: #7c7c7c;
				font-weight: 500;
			}

			.akwad-report .akwad-report-filters {
				background: #f8f8f8;
				border-left: 3px solid #00589c;
			}

			.akwad-report table.akwad-report-table thead th {
				background: #f0f0f0;
				border-top: 2px solid #00589c;
				border-bottom: 2px solid #00589c;
			}

			.akwad-report table.akwad-report-table tbody td {
				border-bottom: 1px solid #ededed;
			}

			.akwad-report table.akwad-report-table tbody tr:last-child td {
				border-bottom: none;
			}

			.akwad-report .akwad-row-group td {
				background: #fafafa;
			}

			.akwad-report .akwad-row-total td {
				border-top: 1px solid #171717;
			}

			.akwad-report .akwad-row-closing td {
				border-top: 2px solid #00589c;
				border-bottom: 3px double #00589c;
			}

			.akwad-report .text-muted,
			.akwad-report .akwad-report-footer {
				color: #7c7c7c;
			}

			.akwad-report .akwad-letterhead-footer {
				border-top: 1px solid #ededed;
				color: #171717;
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
