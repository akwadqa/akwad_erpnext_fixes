import frappe
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
	from frappe.model.document import Document
	from frappe.printing.doctype.print_format.print_format import PrintFormat
	
from frappe.www.printview import get_font
import re

def custom_get_print_style(
	style: str | None = None, print_format: Optional["PrintFormat"] = None, for_legacy: bool = False
):
	print_settings = frappe.get_doc("Print Settings")

	if not style:
		style = print_settings.print_style or ""

	context = {
		"print_settings": print_settings,
		"print_style": style,
		"font": get_font(print_settings, print_format, for_legacy),
	}

	css = frappe.get_template("templates/styles/custom_standard.css").render(context)

	if style and frappe.db.exists("Print Style", style):
		css = css + "\n" + frappe.db.get_value("Print Style", style, "css")

	# move @import to top
	for at_import in list(set(re.findall(r"(@import url\([^\)]+\)[;]?)", css))):
		css = css.replace(at_import, "")

		# prepend css with at_import
		css = at_import + css

	if print_format and print_format.css:
		css += "\n\n" + print_format.css

	return css