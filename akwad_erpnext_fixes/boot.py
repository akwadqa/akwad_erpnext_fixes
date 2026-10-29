# Copyright (c) 2026, Akwad Programming and contributors
# For license information, please see license.txt

from akwad_erpnext_fixes.akwad_erpnext_fixes.doctype.report_print_template.report_print_template import (
	EXCLUDED_COLUMNS_BY_REPORT,
)


def boot_session(bootinfo):
	# Static registry, no DB access. A report's presence enables the print
	# dialog's column-template picker; its list filters the pickable columns.
	bootinfo.akwad_report_print_columns = EXCLUDED_COLUMNS_BY_REPORT
