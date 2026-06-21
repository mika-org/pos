"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DiningTable } from '@/lib/db';
import { useTranslation } from '@/stores/languageStore';
import { Plus, Edit2, Trash2, Search, QrCode, Printer, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function TablesPage() {
  const { t } = useTranslation();
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  
  // Form states
  const [tableName, setTableName] = useState('');
  const [tableStatus, setTableStatus] = useState<'active' | 'inactive'>('active');

  const fetchTables = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      setTables(data || []);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
      toast.error('Failed to load tables data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const openAddModal = () => {
    setSelectedTable(null);
    setTableName('');
    setTableStatus('active');
    setIsModalOpen(true);
  };

  const openEditModal = (table: DiningTable) => {
    setSelectedTable(table);
    setTableName(table.name);
    setTableStatus(table.status);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTable(null);
    setTableName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) return;

    try {
      const payload = {
        name: tableName,
        status: tableStatus,
        updated_at: Date.now(),
      };

      if (selectedTable) {
        const { error } = await supabase
          .from('tables')
          .update(payload)
          .eq('id', selectedTable.id);
        if (error) throw error;
      } else {
        const newId = 'meja_' + tableName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const { error } = await supabase
          .from('tables')
          .insert({
            id: newId,
            ...payload,
            created_at: Date.now(),
          });
        if (error) throw error;
      }

      toast.success(t('successSaveTable'));
      closeModal();
      await fetchTables();
    } catch (err) {
      console.error('Failed to save table:', err);
      toast.error('Failed to save table data');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('confirmDeleteTable'))) {
      try {
        const { error } = await supabase
          .from('tables')
          .delete()
          .eq('id', id);
        if (error) throw error;

        toast.success(t('successDeleteTable'));
        await fetchTables();
      } catch (err) {
        console.error('Failed to delete table:', err);
        toast.error('Failed to delete table');
      }
    }
  };

  const openQrModal = (table: DiningTable) => {
    setSelectedTable(table);
    setIsQrModalOpen(true);
  };

  const closeQrModal = () => {
    setIsQrModalOpen(false);
    setSelectedTable(null);
  };

  const handlePrint = (table: DiningTable) => {
    const tableOrderUrl = `${window.location.origin}/order?table=${table.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableOrderUrl)}`;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cetak QR Code - ${table.name}</title>
            <style>
              body {
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #ffffff;
                color: #0f172a;
              }
              .card {
                border: 4px solid #3b82f6;
                padding: 40px;
                border-radius: 28px;
                text-align: center;
                max-width: 320px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
              }
              .logo {
                font-weight: 800;
                font-size: 20px;
                color: #3b82f6;
                margin-bottom: 20px;
                letter-spacing: -0.025em;
              }
              .title {
                font-weight: 900;
                font-size: 38px;
                margin: 0 0 4px 0;
                letter-spacing: -0.05em;
              }
              .subtitle {
                font-size: 14px;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                margin: 0 0 24px 0;
                font-weight: 700;
              }
              .qr-container {
                background-color: #f8fafc;
                padding: 16px;
                border-radius: 16px;
                display: inline-block;
                border: 1px solid #e2e8f0;
              }
              img {
                width: 220px;
                height: 220px;
                display: block;
              }
              .footer {
                margin-top: 24px;
                font-size: 12px;
                color: #94a3b8;
                font-weight: 500;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="logo">POS RESTORAN</div>
              <div class="title">${table.name}</div>
              <div class="subtitle">Scan to Self-Order</div>
              <div class="qr-container">
                <img src="${qrUrl}" alt="QR Code" />
              </div>
              <div class="footer">Silakan pindai untuk memilih menu & bayar langsung</div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">{t('tablesTitle')}</h1>
          <p className="text-sm text-slate-500">{t('tablesSubtitle')}</p>
        </div>
        <Button 
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center transition-colors cursor-pointer text-sm shadow-md shadow-blue-500/10 active:scale-95 rounded-xl px-4 py-2.5"
        >
          <Plus size={16} className="mr-2" />
          {t('addTable')}
        </Button>
      </div>

      {/* Search Input bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 flex items-center">
          <div className="relative w-72">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <Input 
              type="text" 
              placeholder={`${t('tableName')}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border-slate-300 rounded-xl w-full text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
            />
          </div>
        </div>

        {/* Visual Cards Grid Layout */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500 font-medium">{t('loading')}</div>
          ) : filteredTables.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium">Tidak ada data meja. Silakan tambahkan meja baru.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
              {filteredTables.map((table) => (
                <div 
                  key={table.id} 
                  className="bg-white border border-slate-200/85 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-black text-slate-800 tracking-tight">{table.name}</h3>
                      <Badge variant="outline" className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        table.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100/60 hover:bg-emerald-50' 
                          : 'bg-slate-100 text-slate-500 border-slate-200/60 hover:bg-slate-100'
                      }`}>
                        {table.status === 'active' ? t('active') : t('inactive')}
                      </Badge>
                    </div>
                    
                    {/* QR Code trigger card */}
                    <div 
                      onClick={() => openQrModal(table)}
                      className="bg-slate-50/50 hover:bg-blue-50/30 rounded-xl p-4 border border-slate-200/50 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none group/qr hover:border-blue-100"
                    >
                      <QrCode size={40} className="text-slate-400 group-hover/qr:text-blue-500 transition-colors" />
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-2.5 group-hover/qr:text-blue-600 transition-colors">Cetak QR Code</span>
                    </div>
                  </div>

                  {/* Quick actions footer */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100/80 flex justify-end space-x-1.5">
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(table)}
                      className="h-8 w-8 text-blue-600 hover:bg-blue-100/50 transition-colors cursor-pointer border border-transparent hover:border-blue-200/40 rounded-lg"
                      title={t('editTable')}
                    >
                      <Edit2 size={13} />
                    </Button>
                    <Button 
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(table.id)}
                      className="h-8 w-8 text-rose-600 hover:bg-rose-100/50 transition-colors cursor-pointer border border-transparent hover:border-rose-200/40 rounded-lg"
                      title="Hapus"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-white rounded-2xl max-w-md border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-800 uppercase tracking-wider">
              {selectedTable ? t('editTable') : t('addTable')}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t('tableName')} <span className="text-rose-500">*</span>
              </label>
              <Input 
                required
                placeholder={t('tableNamePlaceholder')}
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-full font-semibold border-slate-250 rounded-xl px-4 py-2"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                {t('tableStatus')}
              </label>
              <select
                value={tableStatus}
                onChange={(e) => setTableStatus(e.target.value as 'active' | 'inactive')}
                className="w-full px-4 py-2.5 border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white text-sm font-semibold"
              >
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
            </div>
            
            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="ghost"
                onClick={closeModal}
                className="font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
              >
                {t('cancel')}
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
              >
                {t('saveTable')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code Preview Modal */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="bg-white rounded-2xl max-w-sm border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">
              QR Code - {selectedTable?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTable && (
            <div className="flex flex-col items-center space-y-4 pt-2">
              <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    typeof window !== 'undefined' ? `${window.location.origin}/order?table=${selectedTable.id}` : ''
                  )}`} 
                  alt={`QR Code ${selectedTable.name}`}
                  className="w-48 h-48 block"
                />
              </div>
              <div className="text-center space-y-1.5">
                <p className="font-black text-slate-850 text-xl tracking-tight leading-none">{selectedTable.name}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t('scanToOrder')}</p>
              </div>
              
              <div className="w-full flex space-x-2 pt-2">
                <Button 
                  onClick={() => handlePrint(selectedTable)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl font-extrabold flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider shadow-sm active:scale-95"
                >
                  <Printer size={14} className="mr-2" />
                  {t('printQrCode')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
