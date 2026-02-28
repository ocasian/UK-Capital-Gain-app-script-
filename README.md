# UK CGT Matcher: HMRC Compliant Spreadsheet Tool

A lightweight, high-precision Google Apps Script (GAS) designed to calculate Capital Gains Tax (CGT) for UK taxpayers. This tool automates the complex matching priority rules defined by HMRC for shares and securities.

## Features

* **HMRC Priority Compliance**: Automatically applies matching in the legal order:
    1.  **Same-Day Rule**: Matches sells against buys made on the same day.
    2.  **30-Day Rule (Bed & Breakfasting)**: Matches sells against subsequent acquisitions within 30 days.
    3.  **Section 104 Pool**: Matches remaining shares against the running average cost of the main holding.
* **Stock Split Support**: Handles corporate actions (splits/consolidations) by adjusting the pool quantity without affecting the cost basis.
* **Consolidated Reporting**: Generates a row-by-row audit trail showing which rule was applied to every disposal.
* **Precision Scaling**: Uses integer-based scaling to prevent JavaScript floating-point errors.

---

## 🛠 Installation

1. Open your Google Sheet.
2. Navigate to **Extensions** > **Apps Script**.
3. Paste the code from `UK_CGT.gs`.
4. Hit **Save**. The function `=UK_CGT(data_range)` is now available.

---

## 📊 Usage

The function expects a **6-column range**: `Type, Date, Symbol, Qty, Price, Commission`.

### Example 1: The 30-Day Rule
If you sell 100 shares of "AAPL" at a loss and buy them back 15 days later, the script matches the sell against the future buy, not the old pool.

| Type | Date | Symbol | Qty | Price | Commission |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Buy | 01/01/2023 | AAPL | 100 | 150 | 5 |
| Sell | 02/01/2023 | AAPL | 50 | 140 | 5 |
| Buy | 02/15/2023 | AAPL | 50 | 145 | 5 |

### Example 2: Stock Splits
To handle a 2-for-1 split, use the type `Split` and enter the ratio (e.g., `2`) in the Qty column.

---

## 📝 Technical Notes

* **Sorting**: Automatically handles chronological order and priority (Splits > Buys > Sells).
* **Fees**: Commissions are correctly added to buy costs and deducted from sell proceeds.
* **Scale**: Uses a $1,000,000$ multiplier to maintain decimal precision.

---

## ⚖️ Disclaimer
*This tool is for informational purposes only. Always cross-reference with a qualified tax professional or HMRC guidance.*
