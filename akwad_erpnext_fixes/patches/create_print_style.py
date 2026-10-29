import frappe

PRINT_STYLE_NAME = "Akwad Print Style"


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

			.akwad-report {
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

			@media print {
				.akwad-report table.akwad-report-table thead { display: table-header-group; }
				.akwad-report tr { page-break-inside: avoid; }
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
