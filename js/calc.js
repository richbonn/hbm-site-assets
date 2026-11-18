/* Mortgage calculators. Pure functions first (tested in Node), DOM binding second.
   Every figure is an illustration, not a quote, offer, or approval decision. */
(function (root) {
  "use strict";

  function toNum(v) {
    if (typeof v === "number") return v;
    if (v === null || v === undefined) return NaN;
    var s = String(v).replace(/[$,%\s]/g, "").replace(/,/g, "");
    return s === "" ? NaN : Number(s);
  }
  function opt(v) { var n = toNum(v); return isNaN(n) ? 0 : n; } /* blank optional field = 0 */
  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

  /* Standard amortization formula. Handles 0% interest. */
  function pmt(principal, annualRatePct, years) {
    var n = Math.round(years * 12);
    if (!(principal >= 0) || !(n > 0) || isNaN(annualRatePct)) return NaN;
    if (principal === 0) return 0;
    var r = annualRatePct / 1200;
    if (r === 0) return principal / n;
    return principal * r / (1 - Math.pow(1 + r, -n));
  }

  function checkRate(errs, rate) {
    if (isNaN(rate)) errs.push("Enter an interest rate, like 6.5. Use 0 for a 0% loan.");
    else if (rate < 0 || rate > 25) errs.push("Interest rate must be between 0 and 25.");
  }
  function checkYears(errs, years, label) {
    if (isNaN(years) || years < 1 || years > 40) errs.push(label + " must be between 1 and 40 years.");
  }

  /* 1. Payment */
  function payment(i) {
    var errs = [];
    var price = toNum(i.price), down = toNum(i.down), rate = toNum(i.rate), years = toNum(i.years);
    var tax = opt(i.tax), ins = opt(i.ins), mi = opt(i.mi), hoa = opt(i.hoa);
    if (isNaN(price) || price <= 0) errs.push("Enter a home price greater than 0.");
    if (isNaN(down) || down < 0) errs.push("Enter a down payment of 0 or more.");
    else if (!isNaN(price) && down >= price) errs.push("Down payment must be less than the home price.");
    checkRate(errs, rate); checkYears(errs, years, "Loan term");
    [["Property taxes", tax], ["Homeowners insurance", ins], ["Mortgage insurance", mi], ["HOA dues", hoa]].forEach(function (p) {
      if (p[1] < 0) errs.push(p[0] + " cannot be negative.");
    });
    if (errs.length) return { errors: errs };
    var loan = price - down;
    var pi = round2(pmt(loan, rate, years));
    var t = round2(tax / 12), n = round2(ins / 12);
    return {
      errors: [], loan: round2(loan), ltv: round2(loan / price * 100), pi: pi,
      tax: t, ins: n, mi: round2(mi), hoa: round2(hoa),
      total: round2(pi + t + n + mi + hoa)
    };
  }

  /* 3. Bank statement income illustration. Expense factor is the user's own input. */
  function income(i) {
    var errs = [];
    var months = toNum(i.months), dep = toNum(i.deposits), exc = opt(i.excluded), ef = toNum(i.factor);
    if (months !== 12 && months !== 24) errs.push("Choose 12 or 24 months.");
    if (isNaN(dep) || dep <= 0) errs.push("Enter total deposits greater than 0.");
    if (exc < 0) errs.push("Excluded deposits cannot be negative.");
    else if (!isNaN(dep) && exc > dep) errs.push("Excluded deposits cannot be more than total deposits.");
    if (isNaN(ef) || ef < 0 || ef > 100) errs.push("Enter an expense factor between 0 and 100.");
    if (errs.length) return { errors: errs };
    var eligible = dep - exc;
    var afterExpenses = eligible * (1 - ef / 100);
    return {
      errors: [], months: months, eligible: round2(eligible), expenses: round2(eligible * ef / 100),
      afterExpenses: round2(afterExpenses), monthly: round2(afterExpenses / months)
    };
  }

  /* 4. Refinance comparison with break-even and long-term cost */
  function refi(i) {
    var errs = [];
    var bal = toNum(i.balance), cur = toNum(i.current), remY = toNum(i.remaining);
    var rate = toNum(i.rate), newY = toNum(i.years), costs = opt(i.costs), fin = !!i.financed;
    if (isNaN(bal) || bal <= 0) errs.push("Enter your current loan balance.");
    if (isNaN(cur) || cur <= 0) errs.push("Enter your current monthly principal and interest payment.");
    checkYears(errs, remY, "Years left on your current loan");
    checkRate(errs, rate); checkYears(errs, newY, "New loan term");
    if (costs < 0) errs.push("Closing costs cannot be negative.");
    if (errs.length) return { errors: errs };
    var newLoan = bal + (fin ? costs : 0);
    var newPI = round2(pmt(newLoan, rate, newY));
    var savings = round2(cur - newPI);
    var breakEven = costs === 0 ? 0 : (savings > 0 ? Math.ceil(costs / savings) : null);
    var totalCurrent = round2(cur * remY * 12);
    var totalNew = round2(newPI * newY * 12 + (fin ? 0 : costs));
    return {
      errors: [], newLoan: round2(newLoan), newPI: newPI, savings: savings, breakEven: breakEven,
      totalCurrent: totalCurrent, totalNew: totalNew, totalDiff: round2(totalNew - totalCurrent),
      termReset: Math.round(newY * 12) > Math.round(remY * 12)
    };
  }


  /* 5. Extra taxes to qualify on tax returns vs. a bank statement loan.
     Illustration only. Combined tax rate is a rough marginal rate the user controls. */
  function taxsave(i) {
    var errs = [];
    var price = toNum(i.price), downPct = toNum(i.downPct), rate = toNum(i.rate);
    var premIn = toNum(i.premium), propPct = opt(i.propTax), insPct = opt(i.insPct), pmiPct = opt(i.pmiPct);
    var debts = opt(i.debts), dti = toNum(i.dti), taxable = toNum(i.taxable);
    var bracket = toNum(i.bracket), se = !!i.se, other = opt(i.otherRate), custom = toNum(i.customRate);
    var yrsReviewed = toNum(i.yearsReviewed), hold = toNum(i.hold);
    if (isNaN(price) || price <= 0) errs.push("Enter a home price greater than 0.");
    if (isNaN(downPct) || downPct < 5 || downPct > 50) errs.push("Enter a down payment between 5 and 50 percent.");
    checkRate(errs, rate);
    if (!isNaN(premIn) && (premIn < 0 || premIn > 6)) errs.push("Rate premium must be between 0 and 6 points, or leave it blank.");
    if (isNaN(dti) || dti < 20 || dti > 60) errs.push("Debt-to-income limit must be between 20 and 60 percent.");
    if (isNaN(taxable) || taxable < 0) errs.push("Enter the income shown on your tax return, 0 or more.");
    if (debts < 0) errs.push("Other monthly debts cannot be negative.");
    if (propPct < 0 || insPct < 0 || pmiPct < 0 || other < 0) errs.push("Percentages cannot be negative.");
    if (!isNaN(custom) && (custom < 0 || custom > 80)) errs.push("Custom tax rate must be between 0 and 80 percent.");
    if (yrsReviewed !== 1 && yrsReviewed !== 2) errs.push("Choose 1 or 2 tax years.");
    if (isNaN(hold) || hold < 1 || hold > 30) errs.push("Years you expect to keep the loan must be between 1 and 30.");
    if (errs.length) return { errors: errs };
    var down = price * downPct / 100, loan = price - down;
    var prem = !isNaN(premIn) ? premIn : (downPct >= 20 ? 0.5 : (downPct >= 15 ? 1.25 : 1.75));
    var taxMo = price * propPct / 1200, insMo = price * insPct / 1200;
    var pmiMo = downPct < 20 ? loan * pmiPct / 1200 : 0;
    var convPI = pmt(loan, rate, 30), bsRate = rate + prem, bsPI = pmt(loan, bsRate, 30);
    var convTotal = convPI + taxMo + insMo + pmiMo, bsTotal = bsPI + taxMo + insMo;
    var reqMonthly = (convTotal + debts) / (dti / 100), reqAnnual = reqMonthly * 12;
    var gap = Math.max(0, reqAnnual - taxable);
    var combined = !isNaN(custom) ? custom : (bracket + (se ? 15.3 : 0) + other);
    var extraTaxYear = gap * combined / 100, extraTaxTotal = extraTaxYear * yrsReviewed;
    var extraLoanYear = (bsTotal - convTotal) * 12;
    var extraLoanHold = extraLoanYear * hold;
    var net = extraTaxTotal - extraLoanHold;
    var breakEven = extraLoanYear > 0 ? extraTaxTotal / extraLoanYear : null;
    return {
      errors: [], loan: round2(loan), premium: prem, rate: rate, bsRate: round2(bsRate),
      convPI: round2(convPI), bsPI: round2(bsPI), convTotal: round2(convTotal), bsTotal: round2(bsTotal), pmi: round2(pmiMo),
      reqAnnual: round2(reqAnnual), taxable: round2(taxable), gap: round2(gap), combined: round2(combined),
      extraTaxYear: round2(extraTaxYear), extraTaxTotal: round2(extraTaxTotal), yearsReviewed: yrsReviewed,
      extraLoanYear: round2(extraLoanYear), extraLoanHold: round2(extraLoanHold), hold: hold,
      net: round2(net), breakEven: breakEven === null ? null : round2(breakEven), qualifies: gap === 0
    };
  }

  var api = { toNum: toNum, pmt: pmt, payment: payment, income: income, refi: refi, taxsave: taxsave };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  root.HBMCalc = api;

  /* ---------- DOM binding ---------- */
  if (typeof document === "undefined") return;
  var usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  var usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function rows(pairs) {
    var dl = el("dl");
    pairs.forEach(function (p) { dl.appendChild(el("dt", null, p[0])); dl.appendChild(el("dd", null, p[1])); });
    return dl;
  }
  function headline(label, big) { var f = document.createDocumentFragment(); f.appendChild(el("p", "label", label)); f.appendChild(el("p", "big", big)); return f; }
  function note(t) { return el("p", "note", t); }

  var renderers = {
    taxsave: function (r, out) {
      if (r.qualifies) {
        out.appendChild(headline("Extra taxes to qualify on your tax return", usd0.format(0)));
        out.appendChild(note("On these assumptions the income on your return already covers this payment, so you would not have to give up any deductions. A lender's own review may still differ."));
      } else {
        out.appendChild(headline("Extra taxes to qualify with your tax return", usd0.format(r.extraTaxTotal)));
        out.appendChild(note("That is the estimated extra tax you would pay across " + r.yearsReviewed + " tax year" + (r.yearsReviewed > 1 ? "s" : "") + " by giving up about " + usd0.format(r.gap) + " of legitimate deductions each year to show enough income."));
      }
      out.appendChild(el("h3", "out-h", "How the gap works"));
      out.appendChild(rows([
        ["Income needed to qualify, per year", usd0.format(r.reqAnnual)],
        ["Income on your tax return", usd0.format(r.taxable)],
        ["Gap: deductions you would give up", usd0.format(r.gap)],
        ["Combined tax rate used", r.combined.toFixed(1) + "%"],
        ["Extra tax per tax year", usd0.format(r.extraTaxYear)]
      ]));
      out.appendChild(el("h3", "out-h", "What the bank statement loan costs instead"));
      out.appendChild(rows([
        ["Tax-return loan: rate and monthly payment", r.rate.toFixed(3) + "%  |  " + usd0.format(r.convTotal)],
        ["Bank statement loan: rate and monthly payment", r.bsRate.toFixed(3) + "%  |  " + usd0.format(r.bsTotal)],
        ["Extra cost of the bank statement loan, per year", (r.extraLoanYear >= 0 ? "" : "-") + usd0.format(Math.abs(r.extraLoanYear))],
        ["Over " + r.hold + " year" + (r.hold > 1 ? "s" : "") + " of owning the loan", (r.extraLoanHold >= 0 ? "" : "-") + usd0.format(Math.abs(r.extraLoanHold))]
      ]));
      var verdict;
      if (r.qualifies) verdict = "You would not need to give up deductions on these numbers, so the comparison is mostly about the rate and payment above.";
      else if (r.net > 0) verdict = "On these numbers, the extra taxes you would pay to qualify (" + usd0.format(r.extraTaxTotal) + ") are more than the extra cost of the bank statement loan over " + r.hold + " year" + (r.hold > 1 ? "s" : "") + ". Net difference: " + usd0.format(r.net) + " in the bank statement loan's favor.";
      else verdict = "On these numbers, the bank statement loan costs " + usd0.format(Math.abs(r.net)) + " more over " + r.hold + " year" + (r.hold > 1 ? "s" : "") + " than the one-time taxes to qualify. A longer hold favors the tax-return route; a shorter one favors the bank statement loan.";
      out.appendChild(el("p", "verdict", verdict));
      if (!r.qualifies && r.breakEven !== null) out.appendChild(note("Break-even: the bank statement loan's higher cost catches up with the extra taxes after about " + r.breakEven.toFixed(1) + " years. Many borrowers refinance sooner when their returns catch up, which changes this math."));
      out.appendChild(note("Not counted: a bigger mortgage interest deduction. Paying more interest to deduct it still costs more than it saves. Talk with your CPA about your actual deductions."));
    },
    payment: function (r, out) {
      out.appendChild(headline("Estimated monthly payment", usd2.format(r.total)));
      out.appendChild(rows([
        ["Loan amount", usd0.format(r.loan)], ["Loan-to-value", r.ltv.toFixed(1) + "%"],
        ["Principal and interest", usd2.format(r.pi)], ["Property taxes", usd2.format(r.tax)],
        ["Homeowners insurance", usd2.format(r.ins)], ["Mortgage insurance", usd2.format(r.mi)], ["HOA dues", usd2.format(r.hoa)]
      ]));
      out.appendChild(note("Principal and interest is the loan payment itself. The other lines are the amounts you entered, spread over 12 months."));
    },
    income: function (r, out) {
      out.appendChild(headline("Illustrative monthly income", usd0.format(r.monthly)));
      out.appendChild(rows([
        ["Deposits counted", usd0.format(r.eligible)], ["Expense factor applied", "-" + usd0.format(r.expenses)],
        ["Left after expense factor", usd0.format(r.afterExpenses)], ["Divided by", r.months + " months"]
      ]));
      out.appendChild(note("This shows the arithmetic only. A lender chooses the program, the expense factor, and which deposits count after reviewing your actual statements."));
    },
    refi: function (r, out) {
      out.appendChild(headline("Estimated monthly change", (r.savings >= 0 ? "-" : "+") + usd2.format(Math.abs(r.savings))));
      var pairs = [
        ["New loan amount", usd0.format(r.newLoan)], ["New principal and interest", usd2.format(r.newPI)],
        ["Break-even", r.breakEven === null ? "No monthly savings" : (r.breakEven === 0 ? "No closing costs entered" : r.breakEven + " months")],
        ["Total paid, current loan", usd0.format(r.totalCurrent)], ["Total paid, new loan", usd0.format(r.totalNew)],
        [r.totalDiff > 0 ? "New loan costs more overall" : "New loan costs less overall", usd0.format(Math.abs(r.totalDiff))]
      ];
      out.appendChild(rows(pairs));
      var msg = "A lower payment is not the same as lower total cost. Break-even is closing costs divided by monthly savings.";
      if (r.termReset) msg += " This new term is longer than what you have left, which usually means more interest over time.";
      out.appendChild(note(msg));
    }
  };

  function readForm(form) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (f) {
      if (!f.name) return;
      data[f.name] = f.type === "checkbox" ? f.checked : f.value;
    });
    return data;
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("form[data-calc]"), function (form) {
      var kind = form.getAttribute("data-calc");
      var out = form.parentNode.querySelector("[data-output]");
      var errBox = form.querySelector("[data-errors]");
      var emptyMsg = out.textContent;
      function showErrors(list) {
        errBox.textContent = "";
        if (!list.length) { errBox.hidden = true; return; }
        var ul = el("ul");
        list.forEach(function (m) { ul.appendChild(el("li", null, m)); });
        errBox.appendChild(el("p", null, "Check these before calculating:"));
        errBox.appendChild(ul);
        errBox.hidden = false;
      }
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var r = root.HBMCalc[kind](readForm(form));
        out.textContent = "";
        if (r.errors.length) { showErrors(r.errors); out.appendChild(el("p", "placeholder", emptyMsg)); return; }
        showErrors([]);
        renderers[kind](r, out);
      });
      form.addEventListener("reset", function () {
        window.setTimeout(function () { showErrors([]); out.textContent = ""; out.appendChild(el("p", "placeholder", emptyMsg)); }, 0);
      });
      var ex = form.querySelector("[data-example-btn]");
      if (ex) ex.addEventListener("click", function () {
        var vals = JSON.parse(form.getAttribute("data-example"));
        Object.keys(vals).forEach(function (k) {
          var f = form.elements[k]; if (!f) return;
          if (f.type === "checkbox") f.checked = !!vals[k]; else f.value = vals[k];
        });
        form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
      });
    });
  }
  /* Optional: pick up a newer weekly Freddie Mac rate. Fails quietly and keeps the page's own value.
     1) FRED's public copy of the Freddie Mac PMMS series (needs the host to allow the request).
     2) data/pmms.json, a file on the same site. */
  function parseFred(text) {
    var lines = String(text).trim().split(/\r?\n/), i, p;
    for (i = lines.length - 1; i > 0; i--) {
      p = lines[i].split(",");
      if (p.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && !isNaN(parseFloat(p[1]))) {
        var v = parseFloat(p[1]);
        if (v >= 1 && v <= 20) return { rate: String(v), date: p[0] };
      }
    }
    return null;
  }
  function usDate(iso) { var a = iso.split("-"); return a[1] + "/" + a[2] + "/" + a[0]; }
  function toIso(us) { var a = String(us).split("/"); return a.length === 3 ? a[2] + "-" + a[0] + "-" + a[1] : ""; }
  root.HBMCalc.parseFred = parseFred;
  function loadRate() {
    var input = document.getElementById("ts-rate");
    if (!input || typeof fetch !== "function") return;
    var label = document.querySelector("[data-pmms-date]");
    function apply(rate, us) {
      if (input.value !== input.defaultValue) return;
      var cur = label ? toIso(label.textContent) : "";
      if (cur && toIso(us) && toIso(us) < cur) return;
      input.value = rate; input.defaultValue = rate;
      if (label) label.textContent = us;
    }
    fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (t) { var d = parseFred(t); if (!d) return Promise.reject(); apply(d.rate, usDate(d.date)); })
      .catch(function () {
        fetch("data/pmms.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { if (d && d.rate) apply(String(d.rate), d.asOf || ""); }).catch(function () {});
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); loadRate(); }); else { init(); loadRate(); }
})(typeof window !== "undefined" ? window : globalThis);
