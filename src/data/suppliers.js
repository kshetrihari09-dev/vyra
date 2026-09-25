/* Suppliers for the purchasing / goods-receiving workflow. */
export const SUPPLIERS = [
  { id: "sup-1", name: "MedSource Distributors", contact: "Anita Rao", phone: "+1 555 0410", email: "orders@medsource.example", terms: "Net 30" },
  { id: "sup-2", name: "Cipla Wholesale", contact: "Ravi Iyer", phone: "+1 555 0455", email: "wholesale@cipla-supply.example", terms: "Net 15" },
  { id: "sup-3", name: "GSK Regional Supply", contact: "Helen Cho", phone: "+1 555 0488", email: "supply@gsk-regional.example", terms: "Net 30" },
  { id: "sup-4", name: "Himalaya Direct", contact: "Sanjay Mehta", phone: "+1 555 0499", email: "b2b@himalaya-direct.example", terms: "Prepaid" },
];
export const supplierById = (id) => SUPPLIERS.find((s) => s.id === id) || null;

export const SEED_PURCHASE_ORDERS = [
  {
    id: "po-1001", number: "PO-1001", supplierId: "sup-1", storeId: "store-01",
    createdAt: "2026-09-10T09:00:00", status: "received", invoiceNumber: "INV-77234",
    lines: [
      { productId: "paracetamol-500", qty: 100, purchasePrice: 1.6, batch: "PCM-B04", expiry: "2027-10-21" },
      { productId: "cetirizine-10", qty: 60, purchasePrice: 15, batch: "CTZ-81", expiry: "2028-02-14" },
    ],
    receivedAt: "2026-09-11T14:00:00",
  },
];
