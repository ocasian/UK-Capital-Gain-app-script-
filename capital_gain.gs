/**
 * UK CGT Matcher: HMRC Compliant
 * This function calculates gains/losses based on UK tax rules:
 * 1. Same-Day Rule
 * 2. 30-Day Rule (Bed & Breakfasting)
 * 3. Section 104 Pool (Average Cost)
 * * @param {range} data 6-column range: Type, Date, Symbol, Qty, Price, Commission.
 * @customfunction
 */
function UK_CGT(data) {
  // Check if the user actually highlighted a valid table of data
  if (!data || data.length === 0 || data[0].length < 6) return "Invalid Range";

  // We multiply numbers by SCALE to avoid "Floating Point Errors" (where computers 
  // sometimes think 0.1 + 0.2 = 0.300000000004). This keeps the math precise.
  const SCALE = 1000000; 
  let symbols = {};

  // --- STEP 1: CLEAN AND ORGANIZE DATA ---
  // We loop through every row in your spreadsheet and turn it into a format the script understands.
  data.filter(r => r[0] && r[1] instanceof Date).forEach(r => {
    let type = r[0].toString().toLowerCase().trim();
    let date = new Date(r[1]);
    let sym = r[2].toString().toUpperCase().trim();
    let qty = Math.round(Number(r[3]) * SCALE);
    let price = Number(r[4]);
    let comm = Math.round(Number(r[5] || 0) * SCALE);

    // PRIORITY: HMRC rules require certain things to happen first if they occur on the same day.
    // Splits (0) happen first, then Buys (1), then Sells (2).
    let priority = (type === 'split' || type === 'r') ? 0 : (type === 'buy' || type === 'b') ? 1 : 2;

    // Group transactions by ticker symbol (e.g., all "AAPL" rows go into one bucket)
    if (!symbols[sym]) symbols[sym] = [];
    symbols[sym].push({ type, date, qty, price, comm, priority, matchedQty: 0, dayGain: 0, rulesUsed: [] });
  });

  // Prepare the headers for the output table in your spreadsheet
  let finalOutput = [["Date", "Symbol", "Action", "Qty Change", "Total Gain/Loss", "Rule Summary", "Pool Qty", "Pool Cost", "Pool Avg"]];

  // --- STEP 2: CALCULATE FOR EACH STOCK SYMBOL ---
  for (let sym in symbols) {
    // Sort transactions by date. If dates are the same, use the Priority we set earlier.
    let txs = symbols[sym].sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) return a.date - b.date;
      return a.priority - b.priority;
    });

    // --- HMRC RULE 1: SAME-DAY MATCHING ---
    // If you buy and sell the same stock on the same day, they match together first.
    txs.forEach((t) => {
      if (t.priority === 2) { // If this is a SELL...
        txs.filter(match => match.date.getTime() === t.date.getTime() && match.priority === 1) // ...find BUYS on same day
           .forEach(buy => {
             let canMatch = Math.min(t.qty - t.matchedQty, buy.qty - buy.matchedQty);
             if (canMatch > 0) {
               // Calculate gain: (Sell Price - Sell Comm) - (Buy Price + Buy Comm)
               t.dayGain += (canMatch * t.price - (t.comm * (canMatch/t.qty))) - (canMatch * buy.price + (buy.comm * (canMatch/buy.qty)));
               t.matchedQty += canMatch; // Mark these shares as "used up"
               buy.matchedQty += canMatch;
               if (!t.rulesUsed.includes("Same-Day")) t.rulesUsed.push("Same-Day");
             }
           });
      }
    });

    // --- HMRC RULE 2: 30-DAY RULE (Bed & Breakfasting) ---
    // If you sell a stock and buy it back within 30 days, that buy matches the sell.
    txs.forEach((t, i) => {
      if (t.priority === 2 && t.matchedQty < t.qty) { // If SELL still has unmatched shares...
        let horizon = new Date(t.date);
        horizon.setDate(horizon.getDate() + 30); // Look forward 30 days
        for (let j = i + 1; j < txs.length; j++) {
          let buy = txs[j];
          if (buy.date > horizon) break; // Stop looking if we pass the 30-day window
          if (buy.priority === 1 && buy.matchedQty < buy.qty) {
            let canMatch = Math.min(t.qty - t.matchedQty, buy.qty - buy.matchedQty);
            if (canMatch > 0) {
               t.dayGain += (canMatch * t.price - (t.comm * (canMatch/t.qty))) - (canMatch * buy.price + (buy.comm * (canMatch/buy.qty)));
               t.matchedQty += canMatch;
               buy.matchedQty += canMatch;
               if (!t.rulesUsed.includes("30-Day")) t.rulesUsed.push("30-Day");
            }
          }
        }
      }
    });

    // --- HMRC RULE 3: SECTION 104 POOL (The "Everything Else" Bucket) ---
    // Any shares not matched by the first two rules are added to a "Pool" and averaged out.
    let poolQty = 0;
    let poolCost = 0;

    txs.forEach(t => {
      let remaining = t.qty - t.matchedQty; // Only look at shares not matched by Same-Day or 30-Day
      let actionLabel = "";
      let qtyChange = 0;

      if (t.priority === 0) { // HANDLING STOCK SPLITS
        let oldQty = poolQty;
        poolQty = Math.round(poolQty * (t.qty / SCALE)); 
        qtyChange = (poolQty - oldQty) / SCALE;
        actionLabel = "SPLIT (" + (t.qty/SCALE) + ":1)";
      } 
      else if (t.priority === 1) { // HANDLING BUYS (Adding to the Pool)
        if (remaining > 0) {
          poolQty += remaining;
          poolCost += (remaining * t.price) + (t.comm * (remaining/t.qty));
        }
        actionLabel = "BUY";
        qtyChange = t.qty / SCALE;
      } 
      else if (t.priority === 2) { // HANDLING SELLS (Taking from the Pool)
        if (remaining > 0) {
          let avgCost = poolQty > 0 ? (poolCost / poolQty) : 0;
          let costBasis = remaining * avgCost;
          let proceeds = (remaining * t.price) - (t.comm * (remaining/t.qty));
          t.dayGain += (proceeds - costBasis); // Calculate profit/loss based on pool average
          poolQty -= remaining;
          poolCost -= costBasis;
          if (!t.rulesUsed.includes("Pool")) t.rulesUsed.push("Pool");
        }
        actionLabel = "SELL";
        qtyChange = -t.qty / SCALE;
      }

      // Add a new row to our final list for the spreadsheet to display
      finalOutput.push([
        t.date.toLocaleDateString(),
        sym,
        actionLabel,
        qtyChange,
        t.dayGain / SCALE,
        t.rulesUsed.length > 0 ? t.rulesUsed.join(" + ") : "To Pool",
        poolQty / SCALE,
        poolCost / SCALE,
        poolQty > 0 ? (poolCost / poolQty) : 0
      ]);
    });
  }
  return finalOutput; // Send all the data back to Google Sheets!
}
