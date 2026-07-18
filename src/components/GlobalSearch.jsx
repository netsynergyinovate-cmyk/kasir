import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, User, FileText, Building2 } from 'lucide-react';

const GlobalSearch = ({ isOpen, onClose, customers = [], transactions = [], setReceiptToView, setInstansiReceiptToView }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchedCustomers = q
    ? customers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.nickname && c.nickname.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      ).slice(0, 8)
    : [];

  const matchedTransactions = q
    ? transactions.filter(trx =>
        (trx.customerName || '').toLowerCase().includes(q) ||
        (trx.instansiName || '').toLowerCase().includes(q) ||
        trx.id.toLowerCase().includes(q)
      ).slice(0, 8)
    : [];

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handleCustomerClick = (cust) => {
    handleClose();
    navigate(`/customers?q=${encodeURIComponent(cust.name)}`);
  };

  const handleTransactionClick = (trx) => {
    handleClose();
    if (trx.type === 'instansi') {
      setInstansiReceiptToView(trx);
    } else {
      setReceiptToView(trx);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/60 backdrop-blur-sm flex items-start justify-center p-4 pt-20 print:hidden" onClick={handleClose}>
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <Search size={20} className="text-gray-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pelanggan atau transaksi..."
            className="flex-1 outline-none text-sm font-medium bg-transparent"
          />
          <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!q && (
            <p className="text-center text-gray-400 text-xs font-medium py-10">Ketik untuk mencari pelanggan atau transaksi...</p>
          )}

          {q && matchedCustomers.length === 0 && matchedTransactions.length === 0 && (
            <p className="text-center text-gray-400 text-xs font-medium py-10">Tidak ditemukan</p>
          )}

          {matchedCustomers.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-2">Pelanggan</p>
              {matchedCustomers.map(cust => (
                <button
                  key={cust.id}
                  onClick={() => handleCustomerClick(cust)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <User size={16} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-gray-800 text-xs truncate">{cust.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{cust.package}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {matchedTransactions.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-2">Transaksi</p>
              {matchedTransactions.map(trx => (
                <button
                  key={trx.id}
                  onClick={() => handleTransactionClick(trx)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center shrink-0">
                    {trx.type === 'instansi' ? <Building2 size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-gray-800 text-xs truncate">
                      {trx.type === 'instansi' ? trx.instansiName : trx.customerName}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{trx.id}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
