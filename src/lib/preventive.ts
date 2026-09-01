/**
 * Manutenção preventiva por regra
 * ───────────────────────────────
 * Até aqui o sistema só avisava de uma coisa: a troca de óleo, e só porque
 * alguém digitava a milhagem da última troca no cadastro do caminhão. Todo o
 * resto — rodízio de pneu, freio, transmissão, inspeção anual — vivia na
 * cabeça de quem cuida da frota, que é onde as coisas somem.
 *
 * A ideia aqui é simples e não pede digitação nova:
 *
 *  1. Cada caminhão tem um conjunto de **regras** ("óleo a cada 10.000 mi",
 *     "freio a cada 6 meses"). Vem preenchido com valores de praxe e você
 *     ajusta por caminhão, porque caminhão de lixo e caminhão de estrada não
 *     rodam igual.
 *
 *  2. O **último serviço** não é digitado: sai das ordens de serviço já
 *     concluídas. Se a oficina fechou uma WO de "Brake Inspection", o relógio
 *     do freio zera sozinho. Campo que precisa ser mantido na mão para de ser
 *     mantido, e o alerta vira ruído — foi o que já aconteceu com o óleo.
 *
 *  3. O que **falta** é medido em milhas e em dias ao mesmo tempo, e vale o
 *     que vencer primeiro. Freio por tempo, óleo por milha; um caminhão parado
 *     um mês não deixa de precisar de freio.
 */

export type PmSeverity = "overdue" | "soon" | "ok" | "unknown";

export interface PmService {
  key: string;
  label: string;
  labelPt: string;
  /** Palavras que identificam o serviço numa ordem já concluída. */
  keywords: string[];
  defaultMiles: number;
  defaultMonths: number;
}

/**
 * Catálogo padrão. Os intervalos são pontos de partida razoáveis para caminhão
 * pesado em serviço urbano — cada caminhão pode ter o seu.
 */
export const PM_SERVICES: PmService[] = [
  { key: "oil", label: "Oil Change", labelPt: "Troca de óleo", keywords: ["oil change", "oil filter", "oil", "óleo", "oleo"], defaultMiles: 10000, defaultMonths: 6 },
  { key: "grease", label: "Chassis Lube", labelPt: "Lubrificação", keywords: ["grease", "lube", "chassis", "lubrifica"], defaultMiles: 5000, defaultMonths: 0 },
  { key: "tires", label: "Tire Rotation", labelPt: "Rodízio de pneus", keywords: ["tire rotation", "tire", "tyre", "pneu", "rodizio", "rodízio"], defaultMiles: 15000, defaultMonths: 0 },
  { key: "brakes", label: "Brake Inspection", labelPt: "Revisão de freio", keywords: ["brake", "freio", "lona", "pastilha"], defaultMiles: 25000, defaultMonths: 6 },
  { key: "airfilter", label: "Air Filter", labelPt: "Filtro de ar", keywords: ["air filter", "filtro de ar", "filtro ar"], defaultMiles: 30000, defaultMonths: 12 },
  { key: "transmission", label: "Transmission Service", labelPt: "Transmissão", keywords: ["transmission", "differential", "transmissao", "transmissão", "cambio", "câmbio"], defaultMiles: 50000, defaultMonths: 0 },
  { key: "coolant", label: "Coolant / Radiator", labelPt: "Arrefecimento", keywords: ["coolant", "radiator", "radiador", "arrefec"], defaultMiles: 0, defaultMonths: 24 },
  { key: "dot", label: "DOT Annual Inspection", labelPt: "Inspeção anual DOT", keywords: ["dot inspection", "annual inspection", "inspection", "inspecao", "inspeção"], defaultMiles: 0, defaultMonths: 12 },
];

export interface PmRule {
  enabled: boolean;
  /** 0 = não controla por milhagem. */
  miles: number;
  /** 0 = não controla por tempo. */
  months: number;
}

export type PmRules = Record<string, PmRule>;

interface TruckLike {
  currentKm?: string | number;
  oilChangeInterval?: string | number;
  lastOilChangeMiles?: string | number;
  pmRules?: PmRules;
  [key: string]: any;
}

/**
 * Regras do caminhão: o padrão do catálogo, sobrescrito pelo que estiver salvo.
 * O intervalo de óleo antigo (`oilChangeInterval`) continua valendo para quem
 * ainda não abriu o cadastro para configurar — ninguém perde o que já tinha.
 */
export function truckRules(truck: TruckLike | null | undefined): PmRules {
  const saved = truck?.pmRules || {};
  const legacyOil = Number(truck?.oilChangeInterval) || 0;
  const rules: PmRules = {};
  for (const svc of PM_SERVICES) {
    const s = saved[svc.key];
    const fallbackMiles = svc.key === "oil" && legacyOil > 0 ? legacyOil : svc.defaultMiles;
    rules[svc.key] = {
      enabled: s ? s.enabled !== false : true,
      miles: s && s.miles !== undefined ? Number(s.miles) || 0 : fallbackMiles,
      months: s && s.months !== undefined ? Number(s.months) || 0 : svc.defaultMonths,
    };
  }
  return rules;
}

/** Converte data do Firestore, string ou número numa Date — ou null. */
function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + "T00:00:00" : value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Qual serviço uma ordem concluída atende.
 *
 * Vence a palavra-chave mais longa que aparecer no texto: "air filter" ganha de
 * "filter" solto, e "oil change" não é confundido com "oil cooler" de outro
 * serviço. Sem isso, a ordem em que o catálogo estivesse escrito mudaria o
 * resultado — um bug silencioso e chato de achar.
 */
export function matchService(...texts: (string | undefined)[]): string | null {
  const hay = texts.filter(Boolean).join(" ").toLowerCase();
  if (!hay.trim()) return null;
  let best: { key: string; len: number } | null = null;
  for (const svc of PM_SERVICES) {
    for (const kw of svc.keywords) {
      if (hay.includes(kw) && (!best || kw.length > best.len)) {
        best = { key: svc.key, len: kw.length };
      }
    }
  }
  return best ? best.key : null;
}

interface MaintLike {
  truckId?: string;
  status?: string;
  type?: string;
  maintenanceType?: string;
  title?: string;
  description?: string;
  mileage?: number | string;
  date?: any;
  scheduledDate?: any;
  createdAt?: any;
}

export interface PmComputed {
  key: string;
  label: string;
  labelPt: string;
  intervalMiles: number;
  intervalMonths: number;
  /** Milhagem e data do último serviço encontrado — null quando não há registro. */
  lastMiles: number | null;
  lastDate: Date | null;
  /** De onde veio o "último": ordem de serviço, cadastro do caminhão, ou nada. */
  source: "maintenance" | "truck" | "none";
  /** Negativo = passou do ponto. null = essa dimensão não é controlada. */
  milesLeft: number | null;
  daysLeft: number | null;
  /** Quanto ainda resta do intervalo, 0 a 100 — para a barra. */
  pct: number;
  severity: PmSeverity;
  detail: string;
  detailPt: string;
}

export const PM_COLORS: Record<PmSeverity, string> = {
  overdue: "#ef4444",
  soon: "var(--accent-amber)",
  ok: "#22c55e",
  unknown: "var(--text-muted)",
};

function fmt(n: number): string {
  return Math.abs(Math.round(n)).toLocaleString("en-US");
}

/**
 * Estado de cada regra de um caminhão.
 *
 * `maintenance` pode ser a coleção inteira: a filtragem por caminhão acontece
 * aqui, para quem chama não precisar repetir isso em cada tela.
 */
export function pmStatusForTruck(
  truck: TruckLike & { id?: string },
  maintenance: MaintLike[] = []
): PmComputed[] {
  const rules = truckRules(truck);
  const current = Number(truck?.currentKm) || 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Só ordens concluídas deste caminhão contam como serviço feito.
  const done = maintenance.filter(
    (m) => m.truckId === truck.id && String(m.status || "").toLowerCase() === "completed"
  );

  return PM_SERVICES.filter((svc) => rules[svc.key]?.enabled).map((svc) => {
    const rule = rules[svc.key];

    // Último serviço deste tipo: o de maior milhagem, com a data mais recente
    // como desempate para os registros antigos que não têm milhagem.
    let lastMiles: number | null = null;
    let lastDate: Date | null = null;
    let source: PmComputed["source"] = "none";

    for (const m of done) {
      if (matchService(m.type, m.maintenanceType, m.title, m.description) !== svc.key) continue;
      const miles = Number(m.mileage) || 0;
      const date = toDate(m.date) || toDate(m.scheduledDate) || toDate(m.createdAt);
      if (miles > 0 && (lastMiles === null || miles > lastMiles)) lastMiles = miles;
      if (date && (lastDate === null || date > lastDate)) lastDate = date;
      source = "maintenance";
    }

    // O óleo tinha um campo próprio no cadastro antes disso existir.
    if (svc.key === "oil") {
      const legacy = Number(truck?.lastOilChangeMiles) || 0;
      if (legacy > 0 && (lastMiles === null || legacy > lastMiles)) {
        lastMiles = legacy;
        if (source === "none") source = "truck";
      }
    }

    const intervalMiles = rule.miles > 0 ? rule.miles : 0;
    const intervalMonths = rule.months > 0 ? rule.months : 0;

    let milesLeft: number | null = null;
    if (intervalMiles > 0 && lastMiles !== null && current > 0) {
      milesLeft = lastMiles + intervalMiles - current;
    }

    let daysLeft: number | null = null;
    if (intervalMonths > 0 && lastDate) {
      const due = new Date(lastDate);
      due.setMonth(due.getMonth() + intervalMonths);
      due.setHours(0, 0, 0, 0);
      daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    }

    // Sem nenhuma referência não dá para afirmar nada. Melhor dizer "sem
    // registro" do que mostrar um verde tranquilizador que ninguém conferiu.
    if (milesLeft === null && daysLeft === null) {
      return {
        key: svc.key, label: svc.label, labelPt: svc.labelPt,
        intervalMiles, intervalMonths, lastMiles, lastDate, source,
        milesLeft: null, daysLeft: null, pct: 100, severity: "unknown" as PmSeverity,
        detail: "no record yet", detailPt: "sem registro ainda",
      };
    }

    const milesPct = milesLeft !== null && intervalMiles > 0 ? (milesLeft / intervalMiles) * 100 : 100;
    const daysPct = daysLeft !== null && intervalMonths > 0 ? (daysLeft / (intervalMonths * 30.4)) * 100 : 100;
    const pct = Math.max(0, Math.min(100, Math.min(milesPct, daysPct)));

    // "Perto" é 10% do intervalo, com piso de 500 mi e 30 dias — em intervalo
    // curto, 10% seria um aviso que chega tarde demais para agendar.
    const milesSoonAt = Math.max(500, intervalMiles * 0.1);
    const overdue =
      (milesLeft !== null && milesLeft <= 0) || (daysLeft !== null && daysLeft <= 0);
    const soon =
      (milesLeft !== null && milesLeft <= milesSoonAt) || (daysLeft !== null && daysLeft <= 30);
    const severity: PmSeverity = overdue ? "overdue" : soon ? "soon" : "ok";

    // A frase fala do que está apertando, não das duas dimensões de uma vez.
    const milesIsTighter = milesPct <= daysPct;
    let detail: string;
    let detailPt: string;
    if (milesIsTighter && milesLeft !== null) {
      detail = milesLeft <= 0 ? `overdue by ${fmt(milesLeft)} mi` : `${fmt(milesLeft)} mi left`;
      detailPt = milesLeft <= 0 ? `passou ${fmt(milesLeft)} mi` : `faltam ${fmt(milesLeft)} mi`;
    } else if (daysLeft !== null) {
      detail = daysLeft <= 0 ? `overdue by ${fmt(daysLeft)} days` : `${fmt(daysLeft)} days left`;
      detailPt = daysLeft <= 0 ? `atrasado ${fmt(daysLeft)} dias` : `faltam ${fmt(daysLeft)} dias`;
    } else {
      detail = "no record yet";
      detailPt = "sem registro ainda";
    }

    return {
      key: svc.key, label: svc.label, labelPt: svc.labelPt,
      intervalMiles, intervalMonths, lastMiles, lastDate, source,
      milesLeft, daysLeft, pct, severity, detail, detailPt,
    };
  });
}

export interface PmFleetItem extends PmComputed {
  truckId: string;
  fleetId: string;
  brand?: string;
  model?: string;
}

/**
 * A frota inteira, só o que precisa de atenção, do mais urgente para o menos.
 * Caminhão vendido não entra — não é problema de ninguém.
 */
export function pmFleetAlerts(
  trucks: (TruckLike & { id: string; fleetId?: string; status?: string; brand?: string; model?: string })[],
  maintenance: MaintLike[],
  include: PmSeverity[] = ["overdue", "soon"]
): PmFleetItem[] {
  const out: PmFleetItem[] = [];
  for (const t of trucks) {
    if (t.status === "sold") continue;
    for (const s of pmStatusForTruck(t, maintenance)) {
      if (!include.includes(s.severity)) continue;
      out.push({ ...s, truckId: t.id, fleetId: t.fleetId || t.id, brand: t.brand, model: t.model });
    }
  }
  const order: Record<PmSeverity, number> = { overdue: 0, soon: 1, unknown: 2, ok: 3 };
  return out.sort(
    (a, b) => order[a.severity] - order[b.severity] || a.pct - b.pct
  );
}
