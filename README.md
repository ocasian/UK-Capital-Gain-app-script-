# UK CGT Matcher: HMRC Compliant Spreadsheet Tool

A high-precision Google Apps Script (GAS) designed to calculate Capital Gains Tax (CGT) for UK taxpayers. This tool automates the "Share Matching" priority rules defined by HMRC (Section 104 holdings).

## 🚀 Features

* **HMRC Priority Compliance**: Automatically applies matching in the legal order:
    1.  **Same-Day Rule**: Matches sells against buys made on the same day.
    2.  **30-Day Rule (Bed & Breakfasting)**: Matches sells against subsequent acquisitions within 30 days.
    3.  **Section 104 Pool**: Matches remaining shares against the running average cost of the main holding.
* **Stock Split Support**: Handles corporate actions (splits/consolidations) by adjusting the pool quantity without changing the total cost basis.
* **Audit Trail**: Generates a row-by-row breakdown showing exactly which rule was used for every disposal.
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

### Example 2: Stock Split (e.g., 2-for-1)
To handle a split, use the type `Split`. The `Qty` should be the **new total multiplier** (e.g., `2` for a 2-for-1 split). The script will adjust your pool quantity while keeping the cost the same.

| Type | Date | Symbol | Qty | Price | Commission | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Buy | 01/01/2023 | TSLA | 10 | 200.00 | 0 | *10 shares @ £2000 total* |
| Split | 06/01/2023 | TSLA | 2 | 0 | 0 | *Pool becomes 20 shares @ £2000 total* |

### Example 3: Handling ERI (Excess Reportable Income)
For offshore funds, add a "Buy" row with **0 Quantity** and the **Total ERI amount** as the Commission.

| Type | Date | Symbol | Qty | Price | Commission | Note |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Buy | 06/30/2023 | VUSA | 0 | 0 | 15.20 | *Adds £15.20 to Pool Cost* |

---

## 🛠️ Roadmap & Current Limitations

* **Excess Reportable Income (ERI)**: Users must manually inject cost-basis adjustments (as shown above).
* **Equalisation Payments**: Initial fund distributions (return of capital) must be manually deducted from the pool cost.
* **Offshore Non-Reporting Funds**: Taxed as **Income**, not CGT. This script assumes all tickers are CGT-applicable.
* **Section 104 Indexation Allowance**: Not included; designed for modern "frozen" pool calculations (post-2017).

---

## 📝 Technical Notes

* **Priority Sorting**: The script automatically sorts rows by Date, then by type priority (**Splits > Buys > Sells**).
* **Fees**: Commissions are added to "Buy" costs and deducted from "Sell" proceeds.

---

## ⚖️ Disclaimer

*This tool is for informational purposes only and does not constitute professional tax advice. Always cross-reference calculations with a qualified tax professional or official HMRC guidance.*
