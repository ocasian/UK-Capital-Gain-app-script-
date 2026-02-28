/**
 * UK CGT Matcher: HMRC Compliant (Priority Sorting & Consolidated Rows)
 * @param {range} data 6-column range: Type, Date, Symbol, Qty, Price, Commission.
 * @customfunction
 */
function UK_CGT(data) {
  if (!data || data.length === 0 || data[0].length < 6) return "Invalid Range";

  const SCALE = 1000000; 
  let symbols = {};

  // 1. Organize Data
  data.filter(r => r[0] && r[1] instanceof Date).forEach(r => {
    let type = r[0].toString().toLowerCase().trim();
    let date = new Date(r[1]);
    let sym = r[2].toString().toUpperCase().trim();
    let qty = Math.round(Number(r[3]) * SCALE);
    let price = Number(r[4]);
    let comm = Math.round(Number(r[5] || 0) * SCALE);

    // Map types to priority (Split = 0, Buy = 1, Sell = 2) for same-day sorting
    let priority = (type === 'split' || type === 'r') ? 0 : (type === 'buy' || type === 'b') ? 1 : 2;

    if (!symbols[sym]) symbols[sym] = [];
    symbols[sym].push({ type, date, qty, price, comm, priority, matchedQty: 0, dayGain: 0, rulesUsed: [] });
  });

  let finalOutput = [["Date", "Symbol", "Action", "Qty Change", "Total Gain/Loss", "Rule Summary", "Pool Qty", "Pool Cost", "Pool Avg"]];

  for (let sym in symbols) {
    // SORTING: 1st by Date, 2nd by Priority (Splits first)
    let txs = symbols[sym].sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) return a.date - b.date;
      return a.priority - b.priority;
    });

    // --- STEP 1: SAME-DAY MATCHING ---
    txs.forEach((t) => {
      if (t.priority === 2) { // Sell
        txs.filter(match => match.date.getTime() === t.date.getTime() && match.priority === 1) // Buy
           .forEach(buy => {
             let canMatch = Math.min(t.qty - t.matchedQty, buy.qty - buy.matchedQty);
             if (canMatch > 0) {
               t.dayGain += (canMatch * t.price - (t.comm * (canMatch/t.qty))) - (canMatch * buy.price + (buy.comm * (canMatch/buy.qty)));
               t.matchedQty += canMatch;
               buy.matchedQty += canMatch;
               if (!t.rulesUsed.includes("Same-Day")) t.rulesUsed.push("Same-Day");
             }
           });
      }
    });

    // --- STEP 2: 30-DAY RULE ---
    txs.forEach((t, i) => {
      if (t.priority === 2 && t.matchedQty < t.qty) { // Sell
        let horizon = new Date(t.date);
        horizon.setDate(horizon.getDate() + 30);
        for (let j = i + 1; j < txs.length; j++) {
          let buy = txs[j];
          if (buy.date > horizon) break;
          if (buy.priority === 1 && buy.matchedQty < buy.qty) { // Buy
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

    // --- STEP 3: POOL PROCESSING ---
    let poolQty = 0;
    let poolCost = 0;

    txs.forEach(t => {
      let remaining = t.qty - t.matchedQty;
      let actionLabel = "";
      let qtyChange = 0;

      if (t.priority === 0) { // SPLIT
        let oldQty = poolQty;
        poolQty = Math.round(poolQty * (t.qty / SCALE)); 
        qtyChange = (poolQty - oldQty) / SCALE; // Show the delta (new shares created)
        actionLabel = "SPLIT (" + (t.qty/SCALE) + ":1)";
      } 
      else if (t.priority === 1) { // BUY
        if (remaining > 0) {
          poolQty += remaining;
          poolCost += (remaining * t.price) + (t.comm * (remaining/t.qty));
        }
        actionLabel = "BUY";
        qtyChange = t.qty / SCALE;
      } 
      else if (t.priority === 2) { // SELL
        if (remaining > 0) {
          let avgCost = poolQty > 0 ? (poolCost / poolQty) : 0;
          let costBasis = remaining * avgCost;
          let proceeds = (remaining * t.price) - (t.comm * (remaining/t.qty));
          t.dayGain += (proceeds - costBasis);
          poolQty -= remaining;
          poolCost -= costBasis;
          if (!t.rulesUsed.includes("Pool")) t.rulesUsed.push("Pool");
        }
        actionLabel = "SELL";
        qtyChange = -t.qty / SCALE;
      }

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
  return finalOutput;
}
