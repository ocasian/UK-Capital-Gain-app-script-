/**
 * UK CGT Matcher: HMRC Compliant (Consolidated Same-Day Rows)
 * This function calculates gains/losses based on UK tax rules:
 * 1. Same-Day Rule
 * 2. 30-Day Rule (Bed & Breakfasting)
 * 3. Section 104 Pool (Average Cost)
 * @param {range} data 6-column range: Type, Date, Symbol, Qty, Price, Commission.
 * @customfunction
 */
function UK_CGT(data) {
  if (!data || data.length === 0 || data[0].length < 6) return "Invalid Range";

  const SCALE = 100000000; 
  let rawSymbols = {};

  // --- STEP 1: PARSE RAW DATA ---
  data.filter(r => r[0] && r[1] instanceof Date).forEach(r => {
    let type = r[0].toString().toLowerCase().trim();
    // Normalize type labels
    if (type === 'r') type = 'split';
    if (type === 'b') type = 'buy';
    if (type === 's') type = 'sell';

    let dateStr = new Date(r[1]).toISOString().split('T')[0]; // YYYY-MM-DD for grouping
    let date = new Date(r[1]);
    let sym = r[2].toString().toUpperCase().trim();
    let qty = Number(r[3]);
    let price = Number(r[4]);
    let comm = Number(r[5] || 0);

    if (!rawSymbols[sym]) rawSymbols[sym] = [];
    rawSymbols[sym].push({ type, date, dateStr, qty, price, comm });
  });

  // Prepare headers for output
  let finalOutput = [["Date", "Symbol", "Action", "Qty Change", "Total Gain/Loss", "Rule Summary", "Pool Qty", "Pool Cost", "Pool Avg", "Calculation"]];

  // --- STEP 2: CONSOLIDATE SAME-DAY TRANSACTIONS BY TYPE ---
  for (let sym in rawSymbols) {
    let dateMap = {};

    // Group items by Date + Type to consolidate multiple rows on the same day
    rawSymbols[sym].forEach(t => {
      let key = t.dateStr + "_" + t.type;
      if (!dateMap[key]) {
        dateMap[key] = {
          type: t.type,
          date: t.date,
          dateStr: t.dateStr,
          totalQty: 0,
          totalCostOrProceeds: 0, // Used to compute weighted average price
          totalComm: 0
        };
      }
      dateMap[key].totalQty += t.qty;
      dateMap[key].totalCostOrProceeds += (t.qty * t.price);
      dateMap[key].totalComm += t.comm;
    });

    let txs = [];
    for (let key in dateMap) {
      let item = dateMap[key];
      let avgPrice = item.totalQty > 0 ? item.totalCostOrProceeds / item.totalQty : 0;
      let priority = (item.type === 'split') ? 0 : (item.type === 'buy') ? 1 : 2;

      txs.push({
        type: item.type,
        date: item.date,
        qty: Math.round(item.totalQty * SCALE),
        price: avgPrice,
        comm: Math.round(item.totalComm * SCALE),
        priority: priority,
        matchedQty: 0,
        dayGain: 0,
        rulesUsed: [],
        calString: ""
      });
    }

    // Sort transactions chronologically, then by priority (Split -> Buy -> Sell)
    txs.sort((a, b) => {
      if (a.date.getTime() !== b.date.getTime()) return a.date - b.date;
      return a.priority - b.priority;
    });

    // --- HMRC RULE 1: SAME-DAY MATCHING ---
    txs.forEach((t) => {
      if (t.priority === 2) { // SELL
        txs.filter(match => match.date.getTime() === t.date.getTime() && match.priority === 1)
           .forEach(buy => {
             let canMatch = Math.min(t.qty - t.matchedQty, buy.qty - buy.matchedQty);
             if (canMatch > 0) {
               t.dayGain += (canMatch * t.price - (t.comm * (canMatch/t.qty))) - (canMatch * buy.price + (buy.comm * (canMatch/buy.qty)));
               
               t.calString += "| Sold at " + t.price + " matched to " + canMatch/SCALE + " on " + buy.date.toLocaleDateString() + " | Gain=" + canMatch/SCALE + "*" + Math.round(t.price*SCALE)/SCALE + (t.comm == 0 ? "" : "-" + t.comm/SCALE + "*" + canMatch/SCALE + "/" + t.qty/SCALE) + "-" + "(" + canMatch/SCALE + "*" + Math.round(buy.price*SCALE)/SCALE + (buy.comm == 0 ? "" + ")" : "+" + buy.comm/SCALE + "*" + canMatch/SCALE + "/" + buy.qty/SCALE + ")");

               t.matchedQty += canMatch;
               buy.matchedQty += canMatch;
               if (!t.rulesUsed.includes("Same-Day")) t.rulesUsed.push("Same-Day");
             }
           });
      }
    });

    // --- HMRC RULE 2: 30-DAY RULE (Bed & Breakfasting) ---
    txs.forEach((t, i) => {
      if (t.priority === 2 && t.matchedQty < t.qty) {
        let horizon = new Date(t.date);
        horizon.setDate(horizon.getDate() + 30);
        for (let j = i + 1; j < txs.length; j++) {
          let buy = txs[j];
          if (buy.date > horizon) break;
          if (buy.priority === 1 && buy.matchedQty < buy.qty) {
            let canMatch = Math.min(t.qty - t.matchedQty, buy.qty - buy.matchedQty);
            if (canMatch > 0) {
               t.dayGain += (canMatch * t.price - (t.comm * (canMatch/t.qty))) - (canMatch * buy.price + (buy.comm * (canMatch/buy.qty)));
               
               if(t.calString != "")
                t.calString += "\n";
               t.calString += "| Sold at " + t.price + " matched to " + canMatch/SCALE + " on " + buy.date.toLocaleDateString() + " | Gain=" + canMatch/SCALE + "*" + Math.round(t.price*SCALE)/SCALE + (t.comm == 0 ? "" : "-" + t.comm/SCALE + "*" + canMatch/SCALE + "/" + t.qty/SCALE) + "-" + "(" + canMatch/SCALE + "*" + Math.round(buy.price*SCALE)/SCALE + (buy.comm == 0 ? "" + ")" : "+" + buy.comm/SCALE + "*" + canMatch/SCALE + "/" + buy.qty/SCALE + ")");

               t.matchedQty += canMatch;
               buy.matchedQty += canMatch;
               if (!t.rulesUsed.includes("30-Day")) t.rulesUsed.push("30-Day");
            }
          }
        }
      }
    });

    // --- HMRC RULE 3: SECTION 104 POOL ---
    let poolQty = 0;
    let poolCost = 0;

    txs.forEach(t => {
      let remaining = t.qty - t.matchedQty;
      let actionLabel = "";
      let qtyChange = 0;

      if (t.priority === 0) { // SPLIT
        let oldQty = poolQty;
        poolQty = Math.round(poolQty * (t.qty / SCALE)); 
        qtyChange = (poolQty - oldQty) / SCALE;
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

          if(t.calString != "")
            t.calString += "\n";
          t.calString += "| Sold at " + t.price + " matched to " + remaining/SCALE + " on pool" + " | Gain=" + remaining/SCALE + "*" + Math.round(t.price*SCALE)/SCALE + (t.comm == 0 ? "" : "- (" + t.comm/SCALE + "*" + remaining/SCALE + "/" + t.qty/SCALE + ")") + "-" + "(" + remaining/SCALE + "*" + Math.round(avgCost*SCALE)/SCALE + ")";

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
        actionLabel == "SELL" ? Math.round(t.dayGain / SCALE * 100)/100 : "",
        t.rulesUsed.length > 0 ? t.rulesUsed.join(" + ") : "To Pool",
        poolQty / SCALE,
        poolCost / SCALE,
        poolQty > 0 ? (poolCost / poolQty) : 0,
        t.calString
      ]);
    });
  }
  return finalOutput;
}
