import { useState, useEffect, useMemo } from "react";
import { useCollection } from "@/hooks/useCollection";
import { useNavigate } from "react-router";
import { 
  ArrowLeft, Truck, Fuel, Wrench, Gauge, DollarSign, 
  ChevronRight, FileDown, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Calendar
} from "lucide-react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { imageSrc } from "@/lib/uploadImage";
import { displayWoNumber } from "@/lib/workOrderNumber";
import { useDialogs } from "@/components/Dialogs";
import { db } from "@/lib/firebase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface TruckDoc {
  id: string;
  fleetId: string;
  brand: string;
  model: string;
  year: number;
  currentKm: string;
  status: string;
  imageUrl?: string;
  imageBase64?: string;
}

interface FuelDoc {
  id: string;
  truckId: string;
  fuelDate: string;
  liters: string;
  totalCost: string;
  efficiency: string;
  kmAtRefuel?: string;
}

interface MaintDoc {
  id: string;
  truckId: string;
  /** Número da ordem de serviço. Registros antigos não têm — displayWoNumber
   *  cai no código derivado do identificador nesse caso. */
  woNumber?: string;
  type?: string;
  maintenanceType?: string;
  title?: string;
  cost: any;
  partsCost?: any;
  date?: any;
  status: string;
}

interface DayEntry {
  day: number;
  truck: string;
  fuel: number;
  maintenance: number;
  parts: number;
  miles: number;
  avgFuelEff: number;
  fuelRecords: FuelDoc[];
}

interface MonthData {
  month: string;
  monthIndex: number;
  days: DayEntry[];
  totals: {
    fuel: number;
    maintenance: number;
    parts: number;
    miles: number;
    avgFuelEff: number;
  };
}

interface YearData {
  year: number;
  months: MonthData[];
  yearTotals: {
    fuel: number;
    maintenance: number;
    parts: number;
    miles: number;
    avgFuelEff: number;
  };
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function safeNum(value: any): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function cpmColor(cpm: number): string {
  if (cpm <= 0.8) return "#22c55e";
  if (cpm <= 1.5) return "#e8a838";
  return "#ef4444";
}

function formatAny(value: any): string {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value.toDate === "function") {
    try { return value.toDate().toLocaleDateString("en-US"); } catch { return "-"; }
  }
  return String(value);
}

function parseDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Timestamp) return dateVal.toDate();
  if (typeof dateVal === "string") {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }
  if (dateVal instanceof Date) return dateVal;
  return null;
}

export default function Reports() {
  const navigate = useNavigate();
  const { data: trucks, isLoading: trucksLoading } = useCollection<TruckDoc>("trucks");
  const { notify } = useDialogs();
  const { data: allFuel } = useCollection<FuelDoc>("fuelRecords");
  const { data: allMaint } = useCollection<MaintDoc>("maintenance");
  const [selectedTruck, setSelectedTruck] = useState<TruckDoc | null>(null);
  const [truckFuel, setTruckFuel] = useState<FuelDoc[]>([]);
  const [truckMaint, setTruckMaint] = useState<MaintDoc[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<YearData[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Filtro de período do relatório de um caminhão. Sem ele, as listas de
  // abastecimento e manutenção mostravam o histórico inteiro de uma vez.
  const [period, setPeriod] = useState<"all" | "day" | "month" | "year">("all");
  const [dayValue, setDayValue] = useState("");
  const [monthValue, setMonthValue] = useState("");
  const [yearValue, setYearValue] = useState("");

  useEffect(() => {
    if (!selectedTruck) {
      setTruckFuel([]);
      setTruckMaint([]);
      setPdfData([]);
      setErrorMsg(null);
      return;
    }

    const loadDetails = async () => {
      setLoadingDetails(true);
      setErrorMsg(null);
      try {
        const fuelQuery = query(collection(db, "fuelRecords"), where("truckId", "==", selectedTruck.id));
        const fuelSnap = await getDocs(fuelQuery);
        const fuelData = fuelSnap.docs.map(d => ({ id: d.id, ...d.data() } as FuelDoc));
        setTruckFuel(fuelData.sort((a, b) => {
          const da = a.fuelDate ? new Date(a.fuelDate).getTime() : 0;
          const db = b.fuelDate ? new Date(b.fuelDate).getTime() : 0;
          return db - da;
        }));

        const maintQuery = query(collection(db, "maintenance"), where("truckId", "==", selectedTruck.id));
        const maintSnap = await getDocs(maintQuery);
        const maintData = maintSnap.docs.map(d => ({ id: d.id, ...d.data() } as MaintDoc));
        setTruckMaint(maintData.sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        }));

        await buildPDFData(selectedTruck.id, selectedTruck.fleetId, fuelData, maintData);
      } catch (err: any) {
        console.error("Error loading truck details:", err);
        setErrorMsg(err.message || "Error loading data");
      } finally {
        setLoadingDetails(false);
      }
    };

    loadDetails();
  }, [selectedTruck]);

  const buildPDFData = async (
    truckId: string,
    truckName: string,
    fuelRecords: FuelDoc[],
    maintRecords: MaintDoc[]
  ) => {
    const yearsMap = new Map<number, Map<number, Map<number, DayEntry>>>();

    fuelRecords.forEach(f => {
      const date = parseDate(f.fuelDate);
      if (!date) return;
      const y = date.getFullYear();
      const m = date.getMonth();
      const day = date.getDate();
      if (!yearsMap.has(y)) yearsMap.set(y, new Map());
      if (!yearsMap.get(y)!.has(m)) yearsMap.get(y)!.set(m, new Map());
      
      const ex = yearsMap.get(y)!.get(m)!.get(day);
      const cost = safeNum(f.totalCost);
      const miles = safeNum(f.kmAtRefuel);
      const eff = safeNum(f.efficiency);
      
      if (ex) {
        ex.fuel += cost;
        ex.miles = Math.max(ex.miles, miles);
        ex.fuelRecords.push(f);
        const totalEff = ex.fuelRecords.reduce((sum, r) => sum + safeNum(r.efficiency), 0);
        ex.avgFuelEff = ex.fuelRecords.length > 0 ? totalEff / ex.fuelRecords.length : 0;
      } else {
        yearsMap.get(y)!.get(m)!.set(day, {
          day, truck: truckName, fuel: cost, maintenance: 0, parts: 0, miles, 
          avgFuelEff: eff,
          fuelRecords: [f]
        });
      }
    });

    maintRecords.forEach(m => {
      const date = parseDate(m.date);
      if (!date) return;
      const y = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      if (!yearsMap.has(y)) yearsMap.set(y, new Map());
      if (!yearsMap.get(y)!.has(month)) yearsMap.get(y)!.set(month, new Map());
      
      const ex = yearsMap.get(y)!.get(month)!.get(day);
      const maintCost = safeNum(m.cost);
      const partsCost = safeNum(m.partsCost);
      
      if (ex) {
        ex.maintenance += maintCost;
        ex.parts += partsCost;
      } else {
        yearsMap.get(y)!.get(month)!.set(day, {
          day, truck: truckName, fuel: 0, maintenance: maintCost, parts: partsCost, miles: 0, 
          avgFuelEff: 0,
          fuelRecords: []
        });
      }
    });

    const result: YearData[] = [];
    Array.from(yearsMap.keys()).sort((a, b) => b - a).forEach(year => {
      const monthsMap = yearsMap.get(year)!;
      const months: MonthData[] = [];
      
      Array.from(monthsMap.keys()).sort((a, b) => a - b).forEach(mi => {
        const daysMap = monthsMap.get(mi)!;
        const days = Array.from(daysMap.values()).sort((a, b) => a.day - b.day);
        
        const totals = days.reduce((acc, d) => ({
          fuel: acc.fuel + d.fuel,
          maintenance: acc.maintenance + d.maintenance,
          parts: acc.parts + d.parts,
          miles: acc.miles + d.miles,
          avgFuelEff: acc.avgFuelEff + d.avgFuelEff
        }), { fuel: 0, maintenance: 0, parts: 0, miles: 0, avgFuelEff: 0 });
        
        const daysWithEff = days.filter(d => d.avgFuelEff > 0);
        if (daysWithEff.length > 0) {
          totals.avgFuelEff = daysWithEff.reduce((s, d) => s + d.avgFuelEff, 0) / daysWithEff.length;
        } else {
          totals.avgFuelEff = 0;
        }
        
        months.push({ month: monthNames[mi], monthIndex: mi, days, totals });
      });
      
      const yearTotals = months.reduce((acc, m) => ({
        fuel: acc.fuel + m.totals.fuel,
        maintenance: acc.maintenance + m.totals.maintenance,
        parts: acc.parts + m.totals.parts,
        miles: acc.miles + m.totals.miles,
        avgFuelEff: acc.avgFuelEff + m.totals.avgFuelEff
      }), { fuel: 0, maintenance: 0, parts: 0, miles: 0, avgFuelEff: 0 });
      
      const monthsWithEff = months.filter(m => m.totals.avgFuelEff > 0);
      if (monthsWithEff.length > 0) {
        yearTotals.avgFuelEff = monthsWithEff.reduce((s, m) => s + m.totals.avgFuelEff, 0) / monthsWithEff.length;
      } else {
        yearTotals.avgFuelEff = 0;
      }
      
      result.push({ year, months, yearTotals });
    });

    setPdfData(result);
  };

  const generatePDF = async () => {
    if (!pdfData.length) return;
    if (!pdfDataForPeriod.length) {
      notify("No records in the selected period / Nenhum registro no período", "warning");
      return;
    }
    setPdfLoading(true);
    try {
      const doc = new jsPDF("landscape", "pt", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let currentY = 40;
      const truckName = selectedTruck?.fleetId || "Truck";

      doc.setFillColor(20, 83, 45);
      doc.rect(0, 0, pageWidth, 60, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("FleetPulse - Detailed Report", 40, 38);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Truck: ${truckName}`, 40, 55);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US")}`, pageWidth - 200, 55);
      doc.setFont("helvetica", "bold");
      doc.text(`Period: ${periodLabel}`, 40, 72);
      doc.setFont("helvetica", "normal");
      currentY = 92;

      // ===== SUMMARY =====
      // O PDF exporta o mesmo período que está na tela: resumo, tabelas e
      // nome do arquivo. Assim o papel nunca discorda do que você viu.
      const pdfFuelCost = totalFuelCost;
      const pdfMaintCost = totalMaintCost;
      const pdfMiles = totalMiles;

      const cpmPdf = pdfMiles > 0 ? (pdfFuelCost + pdfMaintCost) / pdfMiles : 0;
      const fuelCpmPdf = pdfMiles > 0 ? pdfFuelCost / pdfMiles : 0;
      const maintCpmPdf = pdfMiles > 0 ? pdfMaintCost / pdfMiles : 0;

      const boxW = (pageWidth - 90) / 4;
      const statBoxes = [
        { label: "TOTAL MILES", value: pdfMiles.toLocaleString() + " mi" },
        { label: "FUEL COST", value: "$" + pdfFuelCost.toFixed(2) },
        { label: "MAINT. COST", value: "$" + pdfMaintCost.toFixed(2) },
        { label: "TOTAL COST", value: "$" + (pdfFuelCost + pdfMaintCost).toFixed(2) },
      ];
      statBoxes.forEach((b, i) => {
        const x = 30 + i * (boxW + 10);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(209, 213, 219);
        doc.roundedRect(x, currentY, boxW, 34, 3, 3, "FD");
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(b.label, x + 8, currentY + 12);
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(b.value, x + 8, currentY + 27);
      });
      currentY += 42;

      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(232, 168, 56);
      doc.roundedRect(30, currentY, pageWidth - 60, 30, 3, 3, "FD");
      doc.setTextColor(146, 64, 14);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("COST PER MILE:", 40, currentY + 19);
      doc.setFontSize(14);
      doc.text(pdfMiles > 0 ? "$" + cpmPdf.toFixed(2) + "/mi" : "-", 140, currentY + 19);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Fuel: " + (pdfMiles > 0 ? "$" + fuelCpmPdf.toFixed(2) + "/mi" : "-"), 240, currentY + 19);
      doc.text("Maint: " + (pdfMiles > 0 ? "$" + maintCpmPdf.toFixed(2) + "/mi" : "-"), 330, currentY + 19);
      doc.text("Avg MPG: " + avgMPG.toFixed(1), 440, currentY + 19);
      doc.text("Refuels: " + visibleFuel.length, 540, currentY + 19);
      doc.text("Oil Changes: " + oilChanges.length, 630, currentY + 19);
      currentY += 42;

      pdfDataForPeriod.forEach((yearData) => {
        if (currentY > pageHeight - 100) {
          doc.addPage();
          currentY = 40;
        }

        doc.setFillColor(22, 163, 74);
        doc.rect(30, currentY, pageWidth - 60, 28, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`${yearData.year}`, 45, currentY + 19);
        doc.setFontSize(10);
        const colPositions = [200, 300, 400, 500, 600, 700];
        const yearLabels = ["Fuel", "Maint.", "Parts", "Miles", "Avg MPG"];
        const yearValues = [
          `$${yearData.yearTotals.fuel.toFixed(2)}`,
          `$${yearData.yearTotals.maintenance.toFixed(2)}`,
          `$${yearData.yearTotals.parts.toFixed(2)}`,
          `${yearData.yearTotals.miles.toLocaleString()}`,
          `${yearData.yearTotals.avgFuelEff.toFixed(1)}`
        ];
        yearLabels.forEach((label, i) => {
          doc.setFont("helvetica", "bold");
          doc.text(label, colPositions[i], currentY + 12);
          doc.setFont("helvetica", "normal");
          doc.text(yearValues[i], colPositions[i], currentY + 24);
        });
        currentY += 32;

        yearData.months.forEach((monthData) => {
          if (currentY > pageHeight - 80) {
            doc.addPage();
            currentY = 40;
          }

          doc.setFillColor(240, 253, 244);
          doc.rect(30, currentY, pageWidth - 60, 22, "F");
          doc.setDrawColor(209, 213, 219);
          doc.rect(30, currentY, pageWidth - 60, 22, "S");
          doc.setTextColor(20, 83, 45);
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text(`  ${monthData.month}`, 45, currentY + 15);
          const monthValues = [
            `$${monthData.totals.fuel.toFixed(2)}`,
            `$${monthData.totals.maintenance.toFixed(2)}`,
            `$${monthData.totals.parts.toFixed(2)}`,
            `${monthData.totals.miles.toLocaleString()}`,
            `${monthData.totals.avgFuelEff.toFixed(1)}`
          ];
          doc.setFont("helvetica", "normal");
          doc.setTextColor(55, 65, 81);
          monthValues.forEach((val, i) => {
            doc.text(val, colPositions[i], currentY + 15);
          });
          currentY += 24;

          if (monthData.days.length > 0) {
            const tableHeaders = ["Day", "Truck", "Fuel ($)", "Maint. ($)", "Parts ($)", "Miles", "Avg MPG"];
            const tableBody = monthData.days.map(day => [
              day.day.toString(),
              day.truck,
              `$${day.fuel.toFixed(2)}`,
              `$${day.maintenance.toFixed(2)}`,
              `$${day.parts.toFixed(2)}`,
              day.miles.toLocaleString(),
              day.avgFuelEff > 0 ? day.avgFuelEff.toFixed(1) : "-"
            ]);

            autoTable(doc, {
              startY: currentY,
              margin: { left: 50, right: 40 },
              head: [tableHeaders],
              body: tableBody,
              theme: "plain",
              headStyles: {
                fillColor: [22, 163, 74],
                textColor: [255, 255, 255],
                fontSize: 9,
                fontStyle: "bold",
                halign: "center",
                cellPadding: 4
              },
              bodyStyles: {
                fontSize: 9,
                textColor: [55, 65, 81],
                cellPadding: 3,
                halign: "center"
              },
              alternateRowStyles: { fillColor: [249, 250, 251] },
              columnStyles: {
                0: { halign: "center", cellWidth: 40 },
                1: { halign: "left", cellWidth: 100 },
                2: { halign: "right", cellWidth: 70 },
                3: { halign: "right", cellWidth: 70 },
                4: { halign: "right", cellWidth: 70 },
                5: { halign: "right", cellWidth: 70 },
                6: { halign: "right", cellWidth: 90 }
              },
              styles: { lineColor: [209, 213, 219], lineWidth: 0.5 }
            });
            currentY = (doc as any).lastAutoTable.finalY + 8;
          }
        });
        currentY += 15;
      });

      // ===== ORDENS DE SERVIÇO DO PERÍODO =====
      // As tabelas acima somam por dia; aqui vai o detalhe linha a linha, com
      // o número da ordem — é por ele que se procura o serviço depois.
      if (visibleMaint.length > 0) {
        if (currentY > pageHeight - 140) {
          doc.addPage();
          currentY = 40;
        }

        doc.setFillColor(180, 83, 9);
        doc.rect(30, currentY, pageWidth - 60, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("  WORK ORDERS / ORDENS DE SERVIÇO", 45, currentY + 16);
        currentY += 30;

        autoTable(doc, {
          startY: currentY,
          margin: { left: 40, right: 40 },
          head: [["WO #", "Date", "Service", "Status", "Labor ($)", "Parts ($)", "Total ($)"]],
          body: visibleMaint.map((m) => [
            displayWoNumber(m),
            formatAny(m?.date),
            String(m?.title || m?.type || m?.maintenanceType || "General"),
            String(m?.status || "pending").toUpperCase(),
            `$${safeNum(m?.cost).toFixed(2)}`,
            `$${safeNum(m?.partsCost).toFixed(2)}`,
            `$${(safeNum(m?.cost) + safeNum(m?.partsCost)).toFixed(2)}`,
          ]),
          foot: [[
            "", "", "", "TOTAL",
            `$${visibleMaint.reduce((sum, m) => sum + safeNum(m?.cost), 0).toFixed(2)}`,
            `$${visibleMaint.reduce((sum, m) => sum + safeNum(m?.partsCost), 0).toFixed(2)}`,
            `$${totalMaintCost.toFixed(2)}`,
          ]],
          theme: "plain",
          headStyles: {
            fillColor: [217, 119, 6],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: "bold",
            cellPadding: 4,
          },
          bodyStyles: { fontSize: 9, textColor: [55, 65, 81], cellPadding: 3 },
          footStyles: { fontSize: 9, fontStyle: "bold", textColor: [55, 65, 81], fillColor: [253, 246, 234] },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          columnStyles: {
            0: { halign: "left", cellWidth: 70, fontStyle: "bold" },
            1: { halign: "center", cellWidth: 80 },
            2: { halign: "left" },
            3: { halign: "center", cellWidth: 80 },
            4: { halign: "right", cellWidth: 70 },
            5: { halign: "right", cellWidth: 70 },
            6: { halign: "right", cellWidth: 75 },
          },
          styles: { lineColor: [209, 213, 219], lineWidth: 0.5 },
        });
        currentY = (doc as any).lastAutoTable.finalY + 12;
      }

      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(`FleetPulse Report - Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: "center" });
      }

      const periodSlug =
        period === "all" ? "all-time"
        : period === "day" ? dayValue
        : period === "month" ? monthValue
        : yearValue;
      doc.save(`FleetPulse_Report_${truckName.replace(/\\s+/g, "_")}_${periodSlug}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      notify("Error generating PDF: " + (error as Error).message, "error");
    } finally {
      setPdfLoading(false);
    }
  };

  // ===== FILTRO DE PERÍODO =====
  // Uma data pode chegar como texto, Timestamp ou Date; parseDate normaliza.
  const ymdOf = (value: any): string => {
    const d = parseDate(value);
    if (!d) return "";
    return (
      d.getFullYear() +
      "-" + String(d.getMonth() + 1).padStart(2, "0") +
      "-" + String(d.getDate()).padStart(2, "0")
    );
  };

  const inPeriod = (value: any): boolean => {
    if (period === "all") return true;
    const ymd = ymdOf(value);
    if (!ymd) return false;
    if (period === "day") return dayValue ? ymd === dayValue : true;
    if (period === "month") return monthValue ? ymd.slice(0, 7) === monthValue : true;
    return yearValue ? ymd.slice(0, 4) === yearValue : true;
  };

  // Anos que realmente existem nos dados deste caminhão.
  const availableYears = Array.from(
    new Set(
      [
        ...truckFuel.map(f => ymdOf(f.fuelDate).slice(0, 4)),
        ...truckMaint.map(m => ymdOf(m.date).slice(0, 4)),
      ].filter(Boolean)
    )
  ).sort().reverse();

  const visibleFuel = truckFuel.filter(f => inPeriod(f.fuelDate));
  const visibleMaint = truckMaint.filter(m => inPeriod(m.date));

  // Recorta a estrutura ano → mês → dia do PDF para o período escolhido e
  // recalcula os totais com a mesma regra do original: soma os valores e faz
  // média só dos períodos que têm consumo registrado.
  const pdfDataForPeriod: YearData[] = (() => {
    if (period === "all") return pdfData;

    const source = period === "year" ? yearValue : period === "month" ? monthValue : dayValue;
    const wantYear = Number(source.slice(0, 4));
    const wantMonth = period === "all" || period === "year" ? null : Number(source.slice(5, 7));
    const wantDay = period === "day" ? Number(source.slice(8, 10)) : null;
    if (!wantYear) return [];

    const sumDays = (days: DayEntry[]) => {
      const totals = days.reduce(
        (acc, d) => ({
          fuel: acc.fuel + d.fuel,
          maintenance: acc.maintenance + d.maintenance,
          parts: acc.parts + d.parts,
          miles: acc.miles + d.miles,
          avgFuelEff: 0,
        }),
        { fuel: 0, maintenance: 0, parts: 0, miles: 0, avgFuelEff: 0 }
      );
      const withEff = days.filter(d => d.avgFuelEff > 0);
      totals.avgFuelEff = withEff.length > 0
        ? withEff.reduce((sum, d) => sum + d.avgFuelEff, 0) / withEff.length
        : 0;
      return totals;
    };

    return pdfData
      .filter(yd => yd.year === wantYear)
      .map(yd => {
        const months = yd.months
          .filter(md => wantMonth === null || md.monthIndex + 1 === wantMonth)
          .map(md => {
            const days = wantDay === null ? md.days : md.days.filter(d => d.day === wantDay);
            return { ...md, days, totals: sumDays(days) };
          })
          .filter(md => md.days.length > 0);

        const withEff = months.filter(m => m.totals.avgFuelEff > 0);
        return {
          ...yd,
          months,
          yearTotals: {
            fuel: months.reduce((sum, m) => sum + m.totals.fuel, 0),
            maintenance: months.reduce((sum, m) => sum + m.totals.maintenance, 0),
            parts: months.reduce((sum, m) => sum + m.totals.parts, 0),
            miles: months.reduce((sum, m) => sum + m.totals.miles, 0),
            avgFuelEff: withEff.length > 0
              ? withEff.reduce((sum, m) => sum + m.totals.avgFuelEff, 0) / withEff.length
              : 0,
          },
        };
      })
      .filter(yd => yd.months.length > 0);
  })();

  const periodLabel =
    period === "all" ? "All time / Todo o período"
    : period === "day" ? (dayValue ? new Date(dayValue + "T00:00:00").toLocaleDateString("en-US", { dateStyle: "long" }) : "Pick a day")
    : period === "month" ? (monthValue ? new Date(monthValue + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Pick a month")
    : (yearValue || "Pick a year");

  // Milhas rodadas no período. Preferimos a soma das milhas de cada
  // abastecimento; se os registros antigos não tiverem esse campo, cai para a
  // diferença entre o primeiro e o último odômetro do período.
  const totalMiles = (() => {
    if (!selectedTruck) return 0;
    const sumDriven = visibleFuel.reduce((s, f) => s + safeNum((f as any).kmDriven || (f as any).miles), 0);
    if (sumDriven > 0) return sumDriven;
    const sorted = [...visibleFuel].sort((a, b) => {
      const da = a.fuelDate ? new Date(a.fuelDate).getTime() : 0;
      const db = b.fuelDate ? new Date(b.fuelDate).getTime() : 0;
      return da - db;
    });
    if (sorted.length < 2) return 0;
    const firstOdo = safeNum(sorted[0]?.kmAtRefuel);
    const lastOdo = safeNum(sorted[sorted.length - 1]?.kmAtRefuel);
    return Math.max(0, lastOdo - firstOdo);
  })();

  // Os números do topo acompanham o período escolhido — mostrar "total de
  // sempre" ao lado de uma lista filtrada faria a tela mentir.
  const totalFuelCost = visibleFuel.reduce((s, f) => s + safeNum(f.totalCost), 0);
  const avgMPG = visibleFuel.length > 0 
    ? visibleFuel.reduce((s, f) => s + safeNum(f.efficiency), 0) / visibleFuel.length 
    : 0;
  const totalMaintCost = visibleMaint.reduce((s, m) => s + safeNum(m.cost) + safeNum(m.partsCost), 0);
  const oilChanges = visibleMaint.filter(m => 
    (m.type || m.maintenanceType || "").toLowerCase().includes("oil")
  );

  // ===== COST PER MILE - ALL TRUCKS =====
  const cpmDate = (v: any): string => {
    if (!v) return "";
    if (typeof v === "string") return v;
    try {
      const d: Date = v.toDate ? v.toDate() : (v instanceof Date ? v : (typeof v.seconds === "number" ? new Date(v.seconds * 1000) : null as any));
      if (!d || isNaN(d.getTime())) return "";
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    } catch { return ""; }
  };

  const [cpmPeriod, setCpmPeriod] = useState("all");
  // Ordenação da tabela comparativa. Começa pelo custo total, do maior para o
  // menor — é a pergunta mais comum: "qual caminhão está me custando mais?"
  type CpmField = "fleetId" | "fuel" | "maint" | "total" | "miles" | "cpm";
  const [cpmSort, setCpmSort] = useState<{ field: CpmField; dir: "asc" | "desc" }>({
    field: "total",
    dir: "desc",
  });

  const toggleCpmSort = (field: CpmField) => {
    setCpmSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === "desc" ? "asc" : "desc" }
        // Ao trocar de coluna, começa sempre pelo maior (ou por ordem
        // alfabética, no caso do número de frota).
        : { field, dir: field === "fleetId" ? "asc" : "desc" }
    );
  };

  const cpmSortIcon = (field: CpmField) => {
    if (cpmSort.field !== field) return <ArrowUpDown size={13} className="opacity-40" />;
    return cpmSort.dir === "desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} />;
  };

  const cpmMonths = useMemo(() => {
    const set = new Set<string>();
    (allFuel || []).forEach(f => { const d = cpmDate((f as any).fuelDate); if (d.length >= 7) set.add(d.slice(0, 7)); });
    (allMaint || []).forEach(m => { const d = cpmDate((m as any).date || (m as any).serviceDate); if (d.length >= 7) set.add(d.slice(0, 7)); });
    return Array.from(set).sort().reverse();
  }, [allFuel, allMaint]);

  const costPerMileData = useMemo(() => {
    const per: Record<string, { fuel: number; maint: number; miles: number; odoMin: number; odoMax: number }> = {};
    (allFuel || []).forEach(f => {
      if (!f.truckId) return;
      if (cpmPeriod !== "all" && !cpmDate((f as any).fuelDate).startsWith(cpmPeriod)) return;
      if (!per[f.truckId]) per[f.truckId] = { fuel: 0, maint: 0, miles: 0, odoMin: Infinity, odoMax: 0 };
      const p = per[f.truckId];
      p.fuel += safeNum(f.totalCost);
      const driven = safeNum((f as any).kmDriven || (f as any).miles);
      if (driven > 0) p.miles += driven;
      const odo = safeNum(f.kmAtRefuel);
      if (odo > 0) { p.odoMin = Math.min(p.odoMin, odo); p.odoMax = Math.max(p.odoMax, odo); }
    });
    (allMaint || []).forEach(m => {
      if (!m.truckId) return;
      if (cpmPeriod !== "all" && !cpmDate((m as any).date || (m as any).serviceDate).startsWith(cpmPeriod)) return;
      if (!per[m.truckId]) per[m.truckId] = { fuel: 0, maint: 0, miles: 0, odoMin: Infinity, odoMax: 0 };
      per[m.truckId].maint += safeNum(m.cost) + safeNum(m.partsCost);
    });
    return (trucks || []).map(t => {
      const p = per[t.id] || { fuel: 0, maint: 0, miles: 0, odoMin: Infinity, odoMax: 0 };
      const miles = p.miles > 0 ? p.miles : (p.odoMax > 0 && p.odoMin !== Infinity ? p.odoMax - p.odoMin : 0);
      const total = p.fuel + p.maint;
      const cpm = miles > 0 ? total / miles : 0;
      return { truck: t, fuel: p.fuel, maint: p.maint, miles, total, cpm };
    }).filter(r => r.total > 0 || r.miles > 0)
      .sort((a, b) => {
        const dir = cpmSort.dir === "desc" ? -1 : 1;
        if (cpmSort.field === "fleetId") {
          return (a.truck.fleetId || "").localeCompare(b.truck.fleetId || "", undefined, { numeric: true }) * dir;
        }
        return ((a[cpmSort.field] as number) - (b[cpmSort.field] as number)) * dir;
      });
  }, [trucks, allFuel, allMaint, cpmPeriod, cpmSort]);

  // Somatório da frota no período selecionado, para o rodapé da tabela.
  const cpmTotals = useMemo(() => {
    return costPerMileData.reduce(
      (acc, r) => ({
        fuel: acc.fuel + r.fuel,
        maint: acc.maint + r.maint,
        total: acc.total + r.total,
        miles: acc.miles + r.miles,
      }),
      { fuel: 0, maint: 0, total: 0, miles: 0 }
    );
  }, [costPerMileData]);

  if (!selectedTruck) {
    return (
      <div className="space-y-6">
        <div>
          <button onClick={() => navigate("/")} className="flex items-center gap-1 text-sm mb-2" style={{ color: "var(--accent-amber)" }}>
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            Reports
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Select a truck to view detailed report</p>
        </div>

        {trucksLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(trucks || []).length > 0 ? trucks.map((truck) => (
              <button
                key={truck?.id || Math.random()}
                onClick={() => truck && setSelectedTruck(truck)}
                className="glass-card p-5 text-left hover:scale-[1.02] transition-all duration-200 group"
                style={{ border: "1px solid var(--border-divider)" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center justify-center rounded-xl overflow-hidden" style={{ width: 48, height: 48, background: "rgba(232, 168, 56, 0.1)" }}>
                    {imageSrc(truck?.imageUrl, truck?.imageBase64) ? (
                      <img src={imageSrc(truck?.imageUrl, truck?.imageBase64)} alt={truck.fleetId} className="w-full h-full object-cover" />
                    ) : (
                      <Truck size={24} style={{ color: "var(--accent-amber)" }} />
                    )}
                  </div>
                  <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--accent-green)" }} />
                </div>
                <h3 className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>{truck?.fleetId || "N/A"}</h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{truck?.brand || ""} {truck?.model || ""}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{truck?.year || "-"} • {safeNum(truck?.currentKm).toLocaleString()} mi</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                    truck?.status === "active" ? "bg-green-900/30 text-green-400" : 
                    truck?.status === "maintenance" ? "bg-amber-900/30 text-amber-400" : "bg-red-900/30 text-red-400"
                  }`}>
                    {(truck?.status || "ACTIVE").toUpperCase()}
                  </span>
                </div>
              </button>
            )) : (
              <div className="col-span-full text-center py-16 glass-card">
                <Truck size={48} className="mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
                <p style={{ color: "var(--text-muted)" }}>No trucks found</p>
              </div>
            )}
          </div>
        )}

        {/* Cost per Mile - All Trucks / Custo por Milha */}
        {costPerMileData.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="p-5 flex items-center gap-2 mb-2">
              <DollarSign size={18} style={{ color: "var(--accent-amber)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Cost per Mile / Custo por Milha</h2>
              <span className="ml-auto text-xs px-2 py-1 rounded-md hidden sm:inline" style={{ background: "rgba(232,168,56,0.15)", color: "var(--accent-amber)" }}>fuel + maintenance / miles</span>
              <select value={cpmPeriod} onChange={(e) => setCpmPeriod(e.target.value)} className="glass-input text-sm" style={{ color: "var(--text-primary)", padding: "6px 10px" }}>
                <option value="all">All time / Todo o periodo</option>
                {cpmMonths.map(m => {
                  const parts = m.split("-");
                  const label = new Date(Number(parts[0]), Number(parts[1]) - 1).toLocaleString("en-US", { month: "short", year: "numeric" });
                  return <option key={m} value={m}>{label}</option>;
                })}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                    {([
                      { field: "fleetId", label: "Truck" },
                      { field: "fuel", label: "Fuel" },
                      { field: "maint", label: "Maintenance" },
                      { field: "total", label: "Total" },
                      { field: "miles", label: "Miles" },
                      { field: "cpm", label: "$/Mile" },
                    ] as { field: CpmField; label: string }[]).map(col => (
                      <th
                        key={col.field}
                        onClick={() => toggleCpmSort(col.field)}
                        className="text-left px-4 py-3 text-sm font-medium select-none cursor-pointer whitespace-nowrap"
                        style={{ color: cpmSort.field === col.field ? "var(--accent-amber)" : "var(--text-muted)" }}
                        title="Click to sort / Clique para ordenar"
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label} {cpmSortIcon(col.field)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costPerMileData.map(r => (
                    <tr key={r.truck.id} onClick={() => setSelectedTruck(r.truck)} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)", cursor: "pointer" }}>
                      <td className="px-4 py-3"><span className="mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>#{r.truck.fleetId}</span> <span className="text-xs" style={{ color: "var(--text-muted)" }}>{r.truck.brand} {r.truck.model}</span></td>
                      <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>${r.fuel.toFixed(2)}</td>
                      <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>${r.maint.toFixed(2)}</td>
                      <td className="px-4 py-3 mono-font text-sm font-medium" style={{ color: "var(--text-primary)" }}>${r.total.toFixed(2)}</td>
                      <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>{r.miles > 0 ? r.miles.toLocaleString() + " mi" : "-"}</td>
                      <td className="px-4 py-3">
                        {r.miles > 0 ? (
                          <span className="mono-font text-sm font-bold px-2 py-1 rounded-md" style={{ background: cpmColor(r.cpm) + "20", color: cpmColor(r.cpm) }}>${r.cpm.toFixed(2)}/mi</span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>no miles</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Fleet total / Total da frota
                    </td>
                    <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>${cpmTotals.fuel.toFixed(2)}</td>
                    <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>${cpmTotals.maint.toFixed(2)}</td>
                    <td className="px-4 py-3 mono-font text-sm font-bold" style={{ color: "var(--accent-amber)" }}>${cpmTotals.total.toFixed(2)}</td>
                    <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>
                      {cpmTotals.miles > 0 ? cpmTotals.miles.toLocaleString() + " mi" : "-"}
                    </td>
                    <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>
                      {cpmTotals.miles > 0 ? "$" + (cpmTotals.total / cpmTotals.miles).toFixed(2) + "/mi" : "-"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loadingDetails) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={() => setSelectedTruck(null)} style={{ color: "#e8a838", marginBottom: 16 }}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 12, padding: 24 }}>
          <h2 style={{ color: "#ef4444", marginBottom: 8 }}>Error loading data</h2>
          <p style={{ color: "#fca5a5" }}>{errorMsg}</p>
          <button 
            onClick={() => setSelectedTruck(selectedTruck)} 
            style={{ marginTop: 16, padding: "8px 16px", background: "#e8a838", color: "#1a1a1a", borderRadius: 8 }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => setSelectedTruck(null)} 
            className="flex items-center gap-1 text-sm mb-2" 
            style={{ color: "var(--accent-amber)" }}
          >
            <ArrowLeft size={16} /> Select Another Truck
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-xl overflow-hidden" style={{ width: 56, height: 56, background: "rgba(232, 168, 56, 0.1)" }}>
              {imageSrc(selectedTruck?.imageUrl, selectedTruck?.imageBase64) ? (
                <img src={imageSrc(selectedTruck?.imageUrl, selectedTruck?.imageBase64)} alt={selectedTruck.fleetId} className="w-full h-full object-cover" />
              ) : (
                <Truck size={28} style={{ color: "var(--accent-amber)" }} />
              )}
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-semibold mono-font" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                {selectedTruck?.fleetId || "N/A"}
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
                {selectedTruck?.brand || ""} {selectedTruck?.model || ""} • {selectedTruck?.year || "-"} • {safeNum(selectedTruck?.currentKm).toLocaleString()} mi
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={generatePDF}
          disabled={pdfLoading || pdfDataForPeriod.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all"
          style={{
            background: pdfLoading || pdfDataForPeriod.length === 0 ? "rgba(74,155,106,0.3)" : "var(--accent-green)",
            color: "#fff",
            cursor: pdfLoading || pdfDataForPeriod.length === 0 ? "not-allowed" : "pointer",
            opacity: pdfLoading || pdfDataForPeriod.length === 0 ? 0.6 : 1
          }}
        >
          {pdfLoading ? (
            <><Loader2 size={16} className="animate-spin" /> Generating...</>
          ) : (
            <><FileDown size={16} /> Export PDF</>
          )}
        </button>
      </div>

      {/* Período do relatório */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: "var(--text-muted)" }}>
          <Calendar size={14} /> Period / Período
        </span>

        {([
          { key: "all", label: "All / Tudo" },
          { key: "day", label: "Day / Dia" },
          { key: "month", label: "Month / Mês" },
          { key: "year", label: "Year / Ano" },
        ] as { key: typeof period; label: string }[]).map(opt => (
          <button
            key={opt.key}
            onClick={() => {
              setPeriod(opt.key);
              // Já entra com um valor razoável, para a lista não vir vazia.
              const now = new Date();
              const today =
                now.getFullYear() +
                "-" + String(now.getMonth() + 1).padStart(2, "0") +
                "-" + String(now.getDate()).padStart(2, "0");
              if (opt.key === "day" && !dayValue) setDayValue(today);
              if (opt.key === "month" && !monthValue) setMonthValue(today.slice(0, 7));
              if (opt.key === "year" && !yearValue) setYearValue(availableYears[0] || today.slice(0, 4));
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: period === opt.key ? "var(--accent-amber)" : "var(--bg-secondary)",
              color: period === opt.key ? "#1a1a1a" : "var(--text-secondary)",
              border: "1px solid var(--border-divider)",
            }}
          >
            {opt.label}
          </button>
        ))}

        {period === "day" && (
          <input
            type="date"
            value={dayValue}
            onChange={(e) => setDayValue(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)", colorScheme: "dark" }}
          />
        )}
        {period === "month" && (
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)", colorScheme: "dark" }}
          />
        )}
        {period === "year" && (
          <select
            value={yearValue}
            onChange={(e) => setYearValue(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
          >
            {availableYears.length === 0 && <option value={yearValue}>{yearValue}</option>}
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
          Showing <span style={{ color: "var(--accent-amber)" }}>{periodLabel}</span>
          {" • "}{visibleFuel.length} refuel{visibleFuel.length !== 1 ? "s" : ""}
          {" • "}{visibleMaint.length} maintenance
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(232, 168, 56, 0.1)" }}>
            <Gauge size={20} style={{ color: "var(--accent-amber)" }} />
          </div>
          <div>
            <p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>{totalMiles.toLocaleString()} mi</p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Total Miles</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(74, 155, 106, 0.1)" }}>
            <Fuel size={20} style={{ color: "var(--accent-green)" }} />
          </div>
          <div>
            <p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>${totalFuelCost.toFixed(2)}</p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Fuel Cost</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(196, 120, 42, 0.1)" }}>
            <Wrench size={20} style={{ color: "var(--accent-orange)" }} />
          </div>
          <div>
            <p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>${totalMaintCost.toFixed(2)}</p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Maint. Cost</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 40, height: 40, background: "rgba(139, 92, 246, 0.1)" }}>
            <DollarSign size={20} style={{ color: "#8b5cf6" }} />
          </div>
          <div>
            <p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>${(totalFuelCost + totalMaintCost).toFixed(2)}</p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Total Cost</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold mono-font" style={{ color: "var(--accent-green)" }}>{avgMPG.toFixed(1)}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Avg MPG</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold mono-font" style={{ color: "var(--accent-amber)" }}>{visibleFuel.length}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Refuels</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold mono-font" style={{ color: "var(--accent-orange)" }}>{visibleMaint.length}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Maintenance</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold mono-font" style={{ color: "#8b5cf6" }}>{oilChanges.length}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Oil Changes</p>
        </div>
      </div>

      {/* Cost per Mile / Custo por Milha */}
      <div className="glass-card p-5" style={{ border: "1px solid rgba(232,168,56,0.25)", background: "rgba(232,168,56,0.04)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center rounded-xl" style={{ width: 52, height: 52, background: "rgba(232,168,56,0.12)" }}>
              <DollarSign size={26} style={{ color: "var(--accent-amber)" }} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Cost per Mile / Custo por Milha</p>
              <p className="text-3xl font-bold mono-font" style={{ color: totalMiles > 0 ? cpmColor((totalFuelCost + totalMaintCost) / totalMiles) : "var(--text-muted)" }}>
                {totalMiles > 0 ? "$" + ((totalFuelCost + totalMaintCost) / totalMiles).toFixed(2) : "-"}<span className="text-base font-normal">/mi</span>
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-sm mono-font font-medium" style={{ color: "var(--accent-green)" }}>{totalMiles > 0 ? "$" + (totalFuelCost / totalMiles).toFixed(2) + "/mi" : "-"}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Fuel</p>
            </div>
            <div>
              <p className="text-sm mono-font font-medium" style={{ color: "var(--accent-orange)" }}>{totalMiles > 0 ? "$" + (totalMaintCost / totalMiles).toFixed(2) + "/mi" : "-"}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Maintenance</p>
            </div>
            <div>
              <p className="text-sm mono-font font-medium" style={{ color: "var(--text-secondary)" }}>{totalMiles.toLocaleString()} mi</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Miles driven</p>
            </div>
          </div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>(fuel ${totalFuelCost.toFixed(2)} + maintenance ${totalMaintCost.toFixed(2)}) / {totalMiles.toLocaleString()} miles</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-5 flex items-center gap-2 mb-2">
          <Fuel size={18} style={{ color: "var(--accent-green)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Fuel Records</h2>
          <span className="ml-auto text-xs px-2 py-1 rounded-md bg-green-900/30 text-green-400">{visibleFuel.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Gallons</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Cost</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>MPG</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Miles</th>
              </tr>
            </thead>
            <tbody>
              {visibleFuel.length > 0 ? visibleFuel.map((f, i) => (
                <tr key={f?.id || i} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>{f?.fuelDate || "-"}</td>
                  <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>{safeNum(f?.liters).toFixed(1)} gal</td>
                  <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-primary)" }}>${safeNum(f?.totalCost).toFixed(2)}</td>
                  <td className="px-4 py-3"><span className="mono-font text-sm px-2 py-1 rounded-md" style={{ background: "rgba(74, 155, 106, 0.15)", color: "var(--accent-green)" }}>{safeNum(f?.efficiency).toFixed(1)} MPG</span></td>
                  <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>{f?.kmAtRefuel ? safeNum(f.kmAtRefuel).toLocaleString() + " mi" : "-"}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="text-center py-8" style={{ color: "var(--text-muted)" }}>No fuel records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-5 flex items-center gap-2 mb-2">
          <Wrench size={18} style={{ color: "var(--accent-orange)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Maintenance Records</h2>
          <span className="ml-auto text-xs px-2 py-1 rounded-md bg-amber-900/30 text-amber-400">{visibleMaint.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                <th className="text-left px-4 py-3 text-sm font-medium whitespace-nowrap" style={{ color: "var(--text-muted)" }}>WO #</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Cost</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Parts</th>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleMaint.length > 0 ? visibleMaint.map((m, i) => (
                <tr key={m?.id || i} className="table-row-hover" style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <td className="px-4 py-3 mono-font text-sm whitespace-nowrap" style={{ color: m?.woNumber ? "var(--accent-amber)" : "var(--text-muted)" }}>
                    {displayWoNumber(m)}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>{formatAny(m?.date)}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{m?.title || m?.type || m?.maintenanceType || "General"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                      m?.status === "completed" ? "bg-green-900/30 text-green-400" : 
                      m?.status === "pending" ? "bg-amber-900/30 text-amber-400" : "bg-blue-900/30 text-blue-400"
                    }`}>
                      {(m?.status || "PENDING").toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-primary)" }}>${safeNum(m?.cost).toFixed(2)}</td>
                  <td className="px-4 py-3 mono-font text-sm" style={{ color: "var(--text-secondary)" }}>${safeNum(m?.partsCost).toFixed(2)}</td>
                  <td className="px-4 py-3 mono-font text-sm font-medium" style={{ color: "var(--accent-amber)" }}>${(safeNum(m?.cost) + safeNum(m?.partsCost)).toFixed(2)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: "var(--text-muted)" }}>No maintenance records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}