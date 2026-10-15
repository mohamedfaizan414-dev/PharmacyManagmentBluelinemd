/** Demo data. Dates are generated relative to "today" so expiry states are always interesting. */
const day = 86400000;
const iso = (offsetDays = 0, hours = 0) => new Date(Date.now() + offsetDays * day + hours * 3600000).toISOString();
const dateOnly = (offsetDays) => iso(offsetDays).slice(0, 10);

export const seed = () => {
  const medicines = [
    ["Pantoprazole 40mg (Pantocid)", "Pantoprazole", "Tablet", "40mg", 15, 165, 12, 30],
    ["Insulin Aspart (Novorapid)", "Insulin Aspart", "Cartridge", "100IU/ml", 1, 780, 5, 5],
    ["Amoxycillin & Clavulanate (Augmentin 625)", "Amoxicillin + Clavulanic acid", "Tablet", "625mg", 10, 224, 12, 30],
    ["Cetirizine 10mg", "Cetirizine", "Tablet", "10mg", 10, 38, 12, 40],
    ["Paracetamol 650mg (Dolo 650)", "Paracetamol", "Tablet", "650mg", 15, 33, 12, 60],
    ["Metformin 500mg (Glycomet)", "Metformin", "Tablet", "500mg", 20, 29, 12, 40],
    ["Atorvastatin 10mg (Atorva)", "Atorvastatin", "Tablet", "10mg", 15, 108, 12, 30],
    ["Amlodipine 5mg (Amlong)", "Amlodipine", "Tablet", "5mg", 15, 56, 12, 30],
    ["Azithromycin 500mg (Azithral)", "Azithromycin", "Tablet", "500mg", 5, 118, 12, 20],
    ["Ondansetron 4mg (Emeset)", "Ondansetron", "Tablet", "4mg", 10, 42, 12, 20],
    ["Ceftriaxone 1g Inj (Monocef)", "Ceftriaxone", "Injection", "1g", 1, 78, 12, 20],
    ["Normal Saline 0.9% 500ml", "Sodium chloride", "IV Fluid", "500ml", 1, 42, 5, 30],
    ["Pantoprazole 40mg Inj", "Pantoprazole", "Injection", "40mg", 1, 62, 12, 20],
    ["Diclofenac 50mg (Voveran)", "Diclofenac", "Tablet", "50mg", 10, 22, 12, 30],
    ["Salbutamol Inhaler (Asthalin)", "Salbutamol", "Inhaler", "100mcg", 1, 165, 12, 5],
    ["Vitamin D3 60000 IU (Uprise-D3)", "Cholecalciferol", "Capsule", "60000IU", 4, 148, 12, 12],
    ["ORS Sachet", "Oral rehydration salts", "Sachet", "21g", 1, 22, 5, 30],
    ["Telmisartan 40mg (Telma 40)", "Telmisartan", "Tablet", "40mg", 15, 122, 12, 30],
  ].map((m, i) => ({
    _id: `med_${i + 1}`,
    name: m[0],
    genericName: m[1],
    medicineType: { name: m[2] },
    strength: m[3],
    unitsPerStrip: m[4],
    pricePerStrip: m[5],
    gstPercent: m[6],
    reorderLevel: m[7],
    hsnCode: "3004",
  }));

  // [medicineIndex, batch, expiryOffsetDays, strips, rack]
  const batchRows = [
    [0, "PAN2602", -45, 1, "A1"], [0, "PAN2611", 22, 1, "A1"], [0, "PAN2705", 400, 12, "A1"],
    [1, "NVP26G", 25, 2, "F1"], [1, "NVP27A", 300, 2, "F1"],
    [2, "AUG26A", 38, 5, "B2"], [2, "AUG27C", 420, 20, "B2"],
    [3, "CET2603", 52, 30, "C1"], [3, "CET2701", 500, 30, "C1"],
    [4, "DOL2609", 200, 40, "C2"], [4, "DOL2701", 600, 60, "C2"],
    [5, "GLY2606", 160, 25, "D1"], [5, "GLY2702", 640, 30, "D1"],
    [6, "ATV2604", 85, 3, "D2"], [6, "ATV2708", 700, 10, "D2"],
    [7, "AML2605", 250, 14, "D3"],
    [8, "AZI2610", 18, 4, "B1"], [8, "AZI2704", 480, 15, "B1"],
    [9, "EME2608", 140, 18, "C3"],
    [10, "MON2607", 75, 40, "G1"], [10, "MON2703", 520, 50, "G1"],
    [11, "NSL2612", 260, 60, "G2"],
    [12, "PNI2609", 190, 30, "G1"],
    [13, "VOV2606", 310, 40, "C4"],
    [14, "ASM2611", 340, 2, "H1"],
    [15, "UPR2605", 140, 6, "E1"],
    [16, "ORS2701", 380, 90, "G3"],
    [17, "TEL2608", 290, 18, "D4"],
  ];
  const inventory = batchRows.map((b, i) => {
    const med = medicines[b[0]];
    return {
      _id: `inv_${i + 1}`,
      medicineId: med,
      batch: b[1],
      expiryDate: dateOnly(b[2]),
      totalUnits: b[3] * med.unitsPerStrip,
      unitsPerStrip: med.unitsPerStrip,
      pricePerStrip: med.pricePerStrip,
      mrpPerStrip: med.pricePerStrip,
      gstPercent: med.gstPercent,
      rackNo: b[4],
    };
  });

  const patients = [
    ["P101", "Ramesh Kumar", 54, 0, "9876500101", ["Penicillin"]],
    ["P102", "Anita Sharma", 36, 1, "9876500102", []],
    ["P103", "Suresh Reddy", 67, 0, "9876500103", []],
    ["P104", "Fatima Begum", 29, 1, "9876500104", ["Sulfa drugs"]],
    ["P105", "Arjun Nair", 8, 0, "9876500105", []],
    ["P106", "Lakshmi Iyer", 72, 1, "9876500106", []],
    ["P107", "Imran Khan", 41, 0, "9876500107", []],
    ["P108", "Divya Menon", 33, 1, "9876500108", ["Aspirin"]],
  ].map((p, i) => ({ _id: `pat_${i + 1}`, patientId: p[0], patientName: p[1], age: p[2], gender: p[3], phoneNumber: p[4], countryCode: "+91", allergies: p[5] }));

  const doctors = [
    { _id: "doc_1", name: "Dr. Meera Krishnan", department: "General Medicine" },
    { _id: "doc_2", name: "Dr. Rohit Verma", department: "Cardiology" },
    { _id: "doc_3", name: "Dr. Sana Qureshi", department: "Pediatrics" },
    { _id: "doc_4", name: "Dr. Vikram Rao", department: "Pulmonology" },
  ];

  const M = (n) => `med_${n}`;
  const item = (n, name, dosage, frequency, duration, qty, instructions = "", route = "Oral") => ({
    _id: `it_${Math.random().toString(36).slice(2, 9)}`,
    medicineId: M(n),
    medicineName: name,
    dosage,
    frequency,
    duration,
    quantity: qty,
    dispensedQuantity: 0,
    instructions,
    route,
    substituteAllowed: true,
  });
  const orders = [
    { _id: "ord_1", orderId: "OPD-9812", type: "OPD", status: "PENDING", priority: "NORMAL", patient: patients[0], doctor: doctors[0], diagnosis: "Acid reflux with seasonal allergy", createdAt: iso(0, -0.4), items: [
      item(1, "Pantoprazole 40mg (Pantocid)", "40mg", "1-0-0", "14 days", 14, "Before breakfast"),
      item(4, "Cetirizine 10mg", "10mg", "0-0-1", "5 days", 5, "At bedtime"),
      item(5, "Paracetamol 650mg (Dolo 650)", "650mg", "SOS", "5 days", 10, "Only if fever above 100°F"),
    ] },
    { _id: "ord_2", orderId: "IPD-5061", type: "IPD", status: "REQUESTED", priority: "URGENT", patient: patients[2], doctor: doctors[1], location: "Male Medical Ward - Bed 4", encounterId: "ADM-2210", diagnosis: "Community acquired pneumonia", createdAt: iso(0, -0.15), items: [
      item(11, "Ceftriaxone 1g Inj (Monocef)", "1g", "1-0-1", "5 days", 10, "IV, slow push", "IV"),
      item(13, "Pantoprazole 40mg Inj", "40mg", "1-0-0", "5 days", 5, "", "IV"),
      item(12, "Normal Saline 0.9% 500ml", "500ml", "1-1-1", "2 days", 6, "", "IV"),
      item(10, "Ondansetron 4mg (Emeset)", "4mg", "SOS", "3 days", 6, "If nauseous"),
    ] },
    { _id: "ord_3", orderId: "OPD-9811", type: "OPD", status: "PENDING", priority: "NORMAL", patient: patients[1], doctor: doctors[0], diagnosis: "Type 2 diabetes – follow up", createdAt: iso(0, -1.5), items: [
      item(6, "Metformin 500mg (Glycomet)", "500mg", "1-0-1", "30 days", 60, "After food"),
      item(7, "Atorvastatin 10mg (Atorva)", "10mg", "0-0-1", "30 days", 30),
      item(16, "Vitamin D3 60000 IU (Uprise-D3)", "60000IU", "Weekly", "8 weeks", 8),
    ] },
    { _id: "ord_4", orderId: "OPD-9809", type: "OPD", status: "IN_PROGRESS", priority: "NORMAL", patient: patients[3], doctor: doctors[3], diagnosis: "Bronchitis", createdAt: iso(0, -2.4), items: [
      item(9, "Azithromycin 500mg (Azithral)", "500mg", "1-0-0", "3 days", 3),
      item(15, "Salbutamol Inhaler (Asthalin)", "100mcg", "2 puffs SOS", "—", 1, "Rinse mouth after use", "Inhaled"),
    ] },
    { _id: "ord_5", orderId: "IPD-5058", type: "IPD", status: "REQUESTED", priority: "NORMAL", patient: patients[5], doctor: doctors[1], location: "Female Ward - Bed 11", encounterId: "ADM-2207", diagnosis: "Hypertension, post-op day 2", createdAt: iso(0, -3), items: [
      item(8, "Amlodipine 5mg (Amlong)", "5mg", "1-0-0", "7 days", 7),
      item(18, "Telmisartan 40mg (Telma 40)", "40mg", "1-0-0", "7 days", 7),
      item(14, "Diclofenac 50mg (Voveran)", "50mg", "1-0-1", "3 days", 6, "After food"),
    ] },
    { _id: "ord_6", orderId: "OPD-9805", type: "OPD", status: "PENDING", priority: "NORMAL", patient: patients[4], doctor: doctors[2], diagnosis: "Viral fever", createdAt: iso(0, -4), items: [
      item(5, "Paracetamol 650mg (Dolo 650)", "250mg", "1-1-1", "3 days", 9, "Syrup equivalent – tablet quartered"),
      item(17, "ORS Sachet", "21g", "After each loose stool", "3 days", 6, "", "Oral"),
    ] },
    { _id: "ord_7", orderId: "OPD-9798", type: "OPD", status: "DISPENSED", priority: "NORMAL", patient: patients[6], doctor: doctors[0], diagnosis: "Allergic rhinitis", createdAt: iso(-1, -2), billId: "bill_1", items: [
      { ...item(4, "Cetirizine 10mg", "10mg", "0-0-1", "10 days", 10), dispensedQuantity: 10 },
    ] },
    { _id: "ord_8", orderId: "IPD-5049", type: "IPD", status: "PARTIALLY_DISPENSED", priority: "NORMAL", patient: patients[7], doctor: doctors[0], location: "Female Ward - Bed 2", encounterId: "ADM-2198", diagnosis: "Gastroenteritis", createdAt: iso(-1, -5), items: [
      { ...item(10, "Ondansetron 4mg (Emeset)", "4mg", "1-1-1", "3 days", 9), dispensedQuantity: 9 },
      item(17, "ORS Sachet", "21g", "Frequent sips", "3 days", 12, "", "Oral"),
    ] },
    { _id: "ord_9", orderId: "OPD-9790", type: "OPD", status: "REJECTED", priority: "NORMAL", patient: patients[1], doctor: doctors[3], diagnosis: "—", createdAt: iso(-2, -3), rejectionReason: "Prescription unclear – clarification requested from doctor", items: [item(3, "Augmentin 625", "625mg", "1-0-1", "5 days", 10)] },
  ];

  const billItem = (invIdx, qty, discountPct = 0) => {
    const inv = inventory[invIdx];
    const unit = inv.pricePerStrip / inv.unitsPerStrip;
    const base = unit * qty;
    const total = base + (base * inv.gstPercent) / 100;
    const disc = (total * discountPct) / 100;
    return {
      _id: `bi_${Math.random().toString(36).slice(2, 8)}`,
      medicineId: inv.medicineId._id,
      inventoryId: inv._id,
      medicineName: inv.medicineId.name,
      batch: inv.batch,
      price: Math.round(unit * 100) / 100,
      quantity: qty,
      discountPercent: discountPct,
      gstPercent: inv.gstPercent,
      total: Math.round(total * 100) / 100,
      itemDiscountAmount: Math.round(disc * 100) / 100,
      amount: Math.round((total - disc) * 100) / 100,
    };
  };
  const mkBill = (n, extra) => {
    const items = extra.items;
    const net = items.reduce((s, i) => s + i.amount, 0);
    const billAmount = Math.round(net);
    const paid = extra.paid ?? billAmount;
    return {
      _id: `bill_${n}`,
      billId: `PH-${String(1000 + n)}`,
      source: extra.source || "WALKIN",
      patientId: extra.patient?._id,
      patientName: extra.patient?.patientName || extra.name || "Walk-in customer",
      phone: extra.patient?.phoneNumber || extra.phone || "",
      age: extra.patient?.age ?? null,
      gender: extra.patient?.gender,
      doctorName: extra.doctor || "",
      items,
      netAmount: Math.round(net * 100) / 100,
      gstAmount: Math.round(items.reduce((s, i) => s + (i.total - i.total / (1 + i.gstPercent / 100)), 0) * 100) / 100,
      overallDiscountAmount: 0,
      roundOff: Math.round((billAmount - net) * 100) / 100,
      billAmount,
      paidAmount: paid,
      totalBalance: Math.max(0, billAmount - paid),
      paymentMode: extra.mode || "CASH",
      createdAt: extra.createdAt,
      createdByName: "Pharmacist",
      prescriptionId: extra.prescriptionId,
      payments: paid ? [{ amount: paid, paymentMode: extra.mode || "CASH", createdAt: extra.createdAt }] : [],
    };
  };
  const bills = [
    mkBill(1, { source: "OPD", patient: patients[6], doctor: "Dr. Meera Krishnan", prescriptionId: "ord_7", items: [billItem(7, 10)], createdAt: iso(-1, -1.5), mode: "UPI" }),
    mkBill(2, { source: "WALKIN", name: "Walk-in customer", items: [billItem(9, 15), billItem(26, 4)], createdAt: iso(-1, -4) }),
    mkBill(3, { source: "IPD", patient: patients[7], doctor: "Dr. Meera Krishnan", prescriptionId: "ord_8", items: [billItem(18, 9)], createdAt: iso(-1, -4.5), paid: 150, mode: "CASH" }),
    mkBill(4, { source: "WALKIN", name: "Karthik S", phone: "9845012345", items: [billItem(11, 30), billItem(15, 15, 5)], createdAt: iso(-2, -3), mode: "CARD" }),
    mkBill(5, { source: "OPD", patient: patients[1], doctor: "Dr. Meera Krishnan", items: [billItem(5, 20)], createdAt: iso(-3, -2), paid: 0, mode: "CREDIT" }),
    mkBill(6, { source: "WALKIN", name: "Walk-in customer", items: [billItem(13, 10), billItem(3, 1)], createdAt: iso(-4, -2), mode: "CASH" }),
  ];

  const returns = [
    { _id: "ret_1", returnId: "RT-501", billId: "bill_4", billNo: "PH-1004", patientName: "Karthik S", refundAmount: 6.5, refundMode: "CASH", createdAt: iso(-1, -1), createdByName: "Pharmacist", items: [{ medicineName: bills[3].items[0].medicineName, batch: bills[3].items[0].batch, quantity: 4, reason: "Doctor changed prescription", amount: 6.5 }] },
  ];

  return { medicines, inventory, patients, doctors, orders, bills, returns, counters: { bill: 6, ret: 501, ord: 5061, opd: 9812 } };
};
