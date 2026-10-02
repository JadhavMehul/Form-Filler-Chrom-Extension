/*
 * ============================================================
 *  YOUR FORM DATA — edit this file
 * ============================================================
 *
 *  Each entry becomes one button in the popup.
 *
 *  name   : text shown on the button
 *  fields : "Label on the web page" : "value to fill"
 *
 *  How labels are matched:
 *   - Case, extra spaces, "*" and ":" are ignored,
 *     so "Full Name" matches "Full name *" or "FULL NAME:".
 *   - Exact matches win; otherwise a label that contains your
 *     text (or vice versa) is used.
 *
 *  Value types:
 *   - Text / email / number / textarea : "any text"
 *   - Date field   : "2026-10-01"   (YYYY-MM-DD)
 *   - Dropdown     : the option text or value, e.g. "India"
 *   - Radio group  : the label of the option to pick, e.g. "Male"
 *   - Checkbox     : true (tick) or false (untick)
 *   - Several checkboxes under one question:
 *                    ["Option A", "Option C"]
 *
 *  After editing, open chrome://extensions and click the
 *  reload icon on Form Filler.
 * ============================================================
 */

const FORMS = [
  {
    name: "Form 1 data",
    fields: {
      "Full Name": "Rahul Sharma",
      "Email": "rahul.sharma@example.com",
      "Phone": "9876543210",
      "Date of Birth": "1995-08-15",
      "Gender": "Male",
      "City": "Mumbai",
      "Country": "India",
      "Address": "12, Marine Drive, Mumbai 400020",
      "I agree to the terms": true
    }
  },
  {
    name: "Form 2 data",
    fields: {
      "Company Name": "Sharma Traders Pvt Ltd",
      "GST Number": "27ABCDE1234F1Z5",
      "Contact Person": "Rahul Sharma",
      "Email": "accounts@sharmatraders.example",
      "Phone": "02212345678"
    }
  },
  {
    name: "Form 3 data",
    fields: {
      "First Name": "Rahul",
      "Last Name": "Sharma",
      "Username": "rahul_s",
      "Interests": ["Sports", "Music"]
    }
  },
  {
    name: "Form 4 data",
    fields: {
      "Name": "Rahul Sharma",
      "Message": "Hello, I would like more information."
    }
  },
  {
    name: "Form 5 data",
    fields: {
      "Name": "Rahul Sharma",
      "PAN": "ABCDE1234F",
      "Annual Income": "1200000"
    }
  }
];
