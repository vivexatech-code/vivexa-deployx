'use client';

import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { InvoiceRecord } from '../../types';
import { FileText, Printer, X } from 'lucide-react';

export const AdminInvoicesView: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  useEffect(() => {
    adminService.getAllInvoices().then((res) => {
      setInvoices(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          GST Tax Invoices
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          All tax invoices generated for customers with 18% GST (CGST/SGST or IGST) calculations.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No tax invoices found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 font-sans">
                  <th className="py-3 px-6">Invoice #</th>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Base (₹)</th>
                  <th className="py-3 px-6">GST 18% (₹)</th>
                  <th className="py-3 px-6">Total (₹)</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6 text-right font-sans">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-6 font-sans">
                      <div className="font-bold text-slate-900">{inv.customerName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{inv.customerEmail}</div>
                    </td>
                    <td className="py-3.5 px-6 text-slate-800">
                      ₹{inv.subtotal.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-6 text-indigo-600">
                      ₹{inv.gstAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      ₹{inv.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {new Date(inv.issuedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-6 text-right font-sans">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-200 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    TAX INVOICE
                  </h2>
                  <p className="text-xs font-mono text-slate-500 mt-1">
                    Invoice No: <span className="font-bold text-slate-900">{selectedInvoice.invoiceNumber}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Date: {new Date(selectedInvoice.issuedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold text-slate-900">VIVEXA HOSTING</p>
                  <p className="text-slate-500">vivexatech.in</p>
                  <p className="text-slate-500">GSTIN: 29AAAAA0000A1Z5</p>
                </div>
              </div>
            </div>

            <div className="mb-6 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-1">
                Billed To:
              </p>
              <p className="font-semibold text-slate-900">{selectedInvoice.customerName}</p>
              <p>{selectedInvoice.customerEmail}</p>
              {selectedInvoice.customerGstin && (
                <p className="font-mono text-indigo-700 font-semibold mt-1">
                  GSTIN: {selectedInvoice.customerGstin}
                </p>
              )}
            </div>

            <table className="w-full text-xs text-left mb-6 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2">Description</th>
                  <th className="py-2 text-right">SAC</th>
                  <th className="py-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-semibold text-slate-900">
                    {selectedInvoice.planName} Subscription &bull; Monthly
                  </td>
                  <td className="py-3 text-right font-mono text-slate-500">998315</td>
                  <td className="py-3 text-right font-bold text-slate-900">
                    ₹{selectedInvoice.subtotal.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="border-t border-slate-200 pt-4 space-y-2 text-xs text-slate-700 mb-6">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold">₹{selectedInvoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-indigo-600">
                <span>18% GST:</span>
                <span className="font-semibold">₹{selectedInvoice.gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount Paid:</span>
                <span>₹{selectedInvoice.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
