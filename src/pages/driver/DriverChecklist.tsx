import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { auth, db } from "@/lib/firebase";
import { useDriverName } from "@/hooks/useDriverName";
import { signOut } from "firebase/auth";
import { collection, addDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import {
  LogOut, Truck, ClipboardCheck, Wrench,
  AlertTriangle, CheckCircle2, Camera, X
} from "lucide-react";
import { uploadImage } from "@/lib/uploadImage";
import { useDialogs } from "@/components/Dialogs";
import { checkOdometer } from "@/lib/truckSync";
import { usePendingChecklistItems } from "@/hooks/usePendingChecklistItems";

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
  /** Milhagem atual, usada para conferir o odômetro digitado. */
  currentKm?: string | number;
}

const initialChecklist: ChecklistItem[] = [
  // SAFETY / SEGURANÇA
  { id: "lights", label: "All lights working (headlights, brake, turn)", labelPt: "Todas as luzes funcionando (faróis, freio, seta)", category: "safety", status: null, notes: "" },
  { id: "tires", label: "Tires inspected (pressure, tread, damage)", labelPt: "Pneus inspecionados (pressão, sulco, danos)", category: "safety", status: null, notes: "" },
  { id: "brakes", label: "Brakes responsive", labelPt: "Freios respondendo bem", category: "safety", status: null, notes: "" },
  { id: "horn", label: "Horn working", labelPt: "Buzina funcionando", category: "safety", status: null, notes: "" },
  { id: "timbers", label: "Protective timbers (minimum of 4 and a block)", labelPt: "Madeiras de proteção (mínimo 4 e um calço)", category: "safety", status: null, notes: "" },
  { id: "plastic", label: "Protective plastic", labelPt: "Plástico de proteção", category: "safety", status: null, notes: "" },
  { id: "tarp", label: "Tarp working and covering the load", labelPt: "Lona funcionando e cobrindo a carga", category: "safety", status: null, notes: "" },
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
  // Qual item está com foto subindo agora (para travar o botão e avisar)
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const { confirm } = useDialogs();
  // Inspeção pré-viagem no papel tem assinatura — é o que a torna documento.
  const [certified, setCertified] = useState(false);
  // Reconhecimento do relatório anterior: o DVIR exige que o motorista
  // seguinte revise e assine o que o anterior reportou.
  const [acknowledged, setAcknowledged] = useState(false);

  const pending = usePendingChecklistItems(auth.currentUser?.email || "", truckId || undefined);
  const openIssues = pending.pendingItems;

  // Trocar de caminhão zera a inspeção: é outro veículo, outro documento.
  useEffect(() => {
    setChecklist(initialChecklist.map(i => ({ ...i, status: null, notes: "" })));
    setAcknowledged(false);
  }, [truckId]);

  // Problema que a oficina ainda não liberou já entra marcado no item, com o
  // mesmo estado de antes. O motorista não precisa reportar de novo, e o
  // problema fica visível onde ele mora — no item — em vez de num aviso à parte.
  useEffect(() => {
    if (!truckId || pending.loading || openIssues.length === 0) return;
    setChecklist(prev => prev.map(item => {
      const open = openIssues.find(i => i.id === item.id);
      // Não mexe no que o motorista já respondeu agora.
      if (!open || item.status !== null) return item;
      return {
        ...item,
        status: open.status,
        notes: item.notes || open.notes || "",
        photoUrl: item.photoUrl || open.photoUrl,
        carriedOver: true,
        daysOpen: open.daysOpen,
      };
    }));
  }, [truckId, pending.loading, openIssues]);

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
            name: desc ? `${truckNumber} - ${desc}` : String(truckNumber),
            // Guardado para conferir a milhagem digitada no envio.
            currentKm: data.currentKm,
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

  // A foto sobe para o Storage assim que o motorista tira, e o checklist
  // guarda só a URL. Antes ela ia embutida em base64 dentro do documento —
  // com 3 ou 4 fotos o documento passava do limite de 1 MB do Firestore e o
  // envio falhava no fim do checklist, depois de todo o trabalho preenchido.
  const handlePhoto = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingPhotoId(id);
    try {
      const url = await uploadImage(file, "checklists", { maxWidth: 900, quality: 0.7 });
      setChecklist(prev => prev.map(item =>
        item.id === id ? { ...item, photoUrl: url } : item
      ));
    } catch (err) {
      console.error("Error uploading photo:", err);
      setError("Could not upload photo / Não foi possível enviar a foto. Tente de novo.");
    } finally {
      setUploadingPhotoId(null);
    }
  };

  const removePhoto = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, photoUrl: undefined } : item
    ));
  };

  const resetForm = () => {
    setChecklist(initialChecklist.map(i => ({ ...i, status: null, notes: "" })));
    setCertified(false);
    setAcknowledged(false);
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

  /**
   * Procura um checklist do mesmo caminhão enviado hoje por este motorista.
   * Falha em silêncio de propósito: se a consulta não puder ser feita, o
   * envio segue normalmente — o aviso é uma conveniência, não uma trava.
   */
  const findTodayChecklist = async (truck: string): Promise<boolean> => {
    try {
      const email = auth.currentUser?.email;
      if (!email) return false;
      const today = new Date().toISOString().slice(0, 10);
      const snap = await getDocs(
        query(
          collection(db, "driverChecklists"),
          where("driverEmail", "==", email),
          orderBy("submittedAt", "desc"),
          limit(10)
        )
      );
      return snap.docs.some(d => {
        const data = d.data();
        return data.truckId === truck && String(data.submittedAt || "").slice(0, 10) === today;
      });
    } catch (err) {
      console.error("Could not check for a duplicate checklist:", err);
      return false;
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const truckName = trucks.find(t => t.id === truckId)?.name || truckId;

      // Milhagem menor que a atual do caminhão é quase sempre erro de digitação.
      const selected = trucks.find(t => t.id === truckId);
      const odo = checkOdometer(Number(odometer) || 0, selected?.currentKm);
      if (!odo.ok) {
        const goOn = await confirm({
          title: "Check the odometer / Confira o odômetro",
          message: `O caminhão está com ${odo.current.toLocaleString()} mi e você digitou ${Number(odometer).toLocaleString()} mi. Está certo?`,
          confirmLabel: "Yes, it's right / Está certo",
          cancelLabel: "Let me fix / Vou corrigir",
        });
        if (!goOn) { setSubmitting(false); return; }
      }

      // Já mandou um checklist deste caminhão hoje? Avisa, mas não bloqueia —
      // há casos legítimos (troca de turno, segunda inspeção).
      const duplicate = await findTodayChecklist(truckId);
      if (duplicate) {
        const proceed = await confirm({
          title: "Already sent today / Já enviado hoje",
          message: `Você já enviou um checklist deste caminhão hoje. Enviar outro assim mesmo?`,
          confirmLabel: "Send anyway / Enviar",
          cancelLabel: "Cancel / Cancelar",
        });
        if (!proceed) { setSubmitting(false); return; }
      }
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
        certified: true,
        certifiedBy: driverName,
        certifiedAt: new Date().toISOString(),
        // Quais problemas em aberto o motorista declarou ter revisado.
        acknowledgedIssues: openIssues.map(i => ({
          id: i.id,
          label: i.label,
          reportId: i.reportId,
        })),
        acknowledgedAt: openIssues.length > 0 ? new Date().toISOString() : null,
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
  // Não deixa enviar enquanto uma foto ainda está subindo, senão o checklist
  // vai sem ela.
  const needsAck = openIssues.length > 0 && !acknowledged;
  const canSubmit = progress === 100 && truckId && certified && !needsAck && !submitting && uploadingPhotoId === null;

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
        {pending.error && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <p className="text-sm font-semibold" style={{ color: "#ef4444" }}>
              Não foi possível carregar os problemas pendentes
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Could not load pending issues — código: {pending.error}
            </p>
          </div>
        )}

        {openIssues.length > 0 && (
          <p className="text-sm mb-3 flex items-start gap-2" style={{ color: "var(--accent-amber)" }}>
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>
              {openIssues.length} {openIssues.length === 1 ? "problema já marcado abaixo" : "problemas já marcados abaixo"}, aguardando a oficina.
              <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                {openIssues.length === 1 ? "Issue already marked below" : "Issues already marked below"} — no need to report again.
              </span>
            </span>
          </p>
        )}

        {openIssues.length > 0 && (
          <label
            className="flex items-start gap-3 p-3 rounded-xl cursor-pointer -mt-2 mb-4"
            style={{
              background: acknowledged ? "rgba(74,155,106,0.10)" : "rgba(245,158,11,0.08)",
              border: `1px solid ${acknowledged ? "rgba(74,155,106,0.4)" : "rgba(245,158,11,0.35)"}`,
            }}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 flex-shrink-0"
              style={{ width: 20, height: 20, accentColor: "var(--accent-green)" }}
            />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>
              I reviewed the issues carried over from the previous report.
              <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Li os problemas que vieram do relatório anterior.
              </span>
            </span>
          </label>
        )}

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
          uploadingPhotoId={uploadingPhotoId}
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
          uploadingPhotoId={uploadingPhotoId}
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
          uploadingPhotoId={uploadingPhotoId}
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

        {/* Confirmação do motorista — o equivalente à assinatura no papel */}
        <label
          className="flex items-start gap-3 p-4 rounded-xl cursor-pointer"
          style={{
            background: certified ? "rgba(74,155,106,0.10)" : "var(--bg-secondary)",
            border: `1px solid ${certified ? "rgba(74,155,106,0.4)" : "var(--border-divider)"}`,
          }}
        >
          <input
            type="checkbox"
            checked={certified}
            onChange={(e) => setCertified(e.target.checked)}
            className="mt-0.5 flex-shrink-0"
            style={{ width: 20, height: 20, accentColor: "var(--accent-green)" }}
          />
          <span className="text-sm" style={{ color: "var(--text-primary)" }}>
            I certify that I inspected this vehicle and the information above is accurate.
            <span className="block text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Confirmo que inspecionei este veículo e que as informações acima são verdadeiras.
              {driverName ? ` — ${driverName}` : ""}
            </span>
          </span>
        </label>

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
              : progress < 100
                ? `Complete all items / Complete todos os itens (${progress}%)`
                : !truckId
                  ? "Select the truck / Escolha o caminhão"
                  : needsAck
                    ? "Review the previous issues / Confirme a leitura acima"
                    : "Confirm the inspection above / Confirme a inspeção acima"}
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
  locked = false,
  onClick
}: {
  label: string;
  labelPt: string;
  color: string;
  active: boolean;
  /** Item herdado do relatório anterior: só a oficina pode liberar. */
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={locked}
      title={locked ? "Aguardando a oficina liberar / Waiting for the shop" : undefined}
      className="flex flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-all"
      style={{
        minWidth: 58,
        background: active ? color : "transparent",
        border: `2px solid ${active ? color : "var(--border-divider)"}`,
        color: active ? "#fff" : "var(--text-muted)",
        cursor: locked ? "not-allowed" : "pointer",
        opacity: locked && !active ? 0.35 : 1,
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
  onPhotoRemove,
  uploadingPhotoId
}: {
  title: string;
  titlePt: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
  onStatusChange: (id: string, status: "ok" | "fair" | "bad") => void;
  onNotesChange: (id: string, notes: string) => void;
  onPhotoChange: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoRemove: (id: string) => void;
  uploadingPhotoId: string | null;
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
              }`,
              borderLeft: item.carriedOver ? "3px solid #ef4444" : undefined
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.labelPt}</p>
                {item.carriedOver && (
                  <span
                    className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                    title="Reportado antes e ainda não liberado pela oficina"
                  >
                    Open{typeof item.daysOpen === "number" && item.daysOpen > 0 ? ` ${item.daysOpen}d` : ""} · aguardando oficina
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <StatusButton
                  label="Good" labelPt="Bom" color="#22c55e"
                  active={item.status === "ok"}
                  locked={Boolean(item.carriedOver)}
                  onClick={() => onStatusChange(item.id, "ok")}
                />
                <StatusButton
                  label="Fair" labelPt="Regular" color="#f59e0b"
                  active={item.status === "fair"}
                  locked={Boolean(item.carriedOver)}
                  onClick={() => onStatusChange(item.id, "fair")}
                />
                <StatusButton
                  label="Bad" labelPt="Ruim" color="#ef4444"
                  active={item.status === "bad"}
                  locked={Boolean(item.carriedOver)}
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
                  disabled={Boolean(item.carriedOver)}
                  placeholder="Describe the issue... / Descreva o problema..."
                  className="w-full px-2 py-1.5 rounded text-xs"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-divider)",
                    color: "var(--text-secondary)",
                    opacity: item.carriedOver ? 0.7 : 1,
                    cursor: item.carriedOver ? "not-allowed" : "text",
                  }}
                />
                <div className="flex items-center gap-2">
                  {!item.carriedOver && (
                  <label
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-divider)",
                      color: "var(--text-muted)",
                      cursor: uploadingPhotoId === item.id ? "wait" : "pointer",
                      opacity: uploadingPhotoId === item.id ? 0.6 : 1,
                    }}
                  >
                    <Camera size={14} />
                    {uploadingPhotoId === item.id
                      ? "Sending... / Enviando..."
                      : item.photoUrl ? "Retake / Trocar foto" : "Add photo / Foto"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={uploadingPhotoId === item.id}
                      onChange={(e) => onPhotoChange(item.id, e)}
                    />
                  </label>
                  )}
                  {item.carriedOver && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Reported before — only the shop can clear it.
                      <span className="block">Reportado antes — só a oficina pode liberar.</span>
                    </p>
                  )}
                  {item.photoUrl && (
                    <div className="relative">
                      <img
                        src={item.photoUrl}
                        alt="Issue"
                        className="w-12 h-12 rounded object-cover"
                        style={{ border: "1px solid var(--border-divider)" }}
                      />
                      {!item.carriedOver && (
                      <button
                        onClick={() => onPhotoRemove(item.id)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: "#ef4444", color: "#fff" }}
                      >
                        <X size={10} />
                      </button>
                      )}
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
