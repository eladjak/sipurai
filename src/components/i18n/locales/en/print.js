export default {
  "print": {
    "checkoutPage": {
  "pageTitle": "Order a printed book",
  "backBook": "Back to book",
  "loading": "Loading",
  "loadError": "Could not load your order",
  "retry": "Try again",
  "generic": "Something went wrong. Please try again.",
  "network": "There is no internet connection. Check your connection and try again.",
  "unavailable": "Printed book orders are not available yet",
  "unavailableHint": "We are getting things ready. Your digital book still works as usual.",
  "step1": "How many copies, and how would you like to receive them?",
  "step2": "Where should we deliver?",
  "step3": "Review before payment",
  "howMany": "How many copies would you like to print?",
  "estimated": "Estimated order price:",
  "final": "Final.",
  "priceLater": "The price will be shown at review.",
  "calculating": "Calculating price…",
  "fullDetails": "You will see the full details before paying.",
  "addressHint": "Enter the delivery address. Your details are saved on this device, so you can come back without starting over.",
  "pickupHint1": "Pickup requires no address and has no delivery charge.",
  "pickupHint2": "After payment, you can see when the book is ready on My orders.",
  "quoteError": "Could not calculate the price",
  "priceDetails": "Price details",
  "oneBook": "One copy of the book",
  "manyBooks": "{qty} copies of the book",
  "apartment": "apartment {apartment}",
  "edit": "Edit",
  "createError": "Could not take you to payment",
  "safeError": "Something went wrong. Please try again.",
  "changeHint": "You can change the address or quantity and return to any step.",
  "backStep": "Back to previous step",
  "back": "Back",
  "continue": "Continue",
  "redirecting": "Taking you to payment…",
  "pay": "Continue to payment",
  "waitingPrice": "Calculating the price, just a moment…",
  "noPrice": "A price is not available yet. Select “Try again” above.",
  "orderBook": "Order a printed book"
},
    "checkoutCopy": {
  "stepCopies": "Copies and delivery",
  "stepAddress": "Address",
  "stepPayment": "Review and payment",
  "item": "Order item",
  "stepsLabel": "Order steps",
  "stepProgress": "Step {current} of {total}",
  "steps": [
    "Copies and delivery",
    "Address",
    "Review and payment"
  ],
  "completed": "Completed",
  "current": "Current step",
  "deliveryTitle": "How would you like to receive the book?",
  "delivery": "Home delivery",
  "deliveryHint": "The book will be delivered to the address you enter in the next step.",
  "pickup": "Pickup",
  "pickupHint": "No delivery charge. You can see here when the book is ready for pickup.",
  "calculating": "Calculating the price",
  "free": "Free",
  "total": "Total to pay",
  "finalPrice": "Final price, no extras",
  "printNote": "Printing starts after payment is confirmed.",
  "paymentNote": "Payment takes place on a secure page, then you will return here.",
  "book": "Printed book",
  "bookMany": "Printed book × {qty}",
  "returnFailed": "Payment received; your book needs our attention",
  "returnFailedHint": "There was a problem sending the book to print. Your order is saved and we are taking care of it.",
  "cancelled": "Order cancelled",
  "cancelledHint": "If this was unexpected, you can order again from the book page.",
  "success": "Payment received, thank you!",
  "sent": "Your book has been sent to print. You can track your order below.",
  "sending": "We are sending your book to print. This takes a few moments; you can close this page.",
  "checking": "Checking your payment…",
  "slow": "Confirmation is taking longer than usual. There is no need to pay again. You can close this page; the status below will update.",
  "connection": "There is a temporary connection problem. We are still trying.",
  "waiting": "This usually takes a few seconds. There is no need to refresh."
},
    "quantity": {
      "label": "Number of copies",
      "remove": "Remove a copy",
      "add": "Add a copy",
      "maximum": "The maximum per order is {max} copies. To order more, place another order.",
      "one": "One copy. You can add more copies, for example for grandparents.",
      "many": "{value} copies. You can order up to {max} at a time."
},
    "address": {
      "optional": "Optional",
      "name": "Recipient’s full name",
      "nameHint": "For example: Dana Levy",
      "nameExample": "Dana Levy",
      "phone": "Mobile phone",
      "phoneHint": "The courier will call before arriving. For example: 050-1234567",
      "city": "City",
      "cityHint": "Start typing and choose from the list, or enter another town.",
      "cityExample": "Haifa",
      "street": "Street",
      "streetHint": "For example: HaNarkisim",
      "streetExample": "HaNarkisim",
      "house": "House number",
      "houseHint": "For example: 12",
      "apartment": "Apartment",
      "apartmentHint": "For example: 4",
      "zip": "Postal code",
      "zipHint": "7 digits, for example: 1234567",
      "notes": "Notes for the courier",
      "notesHint": "For example: floor 2, ring twice",
      "notesExample": "Floor 2, ring twice"
    },
    "validation": {
      "name": "Enter a first and last name, for example Dana Levy.",
      "phoneRequired": "Enter a mobile phone number so the courier can call, for example 050-1234567.",
      "phoneInvalid": "Enter an Israeli mobile phone number, for example 050-1234567.",
      "city": "Choose a city from the list or enter one, for example Haifa.",
      "street": "Enter a street name, for example HaNarkisim.",
      "houseRequired": "Enter a house number, for example 12.",
      "houseInvalid": "Enter a house number, for example 12 or 12A.",
      "zip": "The postal code has 7 digits, for example 1234567. You can also leave it blank."
    },
    "orderStatuses": {
  "awaiting_payment": {
    "label": "Awaiting payment",
    "hint": "Your order is saved. Printing starts after payment is confirmed."
  },
  "paid": {
    "label": "Paid, preparing to print",
    "hint": "Payment received. We are preparing your book for printing."
  },
  "submitting": {
    "label": "Sending to print",
    "hint": "Your book is on its way to the printer."
  },
  "submitted": {
    "label": "Sent to print",
    "hint": "The printer has received your book."
  },
  "in_production": {
    "label": "Printing",
    "hint": "Your book is being printed and prepared."
  },
  "shipped": {
    "label": "Shipped",
    "hint": "Your book is on its way."
  },
  "ready_for_pickup": {
    "label": "Ready for pickup",
    "hint": "Your book is ready for pickup."
  },
  "cancelled": {
    "label": "Cancelled",
    "hint": "Your order was cancelled."
  },
  "failed_needs_attention": {
    "label": "Needs our attention",
    "hint": "There was a problem sending your book to print. Your order is saved and we are taking care of it."
  },
  "unknown": {
    "label": "Being handled"
  }
},
    "orderDetails": {
  "myBook": "My book",
  "untitled": "Untitled book",
  "copies": "Copies",
  "total": "Total",
  "method": "Delivery method",
  "pickup": "Pickup",
  "delivery": "Sipurai delivery",
  "ordered": "Ordered on",
  "tracking": "Track delivery",
  "orderedPaid": "Ordered / paid",
  "unpaid": "Not yet paid",
  "apartment": "apartment {apartment}"
},
    "adminOrders": {
  "title": "Print orders administration",
  "subtitle": "All printed book orders and the actions available for each one.",
  "back": "Back",
  "forbidden": "This account does not have administrator access",
  "forbiddenHint": "This page is for the system administrator. If you need access, sign in with the administrator account.",
  "alertOne": "Needs attention: one paid order has not been sent to print",
  "alertMany": "Need attention: {count} paid orders have not been sent to print",
  "alertFallback": "A paid order has not been sent to print",
  "filter": "Filter by status",
  "all": "All orders",
  "refresh": "Refresh",
  "loading": "Loading orders",
  "error": "Could not load orders",
  "empty": "No orders with this status",
  "emptyHint": "Try selecting “All orders” in the filter.",
  "retry_submit": "Retry sending to print",
  "mark_ready_for_pickup": "Mark ready for pickup",
  "mark_shipped": "Mark shipped",
  "cancel": "Cancel order",
  "success": "Action completed.",
  "actionError": "The action failed. Please try again.",
  "lastError": "Last system message: ",
  "note": "Action note",
  "noteHint": "(optional, saved in history)",
  "notePlaceholder": "For example: called the customer and confirmed the address",
  "working": "Working…",
  "cancelLabel": "Confirm order cancellation",
  "cancelQuestion": "Cancel this order?",
  "cancelHint": "If already paid, the refund must be handled separately and is not made here.",
  "cancelYes": "Yes, cancel",
  "cancelNo": "No, keep it"
},
    "orders": {
      "title": "My orders",
      "subtitle": "Your printed books and their current status.",
      "back": "Back to library",
      "loading": "Loading orders",
      "error": "Could not load your orders",
      "retry": "Something went wrong. Please try again shortly.",
      "empty": "You haven’t ordered a printed book yet",
      "emptyHint": "Open a book you created and select “Order a printed book” to receive a real book to leaf through.",
      "library": "My books",
      "refresh": "Refresh status"
    }
  }
};
