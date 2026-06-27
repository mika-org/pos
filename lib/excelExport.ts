import ExcelJS from 'exceljs';
import { format } from 'date-fns';

export const exportSalesReportExcel = async (
  combinedItems: any[],
  startDate: string,
  endDate: string,
  soldItems: any[],
  summary: {
    totalSubtotal: number;
    totalDiscount: number;
    totalRevenue: number;
    transactionCount: number;
  }
) => {
  const { totalSubtotal, totalDiscount, totalRevenue, transactionCount } = summary;
  const workbook = new ExcelJS.Workbook();
  
  // Setup workbook properties
  workbook.creator = 'RestoFlow POS';
  workbook.lastModifiedBy = 'RestoFlow POS';
  workbook.created = new Date();
  workbook.modified = new Date();

  // --- SHEET 1: RINGKASAN EKSEKUTIF ---
  const summarySheet = workbook.addWorksheet('Ringkasan');
  summarySheet.views = [{ showGridLines: true }];

  // Page Title
  summarySheet.mergeCells('A1:L1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'RESTOFLOW - LAPORAN RINGKASAN PENJUALAN';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate-800
  };
  summarySheet.getRow(1).height = 45;

  // Date Range Info
  summarySheet.mergeCells('A2:L2');
  const rangeCell = summarySheet.getCell('A2');
  rangeCell.value = `Periode Laporan: ${startDate || 'Semua Waktu'} s/d ${endDate || 'Semua Waktu'}`;
  rangeCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
  rangeCell.alignment = { vertical: 'middle', horizontal: 'center' };
  rangeCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFAFAFA' }
  };
  summarySheet.getRow(2).height = 25;

  // KPI Cards
  const cards = [
    { title: 'Penjualan Kotor', val: totalSubtotal, fmt: '"Rp "#,##0', color: 'FF1E3A8A', cols: ['A', 'B'] },
    { title: 'Total Diskon', val: totalDiscount, fmt: '"Rp "#,##0', color: 'FF9F1239', cols: ['C', 'D'] },
    { title: 'Pendapatan Bersih', val: totalRevenue, fmt: '"Rp "#,##0', color: 'FF065F46', cols: ['E', 'F'] },
    { title: 'Rata-rata Order', val: transactionCount > 0 ? totalRevenue / transactionCount : 0, fmt: '"Rp "#,##0', color: 'FF7C3AED', cols: ['G', 'H'] },
    { title: 'Total Transaksi', val: transactionCount, fmt: '#,##0" Order"', color: 'FF1E293B', cols: ['I', 'J'] },
    { title: 'Rasio Self-Order', val: transactionCount > 0 ? (combinedItems.filter(item => item.type !== 'POS Kasir').length / transactionCount) : 0, fmt: '0.0%', color: 'FF0891B2', cols: ['K', 'L'] }
  ];

  cards.forEach(c => {
    const col1 = c.cols[0];
    const col2 = c.cols[1];
    
    summarySheet.mergeCells(`${col1}4:${col2}4`);
    summarySheet.mergeCells(`${col1}5:${col2}5`);
    
    const titleC = summarySheet.getCell(`${col1}4`);
    titleC.value = c.title.toUpperCase();
    titleC.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF64748B' } };
    titleC.alignment = { horizontal: 'center', vertical: 'middle' };
    
    const valC = summarySheet.getCell(`${col1}5`);
    valC.value = c.val;
    valC.numFmt = c.fmt;
    valC.font = { name: 'Arial', size: 12, bold: true, color: { argb: c.color } };
    valC.alignment = { horizontal: 'center', vertical: 'middle' };
    
    const borderStyle = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
    [`${col1}4`, `${col2}4`, `${col1}5`, `${col2}5`].forEach(cellRef => {
      const cell = summarySheet.getCell(cellRef);
      cell.border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
  });
  summarySheet.getRow(4).height = 18;
  summarySheet.getRow(5).height = 25;

  // Table Headers Row 8 & 9
  summarySheet.mergeCells('A8:C8');
  const t1Header = summarySheet.getCell('A8');
  t1Header.value = 'RINGKASAN METODE BAYAR';
  t1Header.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
  t1Header.alignment = { horizontal: 'left', vertical: 'middle' };

  summarySheet.mergeCells('E8:G8');
  const t2Header = summarySheet.getCell('E8');
  t2Header.value = 'RINGKASAN SUMBER PESANAN';
  t2Header.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
  t2Header.alignment = { horizontal: 'left', vertical: 'middle' };

  summarySheet.mergeCells('I8:L8');
  const t3Header = summarySheet.getCell('I8');
  t3Header.value = 'TOP 5 PRODUK TERLARIS';
  t3Header.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };
  t3Header.alignment = { horizontal: 'left', vertical: 'middle' };

  summarySheet.getRow(8).height = 25;

  // Table columns headers on row 9
  const row9Headers = [
    { cell: 'A9', val: 'Metode Pembayaran', align: 'left' },
    { cell: 'B9', val: 'Transaksi', align: 'center' },
    { cell: 'C9', val: 'Total Pendapatan', align: 'right' },
    
    { cell: 'E9', val: 'Sumber Pesanan', align: 'left' },
    { cell: 'F9', val: 'Transaksi', align: 'center' },
    { cell: 'G9', val: 'Total Pendapatan', align: 'right' },
    
    { cell: 'I9', val: 'Rank', align: 'center' },
    { cell: 'J9', val: 'Nama Produk', align: 'left' },
    { cell: 'K9', val: 'Qty', align: 'center' },
    { cell: 'L9', val: 'Total Omzet', align: 'right' }
  ];

  const tableHeaderStyle = {
    font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF475569' } }
  };

  row9Headers.forEach(h => {
    const cell = summarySheet.getCell(h.cell);
    cell.value = h.val;
    cell.font = tableHeaderStyle.font;
    cell.fill = tableHeaderStyle.fill;
    cell.alignment = { vertical: 'middle', horizontal: h.align as any };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });
  summarySheet.getRow(9).height = 22;

  // Data calculations for Table 1 & Table 2
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

  // Product sales map
  const productSalesMap: Record<string, { name: string; qty: number; totalSales: number }> = {};
  soldItems.forEach(item => {
    const key = item.productId;
    if (!productSalesMap[key]) {
      productSalesMap[key] = { name: item.productName, qty: 0, totalSales: 0 };
    }
    productSalesMap[key].qty += item.qty;
    productSalesMap[key].totalSales += item.subtotal;
  });

  const excelTopProducts = Object.values(productSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  // Populate Table 1: Payment Method
  Object.entries(pmBreakdown).forEach(([method, data], idx) => {
    const rNum = 10 + idx;
    summarySheet.getCell(`A${rNum}`).value = method;
    summarySheet.getCell(`B${rNum}`).value = data.count;
    summarySheet.getCell(`C${rNum}`).value = data.total;
    summarySheet.getCell(`C${rNum}`).numFmt = '"Rp "#,##0';
    
    summarySheet.getCell(`A${rNum}`).alignment = { horizontal: 'left' };
    summarySheet.getCell(`B${rNum}`).alignment = { horizontal: 'center' };
    summarySheet.getCell(`C${rNum}`).alignment = { horizontal: 'right' };
  });

  // Table 1 Total Row
  summarySheet.getCell('A14').value = 'Total';
  summarySheet.getCell('B14').value = { formula: '=SUM(B10:B13)' };
  summarySheet.getCell('C14').value = { formula: '=SUM(C10:C13)' };
  summarySheet.getCell('C14').numFmt = '"Rp "#,##0';
  summarySheet.getCell('A14').alignment = { horizontal: 'left' };
  summarySheet.getCell('B14').alignment = { horizontal: 'center' };
  summarySheet.getCell('C14').alignment = { horizontal: 'right' };

  // Populate Table 2: Source
  Object.entries(srcBreakdown).forEach(([src, data], idx) => {
    const rNum = 10 + idx;
    summarySheet.getCell(`E${rNum}`).value = src;
    summarySheet.getCell(`F${rNum}`).value = data.count;
    summarySheet.getCell(`G${rNum}`).value = data.total;
    summarySheet.getCell(`G${rNum}`).numFmt = '"Rp "#,##0';
    
    summarySheet.getCell(`E${rNum}`).alignment = { horizontal: 'left' };
    summarySheet.getCell(`F${rNum}`).alignment = { horizontal: 'center' };
    summarySheet.getCell(`G${rNum}`).alignment = { horizontal: 'right' };
  });

  // Table 2 Total Row
  summarySheet.getCell('E12').value = 'Total';
  summarySheet.getCell('F12').value = { formula: '=SUM(F10:F11)' };
  summarySheet.getCell('G12').value = { formula: '=SUM(G10:G11)' };
  summarySheet.getCell('G12').numFmt = '"Rp "#,##0';
  summarySheet.getCell('E12').alignment = { horizontal: 'left' };
  summarySheet.getCell('F12').alignment = { horizontal: 'center' };
  summarySheet.getCell('G12').alignment = { horizontal: 'right' };

  // Populate Table 3: Top Products
  for (let i = 0; i < 5; i++) {
    const rNum = 10 + i;
    const prod = excelTopProducts[i];
    if (prod) {
      summarySheet.getCell(`I${rNum}`).value = i + 1;
      summarySheet.getCell(`J${rNum}`).value = prod.name;
      summarySheet.getCell(`K${rNum}`).value = prod.qty;
      summarySheet.getCell(`L${rNum}`).value = prod.totalSales;
      summarySheet.getCell(`L${rNum}`).numFmt = '"Rp "#,##0';
    } else {
      summarySheet.getCell(`I${rNum}`).value = i + 1;
      summarySheet.getCell(`J${rNum}`).value = '-';
      summarySheet.getCell(`K${rNum}`).value = 0;
      summarySheet.getCell(`L${rNum}`).value = 0;
      summarySheet.getCell(`L${rNum}`).numFmt = '"Rp "#,##0';
    }
    summarySheet.getCell(`I${rNum}`).alignment = { horizontal: 'center' };
    summarySheet.getCell(`J${rNum}`).alignment = { horizontal: 'left' };
    summarySheet.getCell(`K${rNum}`).alignment = { horizontal: 'center' };
    summarySheet.getCell(`L${rNum}`).alignment = { horizontal: 'right' };
  }

  // Format Table borders and backgrounds
  const borderThin = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
  const doubleB = { style: 'double' as const, color: { argb: 'FF475569' } };

  // Table 1 formatting
  for (let r = 10; r <= 14; r++) {
    const isTotal = r === 14;
    ['A', 'B', 'C'].forEach(col => {
      const cell = summarySheet.getCell(`${col}${r}`);
      cell.font = { name: 'Arial', size: 9, bold: isTotal };
      cell.border = {
        top: isTotal ? doubleB : borderThin,
        bottom: isTotal ? doubleB : borderThin,
        left: borderThin,
        right: borderThin
      };
      if (isTotal) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      } else if (r % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
    summarySheet.getRow(r).height = 19;
  }

  // Table 2 formatting
  for (let r = 10; r <= 12; r++) {
    const isTotal = r === 12;
    ['E', 'F', 'G'].forEach(col => {
      const cell = summarySheet.getCell(`${col}${r}`);
      cell.font = { name: 'Arial', size: 9, bold: isTotal };
      cell.border = {
        top: isTotal ? doubleB : borderThin,
        bottom: isTotal ? doubleB : borderThin,
        left: borderThin,
        right: borderThin
      };
      if (isTotal) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      } else if (r % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  }

  // Table 3 formatting
  for (let r = 10; r <= 14; r++) {
    ['I', 'J', 'K', 'L'].forEach(col => {
      const cell = summarySheet.getCell(`${col}${r}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        bottom: borderThin,
        left: borderThin,
        right: borderThin
      };
      if (r % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  }

  // Explicit Widths for Ringkasan sheet
  summarySheet.getColumn('A').width = 22;
  summarySheet.getColumn('B').width = 12;
  summarySheet.getColumn('C').width = 18;
  summarySheet.getColumn('D').width = 4;
  summarySheet.getColumn('E').width = 24;
  summarySheet.getColumn('F').width = 12;
  summarySheet.getColumn('G').width = 18;
  summarySheet.getColumn('H').width = 4;
  summarySheet.getColumn('I').width = 8;
  summarySheet.getColumn('J').width = 26;
  summarySheet.getColumn('K').width = 10;
  summarySheet.getColumn('L').width = 18;


  // --- SHEET 2: DETAIL TRANSAKSI ---
  const detailSheet = workbook.addWorksheet('Detail Transaksi');
  detailSheet.views = [{ showGridLines: true }];

  const headers = ['No. Transaksi', 'Tanggal', 'Tipe / Sumber', 'Subtotal', 'Diskon', 'Total', 'Metode Bayar'];
  const headerRow = detailSheet.addRow(headers);
  headerRow.height = 24;

  headerRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    cell.alignment = { vertical: 'middle', horizontal: colNum === 1 || colNum === 2 || colNum === 7 ? 'center' : colNum === 3 ? 'left' : 'right' };
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

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(4).numFmt = '"Rp "#,##0';

    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(5).numFmt = '"Rp "#,##0';

    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).numFmt = '"Rp "#,##0';
    row.getCell(6).font = { bold: true, color: { argb: 'FF065F46' } };

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

  // Autofit detailSheet
  detailSheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell && column.eachCell({ includeEmpty: true }, (cell) => {
      let valueStr = '';
      if (cell.value !== null && cell.value !== undefined) {
        if (cell.numFmt && cell.numFmt.includes('"Rp"')) {
          valueStr = `Rp ${Number(cell.value).toLocaleString('id-ID')}`;
        } else {
          valueStr = String(cell.value);
        }
      }
      maxLen = Math.max(maxLen, valueStr.length);
    });
    column.width = Math.max(maxLen + 4, 14);
  });


  // --- SHEET 3: DETAIL ITEM TERJUAL ---
  const itemSheet = workbook.addWorksheet('Detail Item Terjual');
  itemSheet.views = [{ showGridLines: true }];

  const itemHeaders = ['No. Transaksi', 'Tanggal', 'Nama Produk', 'Harga Satuan', 'Qty', 'Diskon Item', 'Subtotal'];
  const itemHeaderRow = itemSheet.addRow(itemHeaders);
  itemHeaderRow.height = 24;

  itemHeaderRow.eachCell((cell, colNum) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    cell.alignment = { vertical: 'middle', horizontal: colNum === 1 || colNum === 2 || colNum === 5 ? 'center' : colNum === 3 ? 'left' : 'right' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });

  soldItems.sort((a, b) => b.date - a.date).forEach((item, idx) => {
    const formattedDate = format(item.date, 'yyyy-MM-dd HH:mm:ss');
    const row = itemSheet.addRow([
      item.transactionId.substring(0, 8).toUpperCase(),
      formattedDate,
      item.productName,
      item.price,
      item.qty,
      item.discount,
      item.subtotal
    ]);
    row.height = 20;

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(4).numFmt = '"Rp "#,##0';
    
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).numFmt = '"Rp "#,##0';
    
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).numFmt = '"Rp "#,##0';
    row.getCell(7).font = { bold: true, color: { argb: 'FF0F172A' } };

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

  // Autofit itemSheet
  itemSheet.columns.forEach((column) => {
    let maxLen = 0;
    column.eachCell && column.eachCell({ includeEmpty: true }, (cell) => {
      let valueStr = '';
      if (cell.value !== null && cell.value !== undefined) {
        if (cell.numFmt && cell.numFmt.includes('"Rp"')) {
          valueStr = `Rp ${Number(cell.value).toLocaleString('id-ID')}`;
        } else {
          valueStr = String(cell.value);
        }
      }
      maxLen = Math.max(maxLen, valueStr.length);
    });
    column.width = Math.max(maxLen + 4, 12);
  });

  // Generate XLSX Buffer and trigger Browser Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const fileStart = startDate || 'semua_waktu';
  const fileEnd = endDate || 'semua_waktu';
  link.download = `laporan_penjualan_${fileStart}_to_${fileEnd}.xlsx`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
