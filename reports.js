(function () {
  function requireExcel() {
    if (!window.XLSX) {
      throw new Error("Library SheetJS belum termuat. Pastikan perangkat tersambung internet saat export Excel.");
    }
    return window.XLSX;
  }

  function requirePdf() {
    if (!window.jspdf?.jsPDF) {
      throw new Error("Library jsPDF belum termuat. Pastikan perangkat tersambung internet saat export PDF.");
    }
    return window.jspdf.jsPDF;
  }

  function fileSafeDate(value) {
    return String(value || "").replaceAll("/", "-").replaceAll(" ", "_");
  }

  async function loadImageAsDataUrl(src) {
    try {
      const response = await fetch(src);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      return null;
    }
  }

  function addReportHeader(doc, title, subtitle, logoDataUrl) {
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", 14, 10, 16, 16);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PEMERINTAH PROVINSI NUSA TENGGARA TIMUR", logoDataUrl ? 34 : 14, 15);
    doc.setFontSize(12);
    doc.text("BADAN PENDAPATAN DAN ASET DAERAH", logoDataUrl ? 34 : 14, 21);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Laporan Absensi Apel Pagi", logoDataUrl ? 34 : 14, 26);

    doc.setDrawColor(210);
    doc.line(14, 31, doc.internal.pageSize.getWidth() - 14, 31);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, 14, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(subtitle, 14, 46);
  }

  function addKeyValueRows(doc, rows, startY) {
    let y = startY;
    rows.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 48, y);
      y += 6;
    });
    return y;
  }

  function addSimpleTable(doc, columns, rows, startY, options = {}) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageOrientation = pageWidth > pageHeight ? "landscape" : "portrait";
    const margin = options.margin ?? 14;
    const rowHeight = options.rowHeight ?? 8;
    const widths = options.widths ?? columns.map(() => (pageWidth - margin * 2) / columns.length);
    let y = startY;

    const drawHeader = () => {
      doc.setFillColor(242, 242, 247);
      doc.setDrawColor(220);
      doc.rect(margin, y - 5, pageWidth - margin * 2, rowHeight, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(options.fontSize ?? 8);
      let x = margin + 2;
      columns.forEach((column, index) => {
        doc.text(String(column), x, y);
        x += widths[index];
      });
      y += rowHeight;
    };

    drawHeader();
    doc.setFont("helvetica", "normal");

    rows.forEach((row) => {
      if (y > pageHeight - 16) {
        doc.addPage("a4", pageOrientation);
        y = 18;
        drawHeader();
        doc.setFont("helvetica", "normal");
      }

      let x = margin + 2;
      const rowTop = y - 5;
      doc.setDrawColor(232);
      doc.line(margin, rowTop + rowHeight, pageWidth - margin, rowTop + rowHeight);

      row.forEach((cell, index) => {
        const text = doc.splitTextToSize(String(cell ?? "-"), widths[index] - 4);
        doc.text(text.slice(0, 2), x, y);
        x += widths[index];
      });

      y += rowHeight;
    });

    return y;
  }

  function exportDailyExcel({ date, dateLabel, admin, rows, summary }) {
    const XLSX = requireExcel();
    const workbook = XLSX.utils.book_new();

    const summaryRows = [
      ["Laporan Absensi Apel Pagi BPAD Provinsi NTT"],
      ["Tanggal", dateLabel],
      ["Admin", admin || "-"],
      [],
      ["Total Pegawai", summary.Total],
      ["Kurang", summary.Kurang],
      ["Hadir", summary.Hadir],
      ["Sakit", summary.Sakit],
      ["Izin", summary.Izin],
      ["Cuti", summary.Cuti],
      ["Terlambat", summary.Terlambat],
      ["Tugas", summary.Tugas],
      ["Tubel", summary.Tubel],
      []
    ];

    const detailRows = [
      ["No", "Nama", "Bidang", "Jenis", "Status"],
      ...rows.map((row, index) => [index + 1, row.displayName, row.bidang, row.jenis, row.status])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...summaryRows, ...detailRows]);
    worksheet["!cols"] = [{ wch: 6 }, { wch: 36 }, { wch: 20 }, { wch: 10 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Harian");
    XLSX.writeFile(workbook, `rekap_harian_${fileSafeDate(date)}.xlsx`);
  }

  function exportMonthlyExcel({ month, monthLabel, totalDays, rows }) {
    const XLSX = requireExcel();
    const workbook = XLSX.utils.book_new();
    const worksheetRows = [
      ["Rekap Bulanan Absensi Apel Pagi BPAD Provinsi NTT"],
      ["Bulan", monthLabel],
      ["Jumlah hari tersimpan", totalDays],
      [],
      ["No", "Nama", "Bidang", "Hadir", "Sakit", "Izin", "Cuti", "Terlambat", "Tugas", "Tubel", "Total Tidak Hadir"],
      ...rows.map((row, index) => [
        index + 1,
        row.nama,
        row.bidang,
        row.Hadir,
        row.Sakit,
        row.Izin,
        row.Cuti,
        row.Terlambat,
        row.Tugas,
        row.Tubel,
        row.TotalTidakHadir
      ])
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 38 },
      { wch: 18 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Bulanan");
    XLSX.writeFile(workbook, `rekap_bulanan_${fileSafeDate(month)}.xlsx`);
  }

  async function exportDailyPdf({ date, dateLabel, admin, rows, summary }) {
    const jsPDF = requirePdf();
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const logo = await loadImageAsDataUrl("logontt.png");
    const notedRows = rows.filter((row) => row.status !== "Hadir");

    addReportHeader(doc, "Rekap Harian", `${dateLabel} | Admin: ${admin || "-"}`, logo);
    const yAfterSummary = addKeyValueRows(
      doc,
      [
        ["Total Pegawai", summary.Total],
        ["Kurang", summary.Kurang],
        ["Hadir", summary.Hadir],
        ["Sakit", summary.Sakit],
        ["Izin", summary.Izin],
        ["Cuti", summary.Cuti],
        ["Terlambat", summary.Terlambat],
        ["Tugas", summary.Tugas],
        ["Tubel", summary.Tubel]
      ],
      56
    );

    doc.setFont("helvetica", "bold");
    doc.text("Daftar tidak hadir dan catatan", 14, yAfterSummary + 6);
    addSimpleTable(
      doc,
      ["No", "Nama", "Bidang", "Status"],
      notedRows.length
        ? notedRows.map((row, index) => [index + 1, row.displayName, row.bidang, row.status])
        : [["-", "Tidak ada catatan", "-", "-"]],
      yAfterSummary + 15,
      { widths: [12, 78, 55, 35], rowHeight: 9, fontSize: 8 }
    );

    doc.save(`rekap_harian_${fileSafeDate(date)}.pdf`);
  }

  async function exportMonthlyPdf({ month, monthLabel, totalDays, rows }) {
    const jsPDF = requirePdf();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const logo = await loadImageAsDataUrl("logontt.png");

    addReportHeader(doc, "Rekap Bulanan", `${monthLabel} | ${totalDays} hari tersimpan`, logo);
    addSimpleTable(
      doc,
      ["No", "Nama", "Bidang", "H", "S", "I", "C", "Terl.", "Tugas", "Tubel", "Tidak Hadir"],
      rows.map((row, index) => [
        index + 1,
        row.nama,
        row.bidang,
        row.Hadir,
        row.Sakit,
        row.Izin,
        row.Cuti,
        row.Terlambat,
        row.Tugas,
        row.Tubel,
        row.TotalTidakHadir
      ]),
      56,
      { widths: [10, 58, 34, 13, 13, 13, 13, 17, 18, 18, 28], rowHeight: 8, fontSize: 7 }
    );

    doc.save(`rekap_bulanan_${fileSafeDate(month)}.pdf`);
  }

  function exportDetailMonthlyExcel({ month, monthLabel, scope, totalDays, days }) {
    const XLSX = requireExcel();
    const workbook = XLSX.utils.book_new();

    const sheetRows = [
      ["Detail Kehadiran Bulanan — BPAD Provinsi NTT"],
      ["Bulan", monthLabel],
      ["Scope", scope],
      ["Jumlah hari absensi", totalDays],
      []
    ];

    days.forEach((day) => {
      sheetRows.push([day.dateLabel]);
      sheetRows.push(["Hadir", day.summary.Hadir, "Kurang", day.summary.Kurang]);
      if (day.absentRows.length) {
        sheetRows.push(["No", "Nama", "Bidang", "Status"]);
        day.absentRows.forEach((row, idx) => {
          sheetRows.push([idx + 1, row.displayName, row.bidang, row.status]);
        });
      } else {
        sheetRows.push(["Semua hadir"]);
      }
      sheetRows.push([]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet["!cols"] = [{ wch: 6 }, { wch: 38 }, { wch: 22 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detail Bulanan");
    XLSX.writeFile(workbook, `detail_bulanan_${fileSafeDate(month)}.xlsx`);
  }

  async function exportDetailMonthlyPdf({ month, monthLabel, scope, totalDays, days }) {
    const jsPDF = requirePdf();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const logo = await loadImageAsDataUrl("logontt.png");

    addReportHeader(doc, "Detail Kehadiran Bulanan", `${monthLabel} | ${scope} | ${totalDays} hari absensi`, logo);

    let y = 56;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    for (const day of days) {
      if (y > pageHeight - 30) {
        doc.addPage("a4", "landscape");
        y = 18;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(day.dateLabel, 14, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Hadir: ${day.summary.Hadir}   Kurang: ${day.summary.Kurang}`, 14, y);
      y += 6;

      if (day.absentRows.length) {
        y = addSimpleTable(
          doc,
          ["No", "Nama", "Bidang", "Status"],
          day.absentRows.map((row, idx) => [idx + 1, row.displayName, row.bidang, row.status]),
          y,
          { widths: [12, 90, 60, 40], rowHeight: 7, fontSize: 7 }
        );
      } else {
        doc.setFont("helvetica", "italic");
        doc.text("Semua hadir.", 14, y);
        y += 6;
      }
      y += 4;
    }

    doc.save(`detail_bulanan_${fileSafeDate(month)}.pdf`);
  }

  window.ReportExporter = {
    exportDailyExcel,
    exportDailyPdf,
    exportMonthlyExcel,
    exportMonthlyPdf,
    exportDetailMonthlyExcel,
    exportDetailMonthlyPdf
  };
})();
