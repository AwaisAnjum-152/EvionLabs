/* EvionLab — billing.js
   Manual bill / invoice generator used on pricing.html
   Material rates are illustrative starter values — edit MATERIALS below
   to match your actual current price list. */

(function () {

  /* ---- Material price list (PKR per gram) ---------------------------- */
  var MATERIALS = [
    { id: 'pla',      label: 'PLA (Standard)',            rate: 25 },
    { id: 'abs',      label: 'ABS',                        rate: 28 },
    { id: 'petg',     label: 'PETG',                       rate: 30 },
    { id: 'tpu',      label: 'TPU (Flexible)',             rate: 40 },
    { id: 'resin_std',label: 'Resin — Standard (SLA)',     rate: 35 },
    { id: 'resin_eng',label: 'Resin — Tough / Engineering',rate: 50 },
    { id: 'nylon',    label: 'Nylon (SLS)',                rate: 60 },
    { id: 'cf',       label: 'Carbon-Fibre Reinforced',    rate: 70 },
    { id: 'service',  label: 'Design / Service (flat rate)', rate: 0 }
  ];

  var itemsBody   = document.getElementById('itemsBody');
  var addBtn      = document.getElementById('addItemBtn');
  var subtotalEl  = document.getElementById('subtotalVal');
  var discountIn  = document.getElementById('discountInput');
  var taxIn       = document.getElementById('taxInput');
  var discountVal = document.getElementById('discountVal');
  var taxVal      = document.getElementById('taxVal');
  var grandVal    = document.getElementById('grandVal');
  var pdfBtn      = document.getElementById('downloadPdfBtn');

  if (!itemsBody) return; /* billing UI not on this page */

  var rowCount = 0;

  function materialOptions(selectedId) {
    return MATERIALS.map(function (m) {
      return '<option value="' + m.id + '" data-rate="' + m.rate + '"' +
        (m.id === selectedId ? ' selected' : '') + '>' + m.label + '</option>';
    }).join('');
  }

  function addRow(prefill) {
    rowCount++;
    var tr = document.createElement('tr');
    tr.dataset.row = rowCount;
    var pf = prefill || {};
    tr.innerHTML =
      '<td><input type="text" class="desc" placeholder="e.g. Drone arm bracket" value="' + (pf.desc || '') + '"></td>' +
      '<td><select class="material">' + materialOptions(pf.material || 'pla') + '</select></td>' +
      '<td><input type="number" class="weight" min="0" step="1" value="' + (pf.weight != null ? pf.weight : 50) + '" placeholder="grams"></td>' +
      '<td><input type="number" class="qty" min="1" step="1" value="' + (pf.qty || 1) + '"></td>' +
      '<td><input type="number" class="unitprice mono" min="0" step="1" value="0" readonly></td>' +
      '<td class="linetotal mono">0</td>' +
      '<td><button type="button" class="row-remove" aria-label="Remove item">✕</button></td>';
    itemsBody.appendChild(tr);

    var materialSel = tr.querySelector('.material');
    var weightIn    = tr.querySelector('.weight');
    var qtyIn       = tr.querySelector('.qty');
    var unitPriceIn = tr.querySelector('.unitprice');

    function updateUnitEditable() {
      var isService = materialSel.value === 'service';
      unitPriceIn.readOnly = !isService;
      if (isService) unitPriceIn.focus();
    }

    function recalcRow() {
      var mat = MATERIALS.find(function (m) { return m.id === materialSel.value; });
      var rate = mat ? mat.rate : 0;
      var weight = parseFloat(weightIn.value) || 0;
      var qty = parseFloat(qtyIn.value) || 0;

      if (materialSel.value === 'service') {
        weightIn.disabled = true;
        weightIn.value = '';
      } else {
        weightIn.disabled = false;
        var lineUnit = Math.round(rate * weight);
        unitPriceIn.value = lineUnit;
      }
      var unit = parseFloat(unitPriceIn.value) || 0;
      var total = Math.round(unit * qty);
      tr.querySelector('.linetotal').textContent = total.toLocaleString();
      recalcTotals();
    }

    materialSel.addEventListener('change', function () { updateUnitEditable(); recalcRow(); });
    weightIn.addEventListener('input', recalcRow);
    qtyIn.addEventListener('input', recalcRow);
    unitPriceIn.addEventListener('input', function () { recalcRow(); });
    tr.querySelector('.row-remove').addEventListener('click', function () {
      tr.remove();
      recalcTotals();
    });

    updateUnitEditable();
    recalcRow();
  }

  function recalcTotals() {
    var subtotal = 0;
    itemsBody.querySelectorAll('tr').forEach(function (tr) {
      var t = parseFloat(tr.querySelector('.linetotal').textContent.replace(/,/g, '')) || 0;
      subtotal += t;
    });
    var discountPct = parseFloat(discountIn.value) || 0;
    var taxPct = parseFloat(taxIn.value) || 0;
    var discountAmt = Math.round(subtotal * (discountPct / 100));
    var taxable = subtotal - discountAmt;
    var taxAmt = Math.round(taxable * (taxPct / 100));
    var grand = taxable + taxAmt;

    subtotalEl.textContent = 'Rs ' + subtotal.toLocaleString();
    discountVal.textContent = '- Rs ' + discountAmt.toLocaleString();
    taxVal.textContent = '+ Rs ' + taxAmt.toLocaleString();
    grandVal.textContent = 'Rs ' + grand.toLocaleString();
  }

  addBtn.addEventListener('click', function () { addRow(); });
  discountIn.addEventListener('input', recalcTotals);
  taxIn.addEventListener('input', recalcTotals);

  /* seed with one starter row */
  addRow({ desc: 'Sample enclosure — top cover', material: 'pla', weight: 80, qty: 2 });

  /* ---- Invoice numbering (stored locally in this browser) ------------ */
  function nextInvoiceNumber() {
    var key = 'evionlab_invoice_seq';
    var seq = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, seq);
    var d = new Date();
    var stamp = d.getFullYear().toString() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    return 'EVL-' + stamp + '-' + String(seq).padStart(3, '0');
  }

  /* ---- PDF export ------------------------------------------------------ */
  pdfBtn.addEventListener('click', function () {
    var rows = [];
    itemsBody.querySelectorAll('tr').forEach(function (tr) {
      var desc = tr.querySelector('.desc').value || '—';
      var matSel = tr.querySelector('.material');
      var matLabel = matSel.options[matSel.selectedIndex].text;
      var weight = tr.querySelector('.weight').value;
      var qty = tr.querySelector('.qty').value || 1;
      var unit = parseFloat(tr.querySelector('.unitprice').value) || 0;
      var total = tr.querySelector('.linetotal').textContent;
      rows.push([
        desc,
        matLabel + (weight ? ' (' + weight + ' g)' : ''),
        qty,
        'Rs ' + unit.toLocaleString(),
        'Rs ' + total
      ]);
    });

    if (!rows.length) { alert('Add at least one item before generating a PDF.'); return; }

    var customerName = document.getElementById('custName').value || '—';
    var customerPhone = document.getElementById('custPhone').value || '—';
    var customerEmail = document.getElementById('custEmail').value || '—';
    var customerAddr  = document.getElementById('custAddress').value || '—';
    var invoiceNo = nextInvoiceNumber();
    var today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    var jsPDFlib = window.jspdf.jsPDF;
    var doc = new jsPDFlib({ unit: 'pt', format: 'a4' });

    /* Header */
    doc.setFillColor(11, 15, 20);
    doc.rect(0, 0, 595, 90, 'F');
    doc.setTextColor(94, 234, 212);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('EvionLab', 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(230, 230, 230);
    doc.setFont('helvetica', 'normal');
    doc.text('design 2 build', 40, 56);
    doc.setTextColor(180, 190, 195);
    doc.text('Ali Villas Street, Wafaqi Colony, Johar Town, Lahore, Pakistan', 40, 72);

    doc.setTextColor(94, 234, 212);
    doc.setFontSize(14);
    doc.text('INVOICE', 480, 40, { align: 'right' });
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text('No: ' + invoiceNo, 480, 56, { align: 'right' });
    doc.text('Date: ' + today, 480, 70, { align: 'right' });

    /* Bill-to block */
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To', 40, 118);
    doc.setFont('helvetica', 'normal');
    doc.text(customerName, 40, 133);
    doc.text(customerPhone + '   |   ' + customerEmail, 40, 147);
    var addrLines = doc.splitTextToSize(customerAddr, 250);
    doc.text(addrLines, 40, 161);

    doc.setFont('helvetica', 'bold');
    doc.text('From', 330, 118);
    doc.setFont('helvetica', 'normal');
    doc.text('EvionLab', 330, 133);
    doc.text('03229624590', 330, 147);
    doc.text('awaisanjum152@gmail.com', 330, 161);

    /* Items table */
    doc.autoTable({
      startY: 195,
      head: [['Description', 'Material / Service', 'Qty', 'Unit Price', 'Line Total']],
      body: rows,
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, textColor: [30, 30, 30] },
      headStyles: { fillColor: [18, 25, 34], textColor: [94, 234, 212] },
      alternateRowStyles: { fillColor: [245, 247, 248] },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });

    var finalY = doc.lastAutoTable.finalY + 20;
    var subtotalTxt = subtotalEl.textContent;
    var discountTxt = discountVal.textContent;
    var taxTxt = taxVal.textContent;
    var grandTxt = grandVal.textContent;

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text('Subtotal', 400, finalY, { align: 'right' });
    doc.text(subtotalTxt, 555, finalY, { align: 'right' });
    doc.text('Discount', 400, finalY + 16, { align: 'right' });
    doc.text(discountTxt, 555, finalY + 16, { align: 'right' });
    doc.text('Tax', 400, finalY + 32, { align: 'right' });
    doc.text(taxTxt, 555, finalY + 32, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.line(390, finalY + 42, 555, finalY + 42);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text('Total Due', 400, finalY + 60, { align: 'right' });
    doc.text(grandTxt, 555, finalY + 60, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Prices shown are manually entered by EvionLab staff for this quote and may be adjusted before final production.', 40, finalY + 100);
    doc.text('Thank you for choosing EvionLab — design 2 build.', 40, finalY + 114);

    doc.save(invoiceNo + '-EvionLab.pdf');
  });

})();
