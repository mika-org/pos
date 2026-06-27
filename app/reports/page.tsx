"use client";

import { useState, useEffect } from 'react';
import { Transaction } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { Download, Search, FileText, TrendingUp, Tag, Banknote, RefreshCw } from 'lucide-react';
import { DateRangeFilter, DatePreset } from '@/components/ui/DateRangeFilter';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend 
} from 'recharts';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [preset, setPreset] = useState<DatePreset>('today');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filter logic
  const startTs = startOfDay(new Date(startDate)).getTime();
  const endTs = endOfDay(new Date(endDate)).getTime();

  useEffect(() => {
    const fetchReportData = async () => {
      setIsLoading(true);
      try {
        const [transactionsRes, customerOrdersRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('*')
            .gte('date', startTs)
            .lte('date', endTs)
            .eq('status', 'completed'),
          supabase
            .from('customer_orders')
            .select('*')
            .gte('created_at', startTs)
            .lte('created_at', endTs)
            .eq('status', 'finished')
        ]);

        if (transactionsRes.error) throw transactionsRes.error;
        if (customerOrdersRes.error) throw customerOrdersRes.error;

        setTransactions(transactionsRes.data || []);
        setCustomerOrders(customerOrdersRes.data || []);
      } catch (err) {
        console.error('Error fetching reports data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [startDate, endDate]);

  // Combine transactions and customer self-orders/table orders
  const combinedItems = [
    ...transactions.map(tx => ({
      id: tx.id,
      no: tx.no,
      date: tx.date,
      subtotal: tx.subtotal,
      discount: tx.discount,
      total: tx.total,
      paymentMethod: tx.paymentMethod,
      type: 'POS Kasir'
    })),
    ...customerOrders.map(co => ({
      id: co.id,
      no: co.id,
      date: co.created_at,
      subtotal: co.total_amount, // Self orders don't store separate discount/subtotal field, total is subtotal
      discount: 0,
      total: co.total_amount,
      paymentMethod: co.payment_method === 'qris' ? 'QRIS' : co.payment_method === 'bank_transfer' ? 'Transfer Bank' : 'Bayar Kasir',
      type: co.table_id ? `Meja (${co.table_id.replace('meja_', 'Meja ')})` : 'Self-Order (Takeaway)'
    }))
  ].sort((a, b) => b.date - a.date); // Newest first

  // Summary Metrics
  const totalRevenue = combinedItems.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = combinedItems.reduce((sum, item) => sum + item.discount, 0);
  const totalSubtotal = combinedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const transactionCount = combinedItems.length;

  // Chart Data Calculations (Daily breakdown, up to 31 points)
  const chartData = [];
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  const diffTime = Math.abs(endD.getTime() - startD.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Number of days

  const daysToRender = Math.min(diffDays, 31);
  for (let i = 0; i < daysToRender; i++) {
    const date = new Date(startTs + i * 24 * 60 * 60 * 1000);
    const start = startOfDay(date).getTime();
    const end = endOfDay(date).getTime();
    
    const dayRevenue = 
      transactions
        .filter(tx => tx.date >= start && tx.date <= end)
        .reduce((sum, tx) => sum + tx.total, 0) +
      customerOrders
        .filter(co => co.created_at >= start && co.created_at <= end)
        .reduce((sum, co) => sum + co.total_amount, 0);
      
    chartData.push({
      name: format(date, 'dd MMM'),
      revenue: dayRevenue
    });
  }

  // Payment breakdown for chart
  const pmBreakdownTotals: Record<string, number> = {
    'QRIS': 0,
    'Transfer Bank': 0,
    'Bayar Kasir': 0,
    'Lainnya/Tunai': 0
  };

  combinedItems.forEach(item => {
    let method = item.paymentMethod || 'Lainnya/Tunai';
    if (method.toUpperCase().includes('QRIS')) method = 'QRIS';
    else if (method.toUpperCase().includes('TRANSFER') || method.toUpperCase().includes('BANK')) method = 'Transfer Bank';
    else if (method.toUpperCase().includes('KASIR') || method.toUpperCase().includes('CASHIER')) method = 'Bayar Kasir';
    else method = 'Lainnya/Tunai';

    pmBreakdownTotals[method] += item.total;
  });

  const paymentChartData = Object.entries(pmBreakdownTotals)
    .filter(([_, value]) => value > 0)
    .map(([name, value], idx) => {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#64748b']; // blue, emerald, amber, slate
      return { name, value, color: colors[idx % colors.length] };
    });

  // Export to Excel
  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      
      // Setup workbook properties
      workbook.creator = 'RestoFlow POS';
      workbook.lastModifiedBy = 'RestoFlow POS';
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // --- SHEET 1: RINGKASAN ---
      const summarySheet = workbook.addWorksheet('Ringkasan');
      summarySheet.views = [{ showGridLines: true }];
      
      // Page Title
      summarySheet.mergeCells('A1:G1');
      const titleCell = summarySheet.getCell('A1');
      titleCell.value = 'RestoFlow - Laporan Ringkasan Penjualan';
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' } // Slate-800
      };
      summarySheet.getRow(1).height = 40;
      
      // Date Range Info
      summarySheet.mergeCells('A2:G2');
      const rangeCell = summarySheet.getCell('A2');
      rangeCell.value = `Periode Laporan: ${startDate} s/d ${endDate}`;
      rangeCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
      rangeCell.alignment = { vertical: 'middle', horizontal: 'left' };
      summarySheet.getRow(2).height = 20;

      // Card / KPI Blocks
      // Card 1
      summarySheet.mergeCells('A4:B4');
      summarySheet.getCell('A4').value = 'Total Penjualan Kotor';
      summarySheet.getCell('A4').font = { size: 9, bold: true, color: { argb: 'FF475569' } };
      summarySheet.mergeCells('A5:B5');
      summarySheet.getCell('A5').value = totalSubtotal;
      summarySheet.getCell('A5').numFmt = '"Rp"#,##0';
      summarySheet.getCell('A5').font = { size: 14, bold: true, color: { argb: 'FF1E3A8A' } }; // Blue-900

      // Card 2
      summarySheet.mergeCells('C4:D4');
      summarySheet.getCell('C4').value = 'Total Diskon';
      summarySheet.getCell('C4').font = { size: 9, bold: true, color: { argb: 'FF475569' } };
      summarySheet.mergeCells('C5:D5');
      summarySheet.getCell('C5').value = totalDiscount;
      summarySheet.getCell('C5').numFmt = '"Rp"#,##0';
      summarySheet.getCell('C5').font = { size: 14, bold: true, color: { argb: 'FF9F1239' } }; // Rose-800

      // Card 3
      summarySheet.mergeCells('E4:G4');
      summarySheet.getCell('E4').value = 'Total Pendapatan Bersih';
      summarySheet.getCell('E4').font = { size: 9, bold: true, color: { argb: 'FF475569' } };
      summarySheet.mergeCells('E5:G5');
      summarySheet.getCell('E5').value = totalRevenue;
      summarySheet.getCell('E5').numFmt = '"Rp"#,##0';
      summarySheet.getCell('E5').font = { size: 14, bold: true, color: { argb: 'FF065F46' } }; // Emerald-800
      
      const kpiCells = ['A4', 'A5', 'B4', 'B5', 'C4', 'C5', 'D4', 'D5', 'E4', 'E5', 'F4', 'F5', 'G4', 'G5'];
      kpiCells.forEach(cellRef => {
        const cell = summarySheet.getCell(cellRef);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' } // Slate-50
        };
      });
      summarySheet.getRow(4).height = 18;
      summarySheet.getRow(5).height = 25;

      // KPI Row 2
      summarySheet.mergeCells('A7:B7');
      summarySheet.getCell('A7').value = 'Jumlah Transaksi';
      summarySheet.getCell('A7').font = { size: 9, bold: true, color: { argb: 'FF475569' } };
      summarySheet.mergeCells('A8:B8');
      summarySheet.getCell('A8').value = transactionCount;
      summarySheet.getCell('A8').numFmt = '#,##0';
      summarySheet.getCell('A8').font = { size: 12, bold: true, color: { argb: 'FF1E293B' } };

      summarySheet.mergeCells('C7:D7');
      summarySheet.getCell('C7').value = 'Rata-rata Transaksi';
      summarySheet.getCell('C7').font = { size: 9, bold: true, color: { argb: 'FF475569' } };
      summarySheet.mergeCells('C8:D8');
      summarySheet.getCell('C8').value = transactionCount > 0 ? totalRevenue / transactionCount : 0;
      summarySheet.getCell('C8').numFmt = '"Rp"#,##0';
      summarySheet.getCell('C8').font = { size: 12, bold: true, color: { argb: 'FF1E293B' } };

      const kpiRow2 = ['A7', 'A8', 'B7', 'B8', 'C7', 'C8', 'D7', 'D8'];
      kpiRow2.forEach(cellRef => {
        const cell = summarySheet.getCell(cellRef);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      });
      summarySheet.getRow(7).height = 18;
      summarySheet.getRow(8).height = 25;

      // Payment Summary Table
      summarySheet.mergeCells('A11:C11');
      const pmHeaderCell = summarySheet.getCell('A11');
      pmHeaderCell.value = 'RINGKASAN METODE PEMBAYARAN';
      pmHeaderCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
      
      summarySheet.getCell('A12').value = 'Metode Pembayaran';
      summarySheet.getCell('B12').value = 'Jumlah Transaksi';
      summarySheet.getCell('C12').value = 'Total Pendapatan';
      
      const pmHeaders = ['A12', 'B12', 'C12'];
      pmHeaders.forEach(cellRef => {
        const cell = summarySheet.getCell(cellRef);
        cell.font = { size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF475569' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });
      summarySheet.getRow(12).height = 20;

      const pmBreakdown: Record<string, { count: number; total: number }> = {
        'QRIS': { count: 0, total: 0 },
        'Transfer Bank': { count: 0, total: 0 },
        'Bayar Kasir': { count: 0, total: 0 },
        'Lainnya/Tunai': { count: 0, total: 0 }
      };

      combinedItems.forEach(item => {
        let method = item.paymentMethod || 'Lainnya/Tunai';
        if (method.toUpperCase().includes('QRIS')) method = 'QRIS';
        else if (method.toUpperCase().includes('TRANSFER') || method.toUpperCase().includes('BANK')) method = 'Transfer Bank';
        else if (method.toUpperCase().includes('KASIR') || method.toUpperCase().includes('CASHIER')) method = 'Bayar Kasir';
        else method = 'Lainnya/Tunai';

        pmBreakdown[method].count += 1;
        pmBreakdown[method].total += item.total;
      });

      let currentPmRow = 13;
      Object.entries(pmBreakdown).forEach(([method, data]) => {
        summarySheet.getCell(`A${currentPmRow}`).value = method;
        summarySheet.getCell(`B${currentPmRow}`).value = data.count;
        summarySheet.getCell(`C${currentPmRow}`).value = data.total;
        
        summarySheet.getCell(`A${currentPmRow}`).alignment = { horizontal: 'left' };
        summarySheet.getCell(`B${currentPmRow}`).alignment = { horizontal: 'center' };
        summarySheet.getCell(`C${currentPmRow}`).alignment = { horizontal: 'right' };
        summarySheet.getCell(`C${currentPmRow}`).numFmt = '"Rp"#,##0';
        
        ['A', 'B', 'C'].forEach(col => {
          const cell = summarySheet.getCell(`${col}${currentPmRow}`);
          cell.font = { size: 9 };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
        currentPmRow++;
      });

      summarySheet.getCell(`A${currentPmRow}`).value = 'Total';
      summarySheet.getCell(`B${currentPmRow}`).value = { formula: `=SUM(B13:B${currentPmRow - 1})` };
      summarySheet.getCell(`C${currentPmRow}`).value = { formula: `=SUM(C13:C${currentPmRow - 1})` };
      summarySheet.getCell(`C${currentPmRow}`).numFmt = '"Rp"#,##0';
      
      ['A', 'B', 'C'].forEach(col => {
        const cell = summarySheet.getCell(`${col}${currentPmRow}`);
        cell.font = { size: 9, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = {
          top: { style: 'double', color: { argb: 'FF475569' } },
          bottom: { style: 'double', color: { argb: 'FF475569' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      // Transaction Source Summary Table
      summarySheet.mergeCells('E11:G11');
      const srcHeaderCell = summarySheet.getCell('E11');
      srcHeaderCell.value = 'RINGKASAN SUMBER TRANSAKSI';
      srcHeaderCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };

      summarySheet.getCell('E12').value = 'Sumber Pesanan';
      summarySheet.getCell('F12').value = 'Jumlah Transaksi';
      summarySheet.getCell('G12').value = 'Total Pendapatan';
      
      const srcHeaders = ['E12', 'F12', 'G12'];
      srcHeaders.forEach(cellRef => {
        const cell = summarySheet.getCell(cellRef);
        cell.font = { size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF475569' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      const srcBreakdown: Record<string, { count: number; total: number }> = {
        'POS Kasir': { count: 0, total: 0 },
        'Pesanan Meja/Self-Order': { count: 0, total: 0 }
      };

      combinedItems.forEach(item => {
        const isMeja = item.type.includes('Meja') || item.type.includes('Self-Order');
        const key = isMeja ? 'Pesanan Meja/Self-Order' : 'POS Kasir';
        srcBreakdown[key].count += 1;
        srcBreakdown[key].total += item.total;
      });

      let currentSrcRow = 13;
      Object.entries(srcBreakdown).forEach(([src, data]) => {
        summarySheet.getCell(`E${currentSrcRow}`).value = src;
        summarySheet.getCell(`F${currentSrcRow}`).value = data.count;
        summarySheet.getCell(`G${currentSrcRow}`).value = data.total;
        
        summarySheet.getCell(`E${currentSrcRow}`).alignment = { horizontal: 'left' };
        summarySheet.getCell(`F${currentSrcRow}`).alignment = { horizontal: 'center' };
        summarySheet.getCell(`G${currentSrcRow}`).alignment = { horizontal: 'right' };
        summarySheet.getCell(`G${currentSrcRow}`).numFmt = '"Rp"#,##0';
        
        ['E', 'F', 'G'].forEach(col => {
          const cell = summarySheet.getCell(`${col}${currentSrcRow}`);
          cell.font = { size: 9 };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
        currentSrcRow++;
      });

      summarySheet.getCell(`E${currentSrcRow}`).value = 'Total';
      summarySheet.getCell(`F${currentSrcRow}`).value = { formula: `=SUM(F13:F${currentSrcRow - 1})` };
      summarySheet.getCell(`G${currentSrcRow}`).value = { formula: `=SUM(G13:G${currentSrcRow - 1})` };
      summarySheet.getCell(`G${currentSrcRow}`).numFmt = '"Rp"#,##0';
      
      ['E', 'F', 'G'].forEach(col => {
        const cell = summarySheet.getCell(`${col}${currentSrcRow}`);
        cell.font = { size: 9, bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = {
          top: { style: 'double', color: { argb: 'FF475569' } },
          bottom: { style: 'double', color: { argb: 'FF475569' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      summarySheet.getColumn('A').width = 22;
      summarySheet.getColumn('B').width = 18;
      summarySheet.getColumn('C').width = 20;
      summarySheet.getColumn('D').width = 5;
      summarySheet.getColumn('E').width = 24;
      summarySheet.getColumn('F').width = 18;
      summarySheet.getColumn('G').width = 22;

      // --- SHEET 2: DETAIL TRANSAKSI ---
      const detailSheet = workbook.addWorksheet('Detail Transaksi');
      detailSheet.views = [{ showGridLines: true }];

      const headers = ['No. Transaksi', 'Tanggal', 'Tipe / Sumber', 'Subtotal', 'Diskon', 'Total', 'Metode Bayar'];
      const headerRow = detailSheet.addRow(headers);
      headerRow.height = 24;

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E293B' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF0F172A' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FF334155' } },
          right: { style: 'thin', color: { argb: 'FF334155' } }
        };
      });

      combinedItems.forEach((item, idx) => {
        const formattedDate = format(item.date, 'yyyy-MM-dd HH:mm:ss');
        const row = detailSheet.addRow([
          item.no.toUpperCase(),
          formattedDate,
          item.type,
          item.subtotal,
          item.discount,
          item.total,
          item.paymentMethod
        ]);
        row.height = 20;

        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
        
        row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(4).numFmt = '"Rp"#,##0';
        
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(5).numFmt = '"Rp"#,##0';
        
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(6).numFmt = '"Rp"#,##0';
        row.getCell(6).font = { bold: true, color: { argb: 'FF047857' } };
        
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

        const isEven = idx % 2 === 0;
        const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        row.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 9, ...cell.font };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowBg }
          };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      detailSheet.columns.forEach((column) => {
        let maxLen = 0;
        column.eachCell && column.eachCell({ includeEmpty: true }, (cell) => {
          let valueStr = '';
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object' && 'formula' in cell.value) {
              valueStr = 'Rp 9,999,999';
            } else if (cell.numFmt && cell.numFmt.includes('"Rp"')) {
              valueStr = `Rp ${Number(cell.value).toLocaleString('id-ID')}`;
            } else {
              valueStr = String(cell.value);
            }
          }
          maxLen = Math.max(maxLen, valueStr.length);
        });
        column.width = Math.max(maxLen + 4, 12);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `laporan_penjualan_${startDate}_to_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Laporan Excel (.xlsx) berhasil diunduh!');
    } catch (err) {
      console.error('Gagal mengekspor ke Excel:', err);
      toast.error('Gagal mengekspor ke Excel');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Laporan Penjualan</h1>
          <p className="text-slate-500 text-sm">Lihat ringkasan dan unduh data transaksi.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
          <DateRangeFilter 
            startDate={startDate} 
            endDate={endDate} 
            selectedPreset={preset} 
            onChange={(start, end, pr) => { setStartDate(start); setEndDate(end); setPreset(pr); }}
            showAllTime={true}
          />
          <button 
            onClick={exportToExcel}
            disabled={combinedItems.length === 0 || isExporting}
            className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
          >
            {isExporting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Export Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center space-x-3 mb-2 text-slate-500">
            <TrendingUp size={18} className="text-blue-500" />
            <span className="font-medium text-sm">Total Penjualan Kotor</span>
          </div>
          <span className="text-2xl font-bold text-slate-800">Rp {totalSubtotal.toLocaleString('id-ID')}</span>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center space-x-3 mb-2 text-slate-500">
            <Tag size={18} className="text-rose-500" />
            <span className="font-medium text-sm">Total Diskon</span>
          </div>
          <span className="text-2xl font-bold text-rose-500">- Rp {totalDiscount.toLocaleString('id-ID')}</span>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center space-x-3 mb-2 text-slate-500">
            <Banknote size={18} className="text-emerald-500" />
            <span className="font-medium text-sm">Total Pendapatan Bersih</span>
          </div>
          <span className="text-2xl font-bold text-emerald-600">Rp {totalRevenue.toLocaleString('id-ID')}</span>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center space-x-3 mb-2 text-slate-500">
            <FileText size={18} className="text-purple-500" />
            <span className="font-medium text-sm">Jumlah Transaksi</span>
          </div>
          <span className="text-2xl font-bold text-slate-800">{transactionCount} Transaksi</span>
        </div>
      </div>

      {/* Recharts Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Tren Pendapatan Harian</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Analisis tren omzet selama rentang tanggal terpilih</p>
          </div>
          <div className="flex-1 w-full min-h-[250px] min-w-0 relative">
            {chartData.length === 0 || chartData.every(d => d.revenue === 0) ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-semibold">
                Belum ada data penjualan pada rentang tanggal ini.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenueReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} 
                    tickFormatter={(val) => `Rp ${(val/1000)}k`} 
                    dx={-10}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`Rp ${Number(value || 0).toLocaleString('id-ID')}`, 'Pendapatan']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontFamily: 'inherit', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenueReports)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment Methods Breakdown Pie Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Metode Pembayaran</h2>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Perbandingan omzet per metode bayar</p>
          </div>
          <div className="flex-1 w-full min-h-[220px] min-w-0 relative flex items-center justify-center">
            {paymentChartData.length === 0 ? (
              <div className="text-slate-400 text-xs font-semibold text-center py-10">
                Tidak ada data metode pembayaran.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)', fontSize: '11px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-[11px] font-bold text-slate-600">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Details Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800">Detail Transaksi (Selesai)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-medium">No. Transaksi</th>
                <th className="px-6 py-3 font-medium">Tanggal</th>
                <th className="px-6 py-3 font-medium">Tipe / Sumber</th>
                <th className="px-6 py-3 font-medium">Subtotal</th>
                <th className="px-6 py-3 font-medium">Diskon</th>
                <th className="px-6 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Memuat data...
                  </td>
                </tr>
              ) : combinedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data transaksi pada rentang tanggal tersebut.
                  </td>
                </tr>
              ) : (
                combinedItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium text-slate-800 select-all uppercase text-xs tracking-wider">{item.no}</td>
                    <td className="px-6 py-3 text-slate-600">{format(item.date, 'dd MMM yyyy, HH:mm')}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        item.type.includes('Meja') ? 'bg-blue-100 text-blue-800' :
                        item.type.includes('Takeaway') ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">Rp {item.subtotal.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-3 text-rose-500">Rp {item.discount.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-3 font-bold text-emerald-600">Rp {item.total.toLocaleString('id-ID')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
