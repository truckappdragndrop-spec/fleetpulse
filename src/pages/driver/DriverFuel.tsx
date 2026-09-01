import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { auth, db } from "@/lib/firebase";
import { useDriverName } from "@/hooks/useDriverName";
import { uploadImage } from "@/lib/uploadImage";
import { checkOdometer } from "@/lib/truckSync";
import { useDialogs } from "@/components/Dialogs";
import { signOut } from "firebase/auth";
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { LogOut, Truck, Fuel, CheckCircle2, Camera, X, ImagePlus } from "lucide-react";

/**
 * Quantas fotos cabem num abastecimento.
 *
 * Um abastecimento rende, na prática, três coisas fotografáveis: o cupom, o
 * painel da bomba e o odômetro. Cinco dá folga para o cupom que sai em duas
 * partes, sem virar álbum — cada foto é um upload que o motorista espera
 * terminar em pé no posto, e é espaço pago no Storage.
 */
const MAX_PHOTOS = 5;

/** Traduz o código do Firebase Storage para uma frase que diz o que fazer. */
function photoErrorHint(code: string): string {
  switch (code) {
    case "storage/unauthorized":
      return "permissão negada pelo Storage. As regras precisam ser publicadas (firebase deploy --only storage). / permission denied.";
    case "storage/unauthenticated":
      return "sessão expirada. Saia e entre de novo. / session expired, sign in again.";
    case "storage/quota-exceeded":
      return "o espaço do Storage acabou. Avise o administrador. / storage quota exceeded.";
    case "storage/retry-limit-exceeded":
    case "storage/canceled":
      return "a internet caiu no meio do envio. Tente de novo. / connection lost, try again.";
    default:
      return `erro ${code}. Tente de novo. / try again.`;
  }
}

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
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  // Quantas já subiram de quantas foram escolhidas — no 4G do posto, uma barra
  // parada sem número faz o motorista achar que travou e sair da tela.
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const uploadingPhoto = uploadProgress !== null;
  const { confirm } = useDialogs();
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

  /**
   * Prévia do abastecimento enquanto o motorista digita.
   *
   * Estes números já eram calculados no envio e gravados no banco — mas
   * ficavam invisíveis para quem estava preenchendo. Mostrando na hora, o
   * erro de digitação aparece sozinho: consumo de 60 MPG ou de 0,8 MPG num
   * caminhão não existe, e quem digitou percebe antes de enviar.
   */
  const preview = (() => {
    const previous = Number(selectedTruck?.currentKm) || 0;
    const entered = Number(odometer) || 0;
    const gal = Number(gallons) || 0;

    const miles = previous > 0 && entered > previous ? entered - previous : 0;
    const mpg = miles > 0 && gal > 0 ? miles / gal : 0;

    // Caminhão pesado costuma ficar entre 4 e 12 MPG. Fora disso, algo está
    // errado — quase sempre um dígito a mais ou a menos.
    const mpgLooksWrong = mpg > 0 && (mpg < 2 || mpg > 20);

    return { previous, miles, mpg, mpgLooksWrong };
  })();

  // Calcula o total automaticamente (galões x preço)
  useEffect(() => {
    const gal = Number(gallons) || 0;
    const price = Number(pricePerGal) || 0;
    if (gal > 0 && price > 0) {
      setTotalCost((gal * price).toFixed(2));
    }
  }, [gallons, pricePerGal]);

  /**
   * As fotos sobem para o Storage e o registro guarda só as URLs.
   *
   * Sobem uma de cada vez, e não todas de uma vez: no sinal fraco de posto,
   * disparar cinco uploads em paralelo costuma derrubar todos. E uma que falha
   * não leva junto as que já subiram — elas ficam na tela, e o motorista só
   * repete a que faltou.
   */
  const handlePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photoUrls.length;
    if (room <= 0) {
      setError(`Maximum ${MAX_PHOTOS} photos / Máximo de ${MAX_PHOTOS} fotos por abastecimento.`);
      return;
    }

    const chosen = files.slice(0, room);
    const ignored = files.length - chosen.length;

    setError("");

    /**
     * Renova o token de login antes de subir.
     *
     * O Storage devolvia 401 "usuário não autenticado" enquanto o resto do app
     * funcionava — o que parece contradição, mas não é: o Firestore mantém uma
     * conexão aberta com o token que já pegou, e o Storage faz uma chamada nova
     * a cada foto. Quando o token vence e a renovação falha, só o Storage
     * percebe. Forçar a renovação aqui conserta esse caso e, quando não
     * conserta, diz em voz alta o motivo em vez de deixar a foto sumir.
     */
    if (!auth.currentUser) {
      setError("You are signed out / Você está deslogado. Saia e entre de novo.");
      return;
    }
    try {
      await auth.currentUser.getIdToken(true);
    } catch (err: any) {
      console.error("Token refresh failed:", err?.code, err);
      setError(
        `Could not refresh your session / Não foi possível renovar a sessão (${err?.code || "sem código"}). ` +
        `Isso costuma ser restrição da chave de API no Google Cloud.`
      );
      return;
    }

    setUploadProgress({ done: 0, total: chosen.length });

    const uploaded: string[] = [];
    let failed = 0;
    let lastCode = "";
    for (const file of chosen) {
      try {
        uploaded.push(await uploadImage(file, "fuel", { maxWidth: 1100, quality: 0.72 }));
      } catch (err: any) {
        // O código do Firebase diz exatamente o que houve. Sem ele, "não
        // subiu" faz o motorista tentar de novo dez vezes um problema que
        // está na regra de segurança, e não na internet dele.
        console.error("Error uploading photo:", err?.code, err);
        failed++;
        lastCode = err?.code || err?.message || "unknown";
      }
      setUploadProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }

    if (uploaded.length > 0) setPhotoUrls((prev) => [...prev, ...uploaded]);
    setUploadProgress(null);

    if (failed > 0) {
      setError(`${failed} photo(s) did not upload / ${failed} foto(s) não subiram: ${photoErrorHint(lastCode)}`);
    } else if (ignored > 0) {
      setError(`Only ${MAX_PHOTOS} photos per refuel — ${ignored} left out / Máximo de ${MAX_PHOTOS} fotos: ${ignored} ficaram de fora.`);
    }
  };

  const removePhoto = (index: number) =>
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));

  const resetForm = () => {
    setTruckId("");
    setFuelDate(new Date().toISOString().split("T")[0]);
    setOdometer("");
    setGallons("");
    setPricePerGal("");
    setTotalCost("");
    setStation("");
    setNotes("");
    setPhotoUrls([]);
    setUploadProgress(null);
    setSubmitted(false);
  };

  useEffect(() => {
    if (submitted) {
      const t = setTimeout(() => navigate("/"), 4000);
      return () => clearTimeout(t);
    }
  }, [submitted, navigate]);

  // Não deixa salvar enquanto a foto ainda está subindo.
  const canSubmit = truckId && gallons && odometer && !submitting && !uploadingPhoto;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      // Confere a milhagem antes de gravar: um dígito a menos faz a milhagem
      // do caminhão andar para trás e estraga MPG e alerta de troca de óleo.
      const odo = checkOdometer(Number(odometer) || 0, selectedTruck?.currentKm);
      if (!odo.ok) {
        const proceed = await confirm({
          title: "Check the odometer / Confira o odômetro",
          message: `O caminhão está com ${odo.current.toLocaleString()} mi e você digitou ${Number(odometer).toLocaleString()} mi. Está certo?`,
          confirmLabel: "Yes, it's right / Está certo",
          cancelLabel: "Let me fix / Vou corrigir",
        });
        if (!proceed) { setSubmitting(false); return; }
      }

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
        // O nome vem do cadastro e pode ser trocado; o e-mail vem do login e
        // não pode. É por ele que a regra do Firestore confere que o
        // abastecimento foi mesmo gravado por quem diz ter gravado.
        driverEmail: auth.currentUser?.email || "",
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
        photoUrls,
        // A página Fuel do admin e os relatórios antigos leem `photoUrl`.
        // Gravar a primeira foto aqui também mantém tudo funcionando sem
        // precisar migrar os registros que já existem.
        photoUrl: photoUrls[0] || null,
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
                placeholder={preview.previous > 0 ? `> ${preview.previous.toLocaleString()}` : "e.g. 45230"}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-primary)" }}
              />
              {preview.previous > 0 && (
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Last reading / Última leitura:{" "}
                  <span className="mono-font" style={{ color: "var(--text-secondary)" }}>
                    {preview.previous.toLocaleString()} mi
                  </span>
                  {preview.miles > 0 && (
                    <span style={{ color: "var(--accent-green)" }}>
                      {" "}• +{preview.miles.toLocaleString()} mi
                    </span>
                  )}
                </p>
              )}
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

          {/* Resumo do que foi digitado — o motorista confere antes de enviar */}
          {preview.mpg > 0 && (
            <div
              className="p-3 rounded-xl flex items-center justify-between gap-3"
              style={{
                background: preview.mpgLooksWrong ? "rgba(239,68,68,0.08)" : "rgba(74,155,106,0.08)",
                border: `1px solid ${preview.mpgLooksWrong ? "rgba(239,68,68,0.35)" : "rgba(74,155,106,0.3)"}`,
              }}
            >
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  This tank / Neste tanque
                </p>
                <p className="text-lg font-bold mono-font" style={{ color: preview.mpgLooksWrong ? "#ef4444" : "var(--accent-green)" }}>
                  {preview.mpg.toFixed(1)} MPG
                </p>
              </div>
              <p className="text-xs text-right flex-1" style={{ color: "var(--text-muted)" }}>
                {preview.miles.toLocaleString()} mi ÷ {Number(gallons).toFixed(1)} gal
                {preview.mpgLooksWrong && (
                  <span className="block mt-1 font-semibold" style={{ color: "#ef4444" }}>
                    Check the numbers — this is out of range.
                    <span className="block font-normal">Confira os números, isso está fora do normal.</span>
                  </span>
                )}
              </p>
            </div>
          )}

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
            <label className="text-xs block mb-2" style={{ color: "var(--text-muted)" }}>
              Photos / Fotos do abastecimento{" "}
              <span className="mono-font" style={{ color: photoUrls.length >= MAX_PHOTOS ? "var(--accent-amber)" : "var(--text-muted)" }}>
                ({photoUrls.length}/{MAX_PHOTOS})
              </span>
            </label>

            {photoUrls.length < MAX_PHOTOS && (
              <div className="flex items-center gap-2 mb-3">
                {/* Dois botões de propósito: o celular só abre a câmera direto
                    quando o input pede uma foto de cada vez. Juntar "escolher
                    várias" no mesmo botão faria a câmera parar de abrir. */}
                <label
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-secondary)", opacity: uploadingPhoto ? 0.5 : 1 }}
                >
                  <Camera size={15} />
                  Take photo / Tirar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={handlePhotos}
                  />
                </label>
                <label
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-divider)", color: "var(--text-secondary)", opacity: uploadingPhoto ? 0.5 : 1 }}
                >
                  <ImagePlus size={15} />
                  Gallery / Galeria
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={handlePhotos}
                  />
                </label>
              </div>
            )}

            {uploadingPhoto && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent-amber)", borderTopColor: "transparent" }} />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Sending {uploadProgress?.done ?? 0} of {uploadProgress?.total ?? 0} / Enviando {uploadProgress?.done ?? 0} de {uploadProgress?.total ?? 0}...
                </span>
              </div>
            )}

            {photoUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url, i) => (
                  <div key={url + i} className="relative">
                    <img
                      src={url}
                      alt={`Fuel photo ${i + 1}`}
                      className="w-16 h-16 rounded object-cover"
                      style={{ border: "1px solid var(--border-divider)" }}
                    />
                    <span
                      className="absolute bottom-0 left-0 px-1 mono-font"
                      style={{ background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 9, borderTopRightRadius: 4, borderBottomLeftRadius: 4 }}
                    >
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "#ef4444", color: "#fff" }}
                      aria-label="Remove photo / Remover foto"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Receipt, pump display, odometer. / Cupom, painel da bomba, odômetro.
            </p>
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
