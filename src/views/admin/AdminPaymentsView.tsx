import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/admin.service';
import { PaymentRecord } from '../../types';

export const AdminPaymentsView: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getAllPayments().then((res) => {
      setPayments(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Payment Transactions
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Razorpay transaction history with 18% GST itemization.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading payments...</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No payment records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 font-sans">
                  <th className="py-3 px-6">Payment ID</th>
                  <th className="py-3 px-6">User ID</th>
                  <th className="py-3 px-6">Base Amount</th>
                  <th className="py-3 px-6">GST (18%)</th>
                  <th className="py-3 px-6">Total Paid</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {p.razorpayPaymentId || p.id.slice(0, 10)}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600">
                      {p.userId}
                    </td>
                    <td className="py-3.5 px-6 text-slate-800">
                      ₹{p.amount - (p.gstAmount || 0)}
                    </td>
                    <td className="py-3.5 px-6 text-indigo-600">
                      ₹{p.gstAmount || 0}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      ₹{p.amount}
                    </td>
                    <td className="py-3.5 px-6 font-sans">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.status === 'captured'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
