import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, FileText, Building2 } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import './Dashboard.css';

const Dashboard = ({ transactions, customers, setReceiptToView, setInstansiReceiptToView }) => {
  return (
    <div className="dashboard-container p-4 space-y-4 pb-32 animate-in fade-in duration-200">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-4 rounded-3xl text-white shadow-lg shadow-blue-200">
          <p className="text-xs font-medium text-blue-100 opacity-90 mb-1">Pendapatan Hari Ini</p>
          <p className="text-xl font-bold tracking-tight">
            {formatRupiah(transactions.reduce((acc, curr) => acc + curr.price, 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-medium text-gray-500 mb-1">Total Pelanggan</p>
          <div className="flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            <p className="text-xl font-bold text-gray-800">{customers.length}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex justify-between items-end mb-3">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Transaksi Terakhir</h2>
          <Link to="/history" className="text-xs text-blue-600 font-bold hover:underline">Lihat Semua</Link>
        </div>
        <div className="space-y-3">
          {transactions.slice(0, 5).map((trx) => (
            <div 
              key={trx.id} 
              onClick={() => trx.type === 'instansi' ? setInstansiReceiptToView(trx) : setReceiptToView(trx)} 
              className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${trx.type === 'instansi' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-600'}`}>
                  {trx.type === 'instansi' ? <Building2 size={18}/> : <FileText size={18} />}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm leading-tight">{trx.type === 'instansi' ? trx.instansiName : trx.customerName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-gray-500">{new Date(trx.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                    {trx.type !== 'instansi' && (
                       <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${trx.status === 'LUNAS' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                         {trx.status}
                       </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="font-bold text-sm text-gray-900">{formatRupiah(trx.price)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
