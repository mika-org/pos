import ExcelJS from 'exceljs';
import { format } from 'date-fns';

export interface SalesReportItem {
  id: string;
  no: string;
  date: number;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  type: string;
}

export interface SalesReportSummary {
  totalRevenue: number;
  totalDiscount: number;
  totalSubtotal: number;
  transactionCount: number;
}

/**
 * Exports the sales report items into a neat, professionally styled Excel spreadsheet.
 */
export const exportSalesReportExcel = async (
  items: SalesReportItem[],
  startDate: string,
  endDate: string,
  summary: SalesReportSummary
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Laporan Penjualan');

  // Enable grid lines
  worksheet.views = [{ showGridLines: true }];

  // 1. Title Block
  worksheet.mergeCells('A1:G1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'RESTOFLOW - LAPORAN PENJUALAN';
  titleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 30;

  // 2. Subtitle Date Range Block
  worksheet.mergeCells('A2:G2');
  const subtitleCell = worksheet.getCell('A2');
  const dateRangeStr = `Periode Laporan: ${format(new Date(startDate), 'dd MMM yyyy')} s/d ${format(new Date(endDate), 'dd MMM yyyy')}`;
  subtitleCell.value = dateRangeStr;
  subtitleCell.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF475569' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(2).height = 20;

  // Spacing row
  worksheet.addRow([]);

  // 3. Summary metrics block
  worksheet.getCell('A4').value = 'RINGKASAN METRIK';
  worksheet.getCell('B4').value = '';
  worksheet.mergeCells('A4:B4');
  
  worksheet.getCell('A5').value = 'Total Penjualan Kotor';
  worksheet.getCell('B5').value = summary.totalSubtotal;
  worksheet.getCell('B5').numFmt = '"Rp "#,##0';
  worksheet.getCell('B5').alignment = { horizontal: 'right' };

  worksheet.getCell('A6').value = 'Total Diskon';
  worksheet.getCell('B6').value = summary.totalDiscount;
  worksheet.getCell('B6').numFmt = '"Rp "#,##0';
  worksheet.getCell('B6').alignment = { horizontal: 'right' };

  worksheet.getCell('A7').value = 'Total Pendapatan Bersih';
  worksheet.getCell('B7').value = summary.totalRevenue;
  worksheet.getCell('B7').numFmt = '"Rp "#,##0';
  worksheet.getCell('B7').alignment = { horizontal: 'right' };

  worksheet.getCell('A8').value = 'Jumlah Transaksi';
  worksheet.getCell('B8').value = summary.transactionCount;
  worksheet.getCell('B8').numFmt = '#,##0" Transaksi"';
  worksheet.getCell('B8').alignment = { horizontal: 'right' };

  // Format and style the Summary Metrik Block
  const thinBorder: ExcelJS.Border = { style: 'thin', color: { argb: 'FFCBD5E1' } };
  for (let r = 4; r <= 8; r++) {
    const cellA = worksheet.getCell(`A${r}`);
    const cellB = worksheet.getCell(`B${r}`);
    
    cellA.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    cellB.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    
    cellA.font = { name: 'Arial', size: 9, bold: r === 4 || r === 7 };
    cellB.font = { name: 'Arial', size: 9, bold: r === 7 };
    
    if (r === 4) {
      cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    } else {
      cellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    }
    
    if (r === 7) {
      cellB.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF16A34A' } }; // Highlight net revenue in green
    }
  }

  // Spacing
  worksheet.addRow([]);
  worksheet.addRow([]);

  // 4. Main Transactions Table Header
  const headerRowNumber = 11;
  const headers = ['No. Transaksi', 'Tanggal & Waktu', 'Tipe / Sumber', 'Subtotal', 'Diskon', 'Total', 'Metode Bayar'];
  worksheet.getRow(headerRowNumber).values = headers;
  worksheet.getRow(headerRowNumber).height = 26;

  const headerFont = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Dark slate slate-900 background
  };

  headers.forEach((_, idx) => {
    const cell = worksheet.getCell(headerRowNumber, idx + 1);
    cell.font = headerFont;
    cell.fill = headerFill as ExcelJS.Fill;
    cell.alignment = { 
      vertical: 'middle', 
      horizontal: idx === 0 || idx === 1 || idx === 6 ? 'center' : idx === 2 ? 'left' : 'right' 
    };
    cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  });

  // 5. Populate Data Rows
  let currentRowNumber = headerRowNumber + 1;
  items.forEach((item, index) => {
    const rowValues = [
      item.no.toUpperCase(),
      format(item.date, 'dd MMM yyyy, HH:mm'),
      item.type,
      item.subtotal,
      item.discount,
      item.total,
      item.paymentMethod
    ];
    worksheet.getRow(currentRowNumber).values = rowValues;
    worksheet.getRow(currentRowNumber).height = 20;

    // Apply Zebra striping and custom formats
    const isEven = index % 2 === 0;
    const rowFillColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    headers.forEach((_, idx) => {
      const cell = worksheet.getCell(currentRowNumber, idx + 1);
      cell.font = { name: 'Arial', size: 9 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowFillColor }
      };
      cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

      // Cell alignments and custom patterns
      if (idx === 0) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
      } else if (idx === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (idx === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (idx === 3 || idx === 4 || idx === 5) {
        cell.numFmt = '"Rp "#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        
        if (idx === 4 && item.discount > 0) {
          cell.font = { name: 'Arial', size: 9, color: { argb: 'FFE11D48' } }; // Highlight discounts in red
        } else if (idx === 5) {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF16A34A' } }; // Highlight positive totals in green
        }
      } else if (idx === 6) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF475569' } };
      }
    });

    currentRowNumber++;
  });

  // 6. Bottom Table Summary Row (SUM formulas)
  worksheet.getRow(currentRowNumber).height = 26;
  worksheet.getCell(`A${currentRowNumber}`).value = 'TOTAL';
  worksheet.mergeCells(`A${currentRowNumber}:C${currentRowNumber}`);

  const startDataRow = headerRowNumber + 1;
  const lastDataRow = currentRowNumber - 1;

  // Assign Excel SUM formulas with the correct calculated results as fallbacks
  worksheet.getCell(`D${currentRowNumber}`).value = { formula: `SUM(D${startDataRow}:D${lastDataRow})`, result: summary.totalSubtotal };
  worksheet.getCell(`E${currentRowNumber}`).value = { formula: `SUM(E${startDataRow}:E${lastDataRow})`, result: summary.totalDiscount };
  worksheet.getCell(`F${currentRowNumber}`).value = { formula: `SUM(F${startDataRow}:F${lastDataRow})`, result: summary.totalRevenue };

  const doubleBottomBorder: ExcelJS.Border = { style: 'double', color: { argb: 'FF0F172A' } };
  const topTotalBorder: ExcelJS.Border = { style: 'thin', color: { argb: 'FF0F172A' } };

  headers.forEach((_, idx) => {
    const cell = worksheet.getCell(currentRowNumber, idx + 1);
    cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' } // slate-200 background
    };
    cell.border = {
      top: topTotalBorder,
      bottom: doubleBottomBorder,
      left: thinBorder,
      right: thinBorder
    };

    if (idx < 3) {
      if (idx === 0) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    } else if (idx === 3 || idx === 4 || idx === 5) {
      cell.numFmt = '"Rp "#,##0';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (idx === 5) {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF15803D' } }; // bold green
      }
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // 7. Explicit Column Width Configuration
  const columnWidths = [18, 22, 24, 16, 14, 16, 16];
  columnWidths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  // 8. Generate XLSX Buffer and trigger Browser Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  const formattedStart = format(new Date(startDate), 'yyyyMMdd');
  const formattedEnd = format(new Date(endDate), 'yyyyMMdd');
  link.download = `laporan_penjualan_${formattedStart}_to_${formattedEnd}.xlsx`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
