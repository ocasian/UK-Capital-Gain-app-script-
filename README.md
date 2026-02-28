# UK CGT Matcher: HMRC Compliant Spreadsheet Tool

A high-precision Google Apps Script (GAS) designed to calculate Capital Gains Tax (CGT) for UK taxpayers. This tool automates the "Share Matching" priority rules defined by HMRC (Bona Fide Section 104 holdings).

## 🚀 Features

* **HMRC Priority Compliance**: Automatically applies matching in the legal order:
    1.  **Same-Day Rule**: Matches sells against buys made on the same day.
    2.  **30-Day Rule (Bed & Breakfasting)**: Matches sells against subsequent acquisitions within 30 days.
    3.  **Section 104 Pool**: Matches remaining shares against the running average cost of the main holding.
* **Stock Split Support**: Handles corporate actions by adjusting pool quantity without affecting cost basis.
* **Audit Trail**: Generates a row-by-row breakdown showing exactly which rule (Same-Day, 30-Day, or Pool) was used for every disposal.
* **Precision Scaling**: Uses integer-based scaling ($1,000,000$) to prevent JavaScript floating-point errors.

---

## 🛠 Installation

1.  Open your Google Sheet.
2.  Navigate to **Extensions** > **Apps Script**.
3.  Paste the code from `UK_CGT.gs` into the editor.
4.  Hit **Save**.
5.  In your sheet, use the formula: `=UK_CGT(A2:F100)` (adjusting for your data range).

---

## 📊 Usage & Examples

The function expects a **6-column range**: `Type, Date, Symbol, Qty, Price, Commission`.

### Example 1: The 30-Day Rule (Bed & Breakfasting)
If you sell 100 shares at a loss and buy them back 15 days later, the script correctly matches the sell against the *future* buy.

| Type | Date | Symbol | Qty | Price | Commission |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Buy | 01/01/2023 | VUSA | 100 | 60.00 | 5.00 |
| Sell | 02/01/2023 | VUSA | 50 | 55.00 | 5.00 |
| Buy | 02/15/2023 | VUSA | 50 | 58.00 | 5.00 |

### Example 2: Handling ERI (Excess Reportable Income)
For offshore funds (ETFs), you must manually increase your cost basis by the ERI amount. You can do this by adding a "Buy" row with **0 Quantity** and the **Total ERI amount** as the Commission/Cost.

| Type | Date | Symbol | Qty | Price | Commission | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Buy | 06/01/2023 | VUSA | 0 | 0 | 12.50 | *Adds £12.50 to Pool Cost* |

---

## 🛠️ Roadmap & Current Limitations

While this script handles core HMRC rules, the following scenarios require manual adjustment:

* **Excess Reportable Income (ERI)**: As shown above, users must manually inject cost-basis adjustments for offshore reporting funds.
* **Equalisation Payments**: Initial distributions that are a return of capital should be manually deducted from the pool cost.
* **Offshore Non-Reporting Funds**: These are taxed as **Income**, not CGT. This script assumes all tickers are subject to CGT rules.
* **Section 104 Indexation Allowance**: This script does not calculate legacy indexation for holdings acquired prior to December 2017.
* **Complex Demergers**: Rights issues or complex corporate restructures may require manual calculation of the split ratio.

---

## 📝 Technical Notes

* **Sorting**: The script automatically sorts by Date, then Priority (**Splits > Buys > Sells**). This ensures same-day "Bed & Breakfast" rules are handled even if your spreadsheet rows are out of order.
* **Fees**: Commissions are added to "Buy" costs and deducted from "Sell" proceeds per HMRC guidance.

---

## ⚖️ Disclaimer

*This tool is for informational purposes only and does not constitute professional tax advice. Always cross-reference calculations with a qualified tax professional or official HMRC guidance.*
