/** Tipos da área de Manutenção. */

export interface MaintenanceRecord {
  id: string;
  /** Número da ordem de serviço, ex. "WO-0042". Registros antigos não têm. */
  woNumber?: string;
  truckId: string;
  truckName: string;
  type: string;
  title?: string;
  description?: string;
  cost: number;
  date: any;
  status: 'pending' | 'in-progress' | 'completed';
  mechanic?: string;
  partIds?: string[];
  woParts?: { id: string; name?: string; qty: number; unitCost?: number }[];
  partsCost?: number;
  mileage?: number;
  notes?: string;
  priority?: string;
  provider?: string;
  createdAt: any;
  updatedAt: any;
  /** Preenchidos quando a ordem nasceu de um checklist do motorista. */
  checklistId?: string;
  checklistItemId?: string | null;
}

export interface Truck {
  id: string;
  fleetId?: string;
  name?: string;
  unitNumber?: string;
  plate?: string;
  vin?: string;
  brand?: string;
  model?: string;
  mileage?: number;
  currentKm?: number;
}

export interface PartDoc {
  id: string;
  name: string;
  partNumber: string;
  quantity: number;
  cost: number;
  category: string;
  supplier: string;
  minQuantity: number;
  truckId?: string;
  status: string;
}

export interface SelectedPart {
  id: string;
  quantity: number;
}

export type SortField = 'date' | 'cost' | null;
export type SortDir = 'asc' | 'desc';
