import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { auth, db } from "@/lib/firebase";
import { useDriverName } from "@/hooks/useDriverName";
import { signOut } from "firebase/auth";
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { LogOut, Truck, Fuel, CheckCircle2, Camera, X } from "lucide-react";

interface TruckOption {
  id: string;
  name: string;
  fleetId: string;
  brand: string;
  model: string;
  currentKm: string;
}

export default function DriverFuel() {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [truckId, setTruckId] = useState("");
  const [fuelDate, setFuelDate] = useState(new Date().toISOString().split("T")[0]);
  const [odometer, setOdometer] = useState("");
  const [gallons, setGallons] = useState("");
  const [pricePerGal, setPricePerGal] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [station, setStation] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const driverName = useDriverName();

  useEffect(() => {
    const loadTrucks = async () => {
      try {
        const snap = await getDocs(collection(db, "trucks"));
        const list = snap.docs.map(d => {
          const data = d.data();
          const fleetId = String(data.fleetId || data.id || data.name || d.id);
          const brand = data.brand || data.make || "";
          const model = data.model || "";
          const desc = [brand, model].filter(Boolean).join(" ");
          return {
            id: d.id,
            fleetId,
            brand,
            model,
            currentKm: data.currentKm || "",
            name: desc ? `${fleetId} - ${desc}` : fleetId
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setTrucks(list);
      } catch (err) {
        console.error("Error loading trucks:", err);
      }
    };
    loadTrucks();
  }, []);

  const selectedTruck = trucks.find(t => t.id === truckId);

  // Calcula o total automaticamente (galões x preço)
  useEffect(() => {
    const gal = Number(gallons) || 0;
    const price = Number(pricePerGal) || 0;
    if (gal > 0 && price > 0) {
      setTotalCost((gal * price).toFixed(2));
    }
  }, [gallons, pricePerGal]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setPhotoUrl(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removePhoto = () => setPhotoUrl(null);

  const resetForm = () => {
    setTruckId("");
    setFuelDate(new Date().toISOString().split("T")[0]);
    setOdometer("");
    setGallons("");
    setPricePerGal("");
    setTotalCost("");
    setStation("");
    setNotes("");
    setPhotoUrl(null);
    setSubmitted(false);
  };

  useEffect(() => {
    if (submitted) {
      const t = setTimeout(() => navigate("/"), 4000);
      return () => clearTimeout(t);
    }
  }, [submitted, navigate]);

  const canSubmit = truckId && gallons && odometer && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const gal = Number(gallons);
      const price = Number(pricePerGal) || 0;
      const finalTotalCost = price > 0 ? (gal * price).toFixed(2) : totalCost;
      const miAt = Number(odometer) || 0;
      const miPrev = selectedTruck?.currentKm ? Number(selectedTruck.currentKm) : 0;
      const miDriven = miAt - miPrev;
      const validMiDriven = miDriven > 0 ? miDriven : 0;
      const rawMpg = validMiDriven > 0 ? validMiDriven / gal : 0;
      const mpg = rawMpg > 0 && rawMpg < 50 ? rawMpg.toFixed(1) : "0";

      await addDoc(collection(db, "fuelRecords"), {
        truckId,
        fleetId: selectedTruck?.fleetId || "",
        truckBrand: selectedTruck?.brand || "",
        truckModel: selectedTruck?.model || "",
        driverName,
        fuelDate,
        liters: String(gallons),
        pricePerLiter: pricePerGal || "",
        totalCost: finalTotalCost || "",
        kmAtRefuel: String(odometer),
        kmPrevious: miPrev ? String(miPrev) : "",
        kmDriven: validMiDriven > 0 ? String(validMiDriven) : "",
        efficiency: mpg,
        stationName: station,
        notes,
        photoUrl: photoUrl || null,
        createdAt: serverTimestamp(),
      });

      // Atualiza a milhagem do caminhão (igual a página Fuel faz)
      try {
        await updateDoc(doc(db, "trucks", truckId), { currentKm: String(odometer) });
      } catch (err) {
        console.error("Error updating truck mileage:", err);
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error("Error saving fuel record:", err);
      const code = err?.code ? ` (${err.code})` : "";
      setError(`Could not save / Não foi possível salvar${code}. Check your internet and try again / Verifique a internet e tente de novo.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
        <div className="glass-card p-8 text-center max-w-md w-full">
          <CheckCircle2 size={64} className="mx-auto mb-4" style={{ color: "var(--accent-green)" }} />
          <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Fuel Logged!
          </h2>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>Abastecimento registrado!</p>
          <p style={{ color: "var(--text-secondary)" }}>
            {selectedTruck?.name} • {gallons} gal {totalCost ? `• $${totalCost}` : ""}
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 px-6 py-2 rounded-lg font-medium"
            style={{ background: "var(--accent-green)", color: "#fff" }}
          >
            Back to Home / Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header className="glass-card sticky top-0 z-10 border-b" style={{ borderColor: "var(--border-divider)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg" style={{ width: 40, height: 40, background: "var(--accent-amber)" }}>
              <Fuel size={20} color="#fff" />
            </div>
            <div>
              <h1 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Fuel Log</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{driverName}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm" style={{ color: "var(--text-muted)" }}>
            <LogOut size={16} /> Exit / Sair
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="glass-card p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Truck size={18} style={{ color: "var(--accent-amber)" }} />
            <span>New Refuel <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>/ Novo Abastecimento</span></span>
          </h2>

          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Truck / Caminhão *</label>
            <select
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
            >
              <option value="">Select truck... / Selecione...</option>
              {trucks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTruck?.currentKm && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Current odometer / Odômetro atual: {Number(selectedTruck.currentKm).toLocaleString("en-US")} mi
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Date / Data *</label>
              <input
                type="date"
                value={fuelDate}
                onChange={(e) => setFuelDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Odometer / Odômetro (mi) *</label>
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="e.g. 45230"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Gallons / Galões *</label>
              <input
                type="number"
                step="0.01"
                value={gallons}
                onChange={(e) => setGallons(e.target.value)}
                placeholder="84.5"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Price/Gal / Preço por Galão ($)</label>
              <input
                type="number"
                step="0.01"
                value={pricePerGal}
                onChange={(e) => setPricePerGal(e.target.value)}
                placeholder="3.89"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Total Cost / Valor Total ($)</label>
              <input
                type="number"
                step="0.01"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                placeholder="Auto / Automático"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Station / Posto</label>
              <input
                type="text"
                value={station}
                onChange={(e) => setStation(e.target.value)}
                placeholder="Station name / Nome do posto"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Notes / Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes... / Observações..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="text-xs block mb-2" style={{ color: "var(--text-muted)" }}>Photo / Foto do abastecimento</label>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-muted)" }}
              >
                <Camera size={14} />
                {photoUrl ? "Retake / Trocar foto" : "Add photo / Adicionar foto"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhoto}
                />
              </label>
              {photoUrl && (
                <div className="relative">
                  <img
                    src={photoUrl}
                    alt="Fuel receipt"
                    className="w-14 h-14 rounded object-cover"
                    style={{ border: "1px solid var(--border-divider)" }}
                  />
                  <button
                    onClick={removePhoto}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "#ef4444", color: "#fff" }}
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: "#ef4444" }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-all"
          style={{
            background: canSubmit ? "var(--accent-amber)" : "rgba(232,168,56,0.3)",
            color: "#fff",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.6
          }}
        >
          {submitting ? "Saving... / Salvando..." : "Save Refuel / Salvar Abastecimento"}
        </button>
      </main>
    </div>
  );
}
