import { useState, useMemo } from "react";
import { useParams, Link } from "react-router";
import { useCollection } from "@/hooks/useCollection";
import { 
  ArrowLeft, Download, Fuel, Wrench, Route, TrendingUp, 
  Calendar, DollarSign, Gauge, BarChart3, PieChart, Truck
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart as RePieChart, Pie, Cell, 
  LineChart, Line, Legend
} from "recharts";

interface FuelDoc {
  id: string; truckId: string; fuelDate: string; liters: string;
  pricePerLiter?: string; totalCost?: string; kmAtRefuel?: string;
  kmPrevious?: string; kmDriven?: string; efficiency?: string;
  driverName?: string; stationName?: string;
}

interface MaintenanceDoc {
  id: string; truckId: string; date: string; type: string;
  description: string; cost: string; status: string;
  mechanic?: string; notes?: string;
}

interface TruckDoc {
  id: string; fleetId: string; brand: string; model: string;
  year: string; plate: string; currentKm: string; status: string;
  vin?: string; engine?: string; color?: string; fuelTank?: string;
}

const COLORS = ["#4a9b6a", "#e8a838", "#c4782a", "#d4a520", "#8b5cf6"];

export default function TruckStats() {
  const { id } = useParams<{ id: string }>();
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  const { data: trucks } = useCollection<TruckDoc>("trucks");
  const { data: fuelRecords } = useCollection<FuelDoc>("fuelRecords");
  const { data: maintenanceRecords } = useCollection<MaintenanceDoc>("maintenance");

  const currentTruck = trucks.find(t => t.id === id);

  // Filtrar registros do caminhão e do ano
  const truckFuel = fuelRecords.filter(r => 
    r.truckId === id && r.fuelDate.startsWith(yearFilter)
  );
  const truckMaint = maintenanceRecords.filter(r => 
    r.truckId === id && r.date.startsWith(yearFilter)
  );

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const totalFuelCost = truckFuel.reduce((s, r) => s + Number(r.totalCost || 0), 0);
    const totalFuelGal = truckFuel.reduce((s, r) => s + Number(r.liters || 0), 0);
    const totalMaintCost = truckMaint.reduce((s, r) => s + Number(r.cost || 0), 0);
    const totalMiles = truckFuel.reduce((s, r) => s + Number(r.kmDriven || 0), 0);
    const avgMPG = truckFuel.length > 0 
      ? (truckFuel.reduce((s, r) => s + Number(r.efficiency || 0), 0) / truckFuel.length).toFixed(1)
      : "0";
    const refuelCount = truckFuel.length;
    const maintCount = truckMaint.length;

    // Custo por milha
    const costPerMile = totalMiles > 0 ? ((totalFuelCost + totalMaintCost) / totalMiles).toFixed(2) : "0";

    // Custo por galão
    const avgFuelPrice = totalFuelGal > 0 ? (totalFuelCost / totalFuelGal).toFixed(2) : "0";

    return {
      totalFuelCost, totalFuelGal, totalMaintCost, totalMiles,
      avgMPG, refuelCount, maintCount,
      grandTotal: totalFuelCost + totalMaintCost,
      costPerMile, avgFuelPrice
    };
  }, [truckFuel, truckMaint]);

  // Dados para gráficos mensais
  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((month, idx) => {
      const monthStr = `${yearFilter}-${String(idx + 1).padStart(2, "0")}`;
      const fuel = truckFuel
        .filter(r => r.fuelDate.startsWith(monthStr))
        .reduce((s, r) => s + Number(r.totalCost || 0), 0);
      const maint = truckMaint
        .filter(r => r.date.startsWith(monthStr))
        .reduce((s, r) => s + Number(r.cost || 0), 0);
      const miles = truckFuel
        .filter(r => r.fuelDate.startsWith(monthStr))
        .reduce((s, r) => s + Number(r.kmDriven || 0), 0);
      return { month, fuel, maint, miles, total: fuel + maint };
    });
  }, [truckFuel, truckMaint, yearFilter]);

  // Dados para gráfico de pizza (custos)
  const pieData = [
    { name: "Fuel", value: stats.totalFuelCost },
    { name: "Maintenance", value: stats.totalMaintCost }
  ].filter(d => d.value > 0);

  // Dados para gráfico de MPG ao longo do tempo
  const mpgData = useMemo(() => {
    return truckFuel
      .sort((a, b) => new Date(a.fuelDate).getTime() - new Date(b.fuelDate).getTime())
      .map(r => ({
        date: r.fuelDate.slice(5), // MM-DD
        mpg: Number(r.efficiency) || 0,
        miles: Number(r.kmDriven) || 0,
        cost: Number(r.totalCost) || 0
      }))
      .filter(d => d.mpg > 0 && d.mpg < 50);
  }, [truckFuel]);

  // Tipos de manutenção para gráfico
  const maintTypes = useMemo(() => {
    const types: Record<string, number> = {};
    truckMaint.forEach(r => {
      types[r.type] = (types[r.type] || 0) + Number(r.cost || 0);
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [truckMaint]);

  // Exportar PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    const truckName = currentTruck ? `${currentTruck.fleetId} - ${currentTruck.brand} ${currentTruck.model}` : "Truck";

    // Título
    doc.setFontSize(20);
    doc.text(`FleetPulse - Annual Report`, 14, 20);
    doc.setFontSize(14);
    doc.text(`${truckName} - ${yearFilter}`, 14, 30);

    // Resumo
    doc.setFontSize(12);
    doc.text("Summary", 14, 45);
    autoTable(doc, {
      startY: 50,
      head: [["Metric", "Value"]],
      body: [
        ["Total Fuel Cost", `$${stats.totalFuelCost.toLocaleString("en-US", {minimumFractionDigits: 2})}`],
        ["Total Fuel (gal)", `${stats.totalFuelGal.toLocaleString("en-US", {maximumFractionDigits: 1})}`],
        ["Total Maintenance", `$${stats.totalMaintCost.toLocaleString("en-US", {minimumFractionDigits: 2})}`],
        ["Total Miles Driven", `${stats.totalMiles.toLocaleString("en-US")}`],
        ["Average MPG", `${stats.avgMPG}`],
        ["Cost per Mile", `$${stats.costPerMile}`],
        ["Avg Fuel Price", `$${stats.avgFuelPrice}/gal`],
        ["Refuel Count", `${stats.refuelCount}`],
        ["Maintenance Count", `${stats.maintCount}`],
        ["Grand Total", `$${stats.grandTotal.toLocaleString("en-US", {minimumFractionDigits: 2})}`],
      ],
      theme: "grid",
      headStyles: { fillColor: [74, 155, 106] }
    });

    // Tabela de Fuel
    if (truckFuel.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [["Date", "Gallons", "Cost", "MPG", "Miles", "Driver"]],
        body: truckFuel.map(r => [
          r.fuelDate,
          r.liters,
          `$${Number(r.totalCost || 0).toFixed(2)}`,
          r.efficiency || "-",
          r.kmDriven || "-",
          r.driverName || "-"
        ]),
        theme: "grid",
        headStyles: { fillColor: [232, 168, 56] }
      });
    }

    // Tabela de Maintenance
    if (truckMaint.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [["Date", "Type", "Description", "Cost", "Status"]],
        body: truckMaint.map(r => [
          r.date,
          r.type,
          r.description,
          `$${Number(r.cost || 0).toFixed(2)}`,
          r.status
        ]),
        theme: "grid",
        headStyles: { fillColor: [196, 120, 42] }
      });
    }

    doc.save(`fleetpulse-${truckName.replace(/\s/g, "-")}-${yearFilter}.pdf`);
  };

  if (!currentTruck) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-2 rounded-full animate-spin" 
               style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} />
          <p className="mt-4" style={{ color: "var(--text-muted)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={`/trucks/${id}`} className="p-2 rounded-lg hover:bg-white/5 transition-colors" 
                style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Truck Statistics
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
              {currentTruck.fleetId} - {currentTruck.brand} {currentTruck.model} • {currentTruck.year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={yearFilter} 
            onChange={(e) => setYearFilter(e.target.value)}
            className="glass-input"
            style={{ color: "var(--text-primary)" }}
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
          <button onClick={exportPDF} className="btn-primary flex items-center gap-2">
            <Download size={18} /> Export PDF
          </button>
        </div>
      </div>

      {/* Stats Cards - Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" 
               style={{ width: 40, height: 40, background: "rgba(232, 168, 56, 0.1)" }}>
            <Fuel size={20} style={{ color: "var(--accent-amber)" }} />
          </div>
          <div>
            <p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>
              ${stats.totalFuelCost.toLocaleString("en-US", {minimumFractionDigits: 2})}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Fuel Cost</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" 
               style={{ width: 40, height: 40, background: "rgba(196, 120, 42, 0.1)" }}>
            <Wrench size={20} style={{ color: "var(--accent-orange)" }} />
          </div>
          <div>
            <p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>
              ${stats.totalMaintCost.toLocaleString("en-US", {minimumFractionDigits: 2})}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Maintenance</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" 
               style={{ width: 40, height: 40, background: "rgba(74, 155, 106, 0.1)" }}>
            <Route size={20} style={{ color: "var(--accent-green)" }} />
          </div>
          <div>
            <p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>
              {stats.totalMiles.toLocaleString("en-US")} mi
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Miles Driven</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" 
               style={{ width: 40, height: 40, background: "rgba(212, 165, 32, 0.1)" }}>
            <TrendingUp size={20} style={{ color: "var(--accent-gold)" }} />
          </div>
          <div>
            <p className="text-lg font-semibold mono-font" style={{ color: "var(--text-primary)" }}>
              {stats.avgMPG} MPG
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Avg Efficiency</p>
          </div>
        </div>
      </div>

      {/* Stats Cards - Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold mono-font" style={{ color: "var(--accent-amber)" }}>
            {stats.refuelCount}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Refuels</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold mono-font" style={{ color: "var(--accent-orange)" }}>
            {stats.maintCount}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Maintenances</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold mono-font" style={{ color: "var(--accent-green)" }}>
            ${stats.costPerMile}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Cost/Mile</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold mono-font" style={{ color: "var(--accent-gold)" }}>
            ${stats.grandTotal.toLocaleString("en-US", {minimumFractionDigits: 0})}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Grand Total</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Costs Bar Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <BarChart3 size={18} style={{ color: "var(--accent-amber)" }} />
            Monthly Costs
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} 
                     tickFormatter={(v) => `$${v}`} />
              <Tooltip 
                contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                labelStyle={{ color: "var(--text-primary)" }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
              />
              <Legend />
              <Bar dataKey="fuel" name="Fuel" fill="var(--accent-amber)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="maint" name="Maintenance" fill="var(--accent-orange)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Distribution Pie Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <PieChart size={18} style={{ color: "var(--accent-green)" }} />
            Cost Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                formatter={(value: number) => `$${value.toFixed(2)}`}
              />
              <Legend />
            </RePieChart>
          </ResponsiveContainer>
        </div>

        {/* MPG Trend Line Chart */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Gauge size={18} style={{ color: "var(--accent-green)" }} />
            MPG Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mpgData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} />
              <Tooltip 
                contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                formatter={(value: number) => [`${value} MPG`, "Efficiency"]}
              />
              <Line type="monotone" dataKey="mpg" stroke="var(--accent-green)" 
                    strokeWidth={2} dot={{ fill: "var(--accent-green)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Miles */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Route size={18} style={{ color: "var(--accent-amber)" }} />
            Monthly Miles
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} />
              <Tooltip 
                contentStyle={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                formatter={(value: number) => [`${value} mi`, "Miles"]}
              />
              <Bar dataKey="miles" fill="var(--accent-amber)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Maintenance Types */}
      {maintTypes.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Wrench size={18} style={{ color: "var(--accent-orange)" }} />
            Maintenance by Type
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {maintTypes.map((type, idx) => (
              <div key={type.name} className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{type.name}</p>
                <p className="text-xl font-bold mono-font" style={{ color: COLORS[idx % COLORS.length] }}>
                  ${type.value.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Records Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fuel Records */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: "var(--border-divider)" }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Fuel size={18} style={{ color: "var(--accent-amber)" }} />
              Fuel Records ({truckFuel.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Gal</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Cost</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>MPG</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Miles</th>
                </tr>
              </thead>
              <tbody>
                {truckFuel.sort((a,b) => b.fuelDate.localeCompare(a.fuelDate)).map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border-divider)" }}>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{r.fuelDate}</td>
                    <td className="px-4 py-3 text-sm mono-font" style={{ color: "var(--text-primary)" }}>{r.liters}</td>
                    <td className="px-4 py-3 text-sm mono-font" style={{ color: "var(--text-primary)" }}>${Number(r.totalCost||0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-md mono-font" 
                            style={{ background: Number(r.efficiency)>0?"rgba(74,155,106,0.15)":"rgba(255,255,255,0.06)", 
                                     color: Number(r.efficiency)>0?"var(--accent-green)":"var(--text-muted)" }}>
                        {r.efficiency ? `${r.efficiency} MPG` : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm mono-font" style={{ color: "var(--text-primary)" }}>
                      {r.kmDriven ? `${r.kmDriven} mi` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance Records */}
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: "var(--border-divider)" }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Wrench size={18} style={{ color: "var(--accent-orange)" }} />
              Maintenance Records ({truckMaint.length})
            </h3>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-divider)" }}>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Cost</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {truckMaint.sort((a,b) => b.date.localeCompare(a.date)).map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border-divider)" }}>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>{r.date}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>{r.type}</td>
                    <td className="px-4 py-3 text-sm mono-font" style={{ color: "var(--text-primary)" }}>${Number(r.cost||0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                        r.status === "completed" ? "bg-green-500/15 text-green-400" :
                        r.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                        "bg-red-500/15 text-red-400"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
