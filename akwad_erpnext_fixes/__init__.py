__version__ = "0.0.1"

# import extended_erpnext_transactions.native_patches

from frappe.www import printview
from akwad_erpnext_fixes.native_overrides import custom_get_print_style

printview.get_print_style = custom_get_print_style