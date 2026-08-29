import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { auth, db } from "@/lib/firebase";
import { useDriverName } from "@/hooks/useDriverName";
import { signOut } from "firebase/auth";
import { collection, addDoc, getDocs } from "firebase/firestore";
import {
  LogOut, Truck, ClipboardCheck, Wrench,
  AlertTriangle, CheckCircle2, Camera, X
} from "lucide-react";
import PendingIssuesBanner from "@/components/PendingIssuesBanner"; // ← NOVO

type ItemStatus = "ok" | "fair" | "bad" | null;

interface ChecklistItem {
  id: string;
  label: string;
  labelPt: string;
  category: "safety" | "mechanical" | "documentation";
  status: ItemStatus;
  notes: string;
  photoUrl?: string;
}

interface TruckOption {
  id: string;
  name: string;
}

const initialChecklist: ChecklistItem[] = [
  // SAFETY / SEGURANÇA
  { id: "lights", label: "All lights working (headlights, brake, turn)", labelPt: "Todas as luzes funcionando (faróis, freio, seta)", category: "safety", status: null, notes: "" },
  { id: "tires", label: "Tires inspected (pressure, tread, damage)", labelPt: "Pneus inspecionados (pressão, sulco, danos)", category: "safety", status: null, notes: "" },
  { id: "brakes", label: "Brakes responsive", labelPt: "Freios respondendo bem", category: "safety", status: null, notes: "" },
  { id: "horn", label: "Horn working", labelPt: "Buzina funcionando", category: "safety", status: null, notes: "" },
  { id: "timbers", label: "Protective timbers (minimum of 4 and a block)", labelPt: "Madeiras de proteção (mínimo 4 e um calço)", category: "safety", status: null, notes: "" },
  { id: "plastic", label: "Protective plastic", labelPt: "Plástico de proteção", category: "safety", status: null, notes: "" },
  // MECHANICAL / MECÂNICA
  { id: "engine", label: "Engine oil level OK", labelPt: "Nível de óleo do motor OK", category: "mechanical", status: null, notes: "" },
  { id: "coolant", label: "Coolant level OK", labelPt: "Nível do líquido de arrefecimento OK", category: "mechanical", status: null, notes: "" },
  { id: "hydraulic", label: "Hydraulic system (if applicable)", labelPt: "Sistema hidráulico (se aplicável)", category: "mechanical", status: null, notes: "" },
  { id: "leaks", label: "No fluid leaks", labelPt: "Sem vazamentos de fluidos", category: "mechanical", status: null, notes: "" },
  { id: "air", label: "Air brakes pressure (if applicable)", labelPt: "Pressão dos freios a ar (se aplicável)", category: "mechanical", status: null, notes: "" },
  { id: "tools", label: "Tools", labelPt: "Ferramentas", category: "mechanical", status: null, notes: "" },
  // DOCUMENTATION / DOCUMENTAÇÃO
  { id: "license", label: "Driver license valid", labelPt: "Carteira de motorista válida", category: "documentation", status: null, notes: "" },
  { id: "registration", label: "Truck registration current", labelPt: "Licenciamento do caminhão em dia", category: "documentation", status: null, notes: "" },
  { id: "insurance", label: "Insurance card in truck", labelPt: "Cartão do seguro no caminhão", category: "documentation", status: null, notes: "" },
];

export default function DriverChecklist() {
  const navigate = useNavigate();
  const [truckId, setTruckId] = useState("");
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const fetchedName = useDriverName();
  const [driverName, setDriverName] = useState(fetchedName);
  useEffect(() => { if (fetchedName) setDriverName(fetchedName); }, [fetchedName]);
  const [odometer, setOdometer] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist);
  const [issues, setIssues] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTrucks = async () => {
      try {
        const snap = await getDocs(collection(db, "trucks"));
        const list = snap.docs.map(d => {
          const data = d.data();
          const truckNumber = data.fleetId || data.id || data.name || data.number || d.id;
          const brand = data.brand || data.make || "";
          const model = data.model || "";
          const desc = [brand, model].filter(Boolean).join(" ");
          return {
            id: d.id,
            name: desc ? `${truckNumber} - ${desc}` : String(truckNumber)
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

  const setStatus = (id: string, status: Exclude<ItemStatus, null>) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, status } : item
    ));
  };

  const updateNotes = (id: string, notes: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, notes } : item
    ));
  };

  const handlePhoto = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 700;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
        setChecklist(prev => prev.map(item =>
          item.id === id ? { ...item, photoUrl: dataUrl } : item
        ));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removePhoto = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, photoUrl: undefined } : item
    ));
  };

  const resetForm = () => {
    setChecklist(initialChecklist.map(i => ({ ...i, status: null, notes: "" })));
    setTruckId("");
    setOdometer("");
    setFuelLevel("");
    setIssues("");
    setSubmitted(false);
  };

  useEffect(() => {
    if (submitted) {
      const t = setTimeout(() => navigate("/"), 4000);
      return () => clearTimeout(t);
    }
  }, [submitted, navigate]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const truckName = trucks.find(t => t.id === truckId)?.name || truckId;
      const report = {
        driverId: auth.currentUser?.uid || "",
        driverEmail: auth.currentUser?.email || "",
        driverName,
        truckId,
        truckName,
        odometer: Number(odometer),
        fuelLevel: Number(fuelLevel),
        checklist,
        issues,
        submittedAt: new Date().toISOString(),
        status: checklist.every(i => i.status === "ok") && !issues.trim() ? "approved" : "needs_review"
      };

      await addDoc(collection(db, "driverChecklists"), report);
      setSubmitted(true);
    } catch (err: any) {
      console.error("Error submitting checklist:", err);
      const code = err?.code ? ` (${err.code})` : "";
      setError(`Could not submit / Não foi possível enviar${code}. Check your internet and try again / Verifique a internet e tente de novo.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const safetyItems = checklist.filter(i => i.category === "safety");
  const mechanicalItems = checklist.filter(i => i.category === "mechanical");
  const docItems = checklist.filter(i => i.category === "documentation");

  const answeredCount = checklist.filter(i => i.status !== null).length;
  const totalCount = checklist.length;
  const progress = Math.round((answeredCount / totalCount) * 100);
  const canSubmit = progress === 100 && truckId && !submitting;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
        <div className="glass-card p-8 text-center max-w-md w-full">
          <CheckCircle2 size={64} className="mx-auto mb-4" style={{ color: "var(--accent-green)" }} />
          <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Checklist Submitted!
          </h2>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>Checklist enviado!</p>
          <p style={{ color: "var(--text-secondary)" }}>
            Thank you, {driverName}. Your report has been sent to the office.
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Obrigado, {driverName}. Seu relatório foi enviado para o escritório.
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
            <div className="flex items-center justify-center rounded-lg" style={{ width: 40, height: 40, background: "var(--accent-green)" }}>
              <Truck size={20} color="#fff" />
            </div>
            <div>
              <h1 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Driver Checklist</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{driverName}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm" style={{ color: "var(--text-muted)" }}>
            <LogOut size={16} /> Exit / Sair
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* ← BANNER DE PROBLEMAS PENDENTES (NOVO) */}
        <PendingIssuesBanner
          driverEmail={auth.currentUser?.email || ""}
          truckId={truckId || undefined}
        />

        {/* Progress */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Progress / Progresso: {answeredCount}/{totalCount}
            </span>
            <span className="text-sm font-bold" style={{ color: progress === 100 ? "var(--accent-green)" : "var(--accent-amber)" }}>
              {progress}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-secondary)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? "var(--accent-green)" : "var(--accent-amber)"
              }}
            />
          </div>
        </div>

        {/* Truck Info */}
        <div className="glass-card p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Truck size={18} style={{ color: "var(--accent-amber)" }} />
            <span>Truck Info <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>/ Informações do Caminhão</span></span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Truck / Caminhão</label>
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
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Driver Name / Nome do Motorista</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Odometer / Odômetro (mi)</label>
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="e.g. 45230"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Fuel Level / Nível de Combustível</label>
              <div className="flex gap-1.5">
                {[
                  { label: "Empty", sub: "Vazio", value: "0" },
                  { label: "1/4", sub: "", value: "25" },
                  { label: "1/2", sub: "", value: "50" },
                  { label: "3/4", sub: "", value: "75" },
                  { label: "Full", sub: "Cheio", value: "100" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFuelLevel(opt.value)}
                    className="flex-1 py-2 rounded-lg font-semibold transition-all"
                    style={{
                      background: fuelLevel === opt.value ? "var(--accent-amber)" : "var(--bg-primary)",
                      border: "2px solid " + (fuelLevel === opt.value ? "var(--accent-amber)" : "var(--border-divider)"),
                      color: fuelLevel === opt.value ? "#fff" : "var(--text-muted)"
                    }}
                  >
                    <span className="text-xs">{opt.label}</span>
                    {opt.sub && <span className="block" style={{ fontSize: 9, opacity: 0.8 }}>{opt.sub}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Safety Checks */}
        <ChecklistSection
          title="Safety Inspection"
          titlePt="Inspeção de Segurança"
          icon={<AlertTriangle size={18} style={{ color: "#ef4444" }} />}
          items={safetyItems}
          onStatusChange={setStatus}
          onNotesChange={updateNotes}
          onPhotoChange={handlePhoto}
          onPhotoRemove={removePhoto}
        />

        {/* Mechanical Checks */}
        <ChecklistSection
          title="Mechanical Inspection"
          titlePt="Inspeção Mecânica"
          icon={<Wrench size={18} style={{ color: "var(--accent-amber)" }} />}
          items={mechanicalItems}
          onStatusChange={setStatus}
          onNotesChange={updateNotes}
          onPhotoChange={handlePhoto}
          onPhotoRemove={removePhoto}
        />

        {/* Documentation */}
        <ChecklistSection
          title="Documentation"
          titlePt="Documentação"
          icon={<ClipboardCheck size={18} style={{ color: "var(--accent-green)" }} />}
          items={docItems}
          onStatusChange={setStatus}
          onNotesChange={updateNotes}
          onPhotoChange={handlePhoto}
          onPhotoRemove={removePhoto}
        />

        {/* Issues */}
        <div className="glass-card p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <AlertTriangle size={18} style={{ color: "#ef4444" }} />
            <span>Issues / Notes <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>/ Problemas / Observações</span></span>
          </h3>
          <textarea
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            placeholder="Describe any issues found... / Descreva qualquer problema encontrado..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
          />
        </div>

        {error && (
          <p className="text-sm text-center" style={{ color: "#ef4444" }}>{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-all"
          style={{
            background: canSubmit ? "var(--accent-green)" : "rgba(74,155,106,0.3)",
            color: "#fff",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.6
          }}
        >
          {submitting
            ? "Submitting... / Enviando..."
            : canSubmit
              ? "Submit Checklist / Enviar Checklist"
              : `Complete all items / Complete todos os itens (${progress}%)`}
        </button>
      </main>
    </div>
  );
}

// Botão de status (OK / Fair / Bad)
function StatusButton({
  label,
  labelPt,
  color,
  active,
  onClick
}: {
  label: string;
  labelPt: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-all"
      style={{
        minWidth: 58,
        background: active ? color : "transparent",
        border: `2px solid ${active ? color : "var(--border-divider)"}`,
        color: active ? "#fff" : "var(--text-muted)"
      }}
    >
      <span className="text-xs font-bold leading-tight">{label}</span>
      <span className="leading-tight" style={{ fontSize: 10, opacity: active ? 0.9 : 0.7 }}>{labelPt}</span>
    </button>
  );
}

// Componente auxiliar para cada seção
function ChecklistSection({
  title,
  titlePt,
  icon,
  items,
  onStatusChange,
  onNotesChange,
  onPhotoChange,
  onPhotoRemove
}: {
  title: string;
  titlePt: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
  onStatusChange: (id: string, status: "ok" | "fair" | "bad") => void;
  onNotesChange: (id: string, notes: string) => void;
  onPhotoChange: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoRemove: (id: string) => void;
}) {
  return (
    <div className="glass-card p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
        {icon}
        <span>{title} <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>/ {titlePt}</span></span>
      </h3>
      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            className="p-3 rounded-lg"
            style={{
              background: "var(--bg-secondary)",
              border: `1px solid ${
                item.status === "bad" ? "rgba(239,68,68,0.5)" :
                item.status === "fair" ? "rgba(245,158,11,0.5)" :
                "var(--border-divider)"
              }`
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.labelPt}</p>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <StatusButton
                  label="Good" labelPt="Bom" color="#22c55e"
                  active={item.status === "ok"}
                  onClick={() => onStatusChange(item.id, "ok")}
                />
                <StatusButton
                  label="Fair" labelPt="Regular" color="#f59e0b"
                  active={item.status === "fair"}
                  onClick={() => onStatusChange(item.id, "fair")}
                />
                <StatusButton
                  label="Bad" labelPt="Ruim" color="#ef4444"
                  active={item.status === "bad"}
                  onClick={() => onStatusChange(item.id, "bad")}
                />
              </div>
            </div>
            {(item.status === "fair" || item.status === "bad") && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={item.notes}
                  onChange={(e) => onNotesChange(item.id, e.target.value)}
                  placeholder="Describe the issue... / Descreva o problema..."
                  className="w-full px-2 py-1.5 rounded text-xs"
                  style={{ background: "var(--bg-primary)", border: "1px solid var(--border-divider)", color: "var(--text-secondary)" }}
                />
                <div className="flex items-center gap-2">
                  <label
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{ background: "var(--bg-primary)", border: "1px solid var(--border-divider)", color: "var(--text-muted)" }}
                  >
                    <Camera size={14} /> {item.photoUrl ? "Retake / Trocar foto" : "Add photo / Foto"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => onPhotoChange(item.id, e)}
                    />
                  </label>
                  {item.photoUrl && (
                    <div className="relative">
                      <img
                        src={item.photoUrl}
                        alt="Issue"
                        className="w-12 h-12 rounded object-cover"
                        style={{ border: "1px solid var(--border-divider)" }}
                      />
                      <button
                        onClick={() => onPhotoRemove(item.id)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: "#ef4444", color: "#fff" }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
