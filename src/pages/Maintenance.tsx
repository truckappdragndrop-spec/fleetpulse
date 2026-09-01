import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useCollection } from '@/hooks/useCollection';
import { useDialogs } from '@/components/Dialogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Wrench, Search, Filter, Package, Minus, PlusCircle, ArrowUpDown, ArrowUp, ArrowDown, Printer, Hash, Loader2, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { displayWoNumber, nextWorkOrderNumber, woSearchTerms } from '@/lib/workOrderNumber';
import { clearWorkOrderLink, resolveChecklistFromWorkOrder } from '@/lib/checklistLink';
import { consumeParts, findShortages, returnParts, type StockLine, type WorkOrderContext } from '@/lib/stock';
import { applyOilChangeToTruck } from '@/lib/truckSync';
import WorkOrderDialog from './maintenance/WorkOrderDialog';
import type { MaintenanceRecord, PartDoc, SelectedPart, SortDir, SortField, Truck } from './maintenance/types';
import {
  MAINTENANCE_TYPES,
  PRIORITIES,
  getPriorityColor,
  safeFormatDate,
  safeToDateInput,
} from './maintenance/utils';

const Maintenance = () => {
  const navigate = useNavigate();
  const { data: maintenanceRecords, isLoading: recordsLoading, create: createRecord, update: updateRecord, remove: removeRecord } = useCollection<MaintenanceRecord>('maintenance');
  const { confirm, notify } = useDialogs();
  const { data: trucks, isLoading: trucksLoading } = useCollection<Truck>('trucks');
  const { data: parts, isLoading: partsLoading } = useCollection<PartDoc>('parts');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [woOpen, setWoOpen] = useState(false);
  const [numbering, setNumbering] = useState(false);

  // Manutenções gravadas antes desta funcionalidade, ainda sem número.
  const unnumbered = (maintenanceRecords || []).filter(r => !r.woNumber);

  // Percorre o histórico em ordem de data e atribui um número a cada uma,
  // usando o mesmo contador das ordens novas. Some da tela quando termina.
  const numberOldRecords = async () => {
    if (numbering || unnumbered.length === 0) return;
    const ok = await confirm({
      title: `Number ${unnumbered.length} older records?`,
      message: 'Vai atribuir um número de ordem de serviço a cada manutenção antiga, da mais velha para a mais nova. Roda uma vez só.',
      confirmLabel: 'Number them',
    });
    if (!ok) return;

    setNumbering(true);
    try {
      const inOrder = [...unnumbered].sort((a, b) =>
        safeToDateInput(a.date).localeCompare(safeToDateInput(b.date))
      );
      for (const record of inOrder) {
        const { number } = await nextWorkOrderNumber();
        await updateRecord(record.id, { woNumber: number } as Partial<MaintenanceRecord>);
      }
      notify(`${inOrder.length} records numbered / numeradas`, 'success');
    } catch (error) {
      console.error('Error numbering old records:', error);
      notify('Could not finish numbering — run it again to continue', 'error');
    } finally {
      setNumbering(false);
    }
  };

  const [formData, setFormData] = useState({
    truckId: '',
    type: '',
    title: '',
    description: '',
    cost: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending' as const,
    mechanic: '',
    mileage: '',
    notes: '',
    priority: 'Medium',
    provider: '',
    selectedParts: [] as SelectedPart[]
  });

  const selectedPartsCost = useMemo(() => {
    if (!parts || !formData.selectedParts.length) return 0;
    return formData.selectedParts.reduce((total, sp) => {
      const part = parts.find(p => p.id === sp.id);
      return total + ((part?.cost || 0) * sp.quantity);
    }, 0);
  }, [parts, formData.selectedParts]);

  const laborCost = parseFloat(formData.cost) || 0;
  const totalCost = laborCost + selectedPartsCost;

  const filteredRecords = maintenanceRecords?.filter(record => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      // Número da ordem de serviço: aceita "WO-0042", "0042" ou "42"
      woSearchTerms(record).includes(term) ||
      (record.truckName || '').toLowerCase().includes(term) ||
      (record.title || record.description || '').toLowerCase().includes(term) ||
      (record.mechanic || '').toLowerCase().includes(term) ||
      (record.provider || '').toLowerCase().includes(term) ||
      (record.type || '').toLowerCase().includes(term);

    const matchesStatus = filterStatus === 'all' || record.status === filterStatus;

    return matchesSearch && matchesStatus;
  }) || [];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-muted-foreground opacity-50" />;
    return sortDir === "asc" ? <ArrowUp size={14} className="text-primary" /> : <ArrowDown size={14} className="text-primary" />;
  };

  const sortedRecords = [...filteredRecords].sort((a, b) => {
    if (!sortField) return 0;
    let valA: any, valB: any;
    if (sortField === "date") {
      valA = a.date ? (a.date instanceof Date ? a.date : typeof a.date.toDate === 'function' ? a.date.toDate() : new Date(a.date)) : new Date(0);
      valB = b.date ? (b.date instanceof Date ? b.date : typeof b.date.toDate === 'function' ? b.date.toDate() : new Date(b.date)) : new Date(0);
    } else if (sortField === "cost") {
      valA = parseFloat(String(a.cost || 0)) + parseFloat(String(a.partsCost || 0));
      valB = parseFloat(String(b.cost || 0)) + parseFloat(String(b.partsCost || 0));
    }
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  /**
   * Peças abaixo do estoque mínimo que estão em ordens ainda não concluídas.
   * Serve para comprar antes de o mecânico chegar e não ter a peça.
   */
  const lowStockInOpenOrders = (() => {
    const open = (maintenanceRecords || []).filter(r => r.status !== 'completed');
    const needed = new Set<string>();
    open.forEach(r => {
      const saved = (r as any).woParts || [];
      if (saved.length > 0) saved.forEach((wp: any) => needed.add(wp.id));
      else (r.partIds || []).forEach(id => needed.add(id));
    });
    return (parts || []).filter(p => {
      if (!needed.has(p.id)) return false;
      const min = Number((p as any).minStock ?? p.minQuantity ?? 0);
      return min > 0 && Number(p.quantity || 0) <= min;
    });
  })();

  /** Peças de um registro já gravado, no formato usado pelo estoque. */
  const linesFromRecord = (record: MaintenanceRecord): StockLine[] => {
    const saved = (record as any).woParts || [];
    if (saved.length > 0) {
      return saved.map((wp: any) => ({
        partId: wp.id,
        partName: wp.name || parts?.find(p => p.id === wp.id)?.name || 'Part',
        quantity: Number(wp.qty) || 1,
        unitCost: Number(wp.unitCost) || 0,
      }));
    }
    // Registros antigos guardavam só a lista de ids, uma unidade cada.
    return (record.partIds || []).map(id => {
      const part = parts?.find(p => p.id === id);
      return { partId: id, partName: part?.name || 'Part', quantity: 1, unitCost: Number(part?.cost) || 0 };
    });
  };

  /** Peças escolhidas agora no formulário. */
  const linesFromForm = (): StockLine[] =>
    formData.selectedParts.map(sp => {
      const part = parts?.find(p => p.id === sp.id);
      return {
        partId: sp.id,
        partName: part?.name || 'Part',
        quantity: sp.quantity,
        unitCost: Number(part?.cost) || 0,
      };
    });

  const stockContext = (woNumber: string, maintenanceId?: string): WorkOrderContext => ({
    woNumber,
    maintenanceId,
    truckName: trucks?.find(t => t.id === formData.truckId)?.fleetId || formData.truckId,
    date: formData.date,
  });

  /**
   * Avisa se falta saldo e deixa a decisão com quem está gravando.
   *
   * `credit` são as peças que a ordem já usava e serão devolvidas antes de
   * consumir a lista nova — sem isso, editar uma ordem sem mexer nas peças
   * acusaria falta de estoque, porque o saldo atual já está descontado.
   */
  const confirmShortages = async (lines: StockLine[], credit: StockLine[] = []) => {
    const available = (parts || []).map(p => {
      const back = credit
        .filter(c => c.partId === p.id)
        .reduce((sum, c) => sum + c.quantity, 0);
      return { ...p, quantity: Number(p.quantity || 0) + back };
    });
    const shortages = findShortages(lines, available);
    if (shortages.length === 0) return true;
    const detail = shortages
      .map(sh => `${sh.partName}: precisa ${sh.needed}, tem ${sh.available}`)
      .join(' • ');
    return confirm({
      title: 'Not enough stock / Estoque insuficiente',
      message: `${detail}. O saldo vai parar em zero e a ordem fica registrada com a quantidade que você pediu. Gravar assim mesmo?`,
      confirmLabel: 'Save anyway',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.truckId || !formData.type || !formData.title) {
      notify('Please fill in all required fields', "error");
      return;
    }

    const selectedTruck = trucks?.find(t => t.id === formData.truckId);

    try {
      const recordData = {
        truckId: formData.truckId,
        truckName: `${selectedTruck?.fleetId || selectedTruck?.id || ''} - ${selectedTruck?.brand || selectedTruck?.model || 'Truck'} (${(selectedTruck?.currentKm || selectedTruck?.mileage || 0).toLocaleString()} mi)`,
        type: formData.type,
        title: formData.title,
        description: formData.description,
        cost: Number(laborCost),
        partsCost: Number(selectedPartsCost),
        date: new Date(formData.date + "T12:00:00"),
        status: formData.status,
        mechanic: formData.mechanic || formData.provider,
        mileage: parseInt(formData.mileage) || 0,
        notes: formData.notes,
        priority: formData.priority,
        provider: formData.provider,
        partIds: formData.selectedParts.map(sp => sp.id),
        woParts: formData.selectedParts.map(sp => {
          const part = parts?.find(p => p.id === sp.id);
          return { id: sp.id, name: part?.name || 'Part', qty: sp.quantity, unitCost: part?.cost || 0 };
        }),
      };

      if (selectedRecord) {
        const woNumber = displayWoNumber(selectedRecord);
        const ctx = stockContext(woNumber, selectedRecord.id);
        const oldLines = linesFromRecord(selectedRecord);
        const newLines = linesFromForm();

        if (!(await confirmShortages(newLines, oldLines))) return;

        // Devolve o que a ordem usava antes e consome a lista nova. As duas
        // operações passam pelo histórico, então o Inventory mostra a troca.
        await returnParts(oldLines, ctx);
        await consumeParts(newLines, ctx);

        await updateRecord(selectedRecord.id, recordData);
        notify('Maintenance record updated successfully', "success");
        if (formData.status === 'completed' && selectedRecord.status !== 'completed') {
          // Usa os dados recém-gravados (tipo e milhagem podem ter mudado).
          await onRecordCompleted({ ...selectedRecord, ...recordData } as MaintenanceRecord);
        }
      } else {
        const newLines = linesFromForm();
        if (!(await confirmShortages(newLines))) return;

        // Toda manutenção nasce com um número de ordem de serviço.
        const { number: woNumber, provisional } = await nextWorkOrderNumber();
        const newId = await createRecord({ ...recordData, woNumber } as typeof recordData & { woNumber: string });
        await consumeParts(newLines, stockContext(woNumber, newId));
        notify(
          provisional
            ? `${woNumber} saved with a temporary number / número provisório`
            : `${woNumber} created / criada`,
          provisional ? "warning" : "success"
        );
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving maintenance record:', error);
      notify('Failed to save maintenance record', "error");
    }
  };

  const handleDelete = async (record: MaintenanceRecord) => {
    const ok = await confirm({
      title: 'Delete maintenance record?',
      message: 'Parts used will be returned to stock. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      const woNumber = displayWoNumber(record);
      await returnParts(linesFromRecord(record), {
        woNumber,
        maintenanceId: record.id,
        truckName: record.truckName || record.truckId,
        date: safeToDateInput(record.date),
      });

      // Solta o item do checklist, para que outra ordem possa ser aberta.
      const released = await clearWorkOrderLink(record);

      await removeRecord(record.id);
      notify(
        released
          ? 'Record deleted — checklist item released / item do checklist liberado'
          : 'Maintenance record deleted successfully',
        "success"
      );
    } catch (error) {
      notify('Failed to delete maintenance record', "error");
    }
  };

  const resetForm = () => {
    setFormData({
      truckId: '',
      type: '',
      title: '',
      description: '',
      cost: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      status: 'pending',
      mechanic: '',
      mileage: '',
      notes: '',
      priority: 'Medium',
      provider: '',
      selectedParts: []
    });
    setSelectedRecord(null);
  };

  const handleEdit = (record: MaintenanceRecord) => {
    try {
      const safeRecord = {
        truckId: record.truckId || '',
        type: record.type || '',
        title: record.title || record.description || '',
        description: record.description || record.title || '',
        cost: typeof record.cost === 'number' ? record.cost :
              typeof record.cost === 'string' ? parseFloat(record.cost) || 0 : 0,
        date: record.date,
        status: record.status || 'pending',
        mechanic: record.mechanic || record.provider || '',
        mileage: typeof record.mileage === 'number' ? record.mileage :
                 typeof record.mileage === 'string' ? parseInt(record.mileage) || 0 : 0,
        notes: record.notes || '',
        priority: record.priority || 'Medium',
        provider: record.provider || record.mechanic || '',
        partIds: Array.isArray(record.partIds) ? record.partIds : []
      };

      setSelectedRecord(record);
      setFormData({
        truckId: safeRecord.truckId,
        type: safeRecord.type,
        title: safeRecord.title,
        description: safeRecord.description,
        cost: safeRecord.cost.toString(),
        date: safeToDateInput(safeRecord.date),
        status: safeRecord.status as any,
        mechanic: safeRecord.mechanic,
        mileage: safeRecord.mileage.toString(),
        notes: safeRecord.notes,
        priority: safeRecord.priority,
        provider: safeRecord.provider,
        selectedParts: ((record as any).woParts && (record as any).woParts.length > 0)
          ? (record as any).woParts.map((wp: any) => ({ id: wp.id, quantity: wp.qty || 1 }))
          : safeRecord.partIds.map(id => ({ id, quantity: 1 }))
      });
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Error opening edit dialog:', error);
      notify('Failed to open edit dialog', "error");
    }
  };

  /**
   * Ao concluir uma ordem que nasceu de um checklist, resolve o item lá também.
   * Evita ter que ir na tela de Checklists clicar em "Fixed" de novo.
   */
  const syncChecklistOnComplete = async (record?: MaintenanceRecord | null) => {
    if (!record?.checklistId) return;
    const { updated, checklistClosed } = await resolveChecklistFromWorkOrder(record);
    if (!updated) return;
    notify(
      checklistClosed
        ? 'Checklist item marked fixed — checklist closed / checklist encerrado'
        : 'Checklist item marked fixed / item do checklist marcado como resolvido',
      'success'
    );
  };

  /** Tudo que precisa acontecer em outras telas quando uma ordem é concluída. */
  const onRecordCompleted = async (record?: MaintenanceRecord | null) => {
    if (!record) return;
    await syncChecklistOnComplete(record);

    // Troca de óleo concluída zera o contador do caminhão e apaga o alerta.
    const miles = await applyOilChangeToTruck(record);
    if (miles) {
      notify(
        `Oil change registered at ${miles.toLocaleString()} mi / troca de óleo registrada`,
        'success'
      );
    }
  };

  const handleStatusChange = async (recordId: string, newStatus: string) => {
    try {
      await updateRecord(recordId, { status: newStatus });
      notify('Status updated successfully', "success");
      if (newStatus === 'completed') {
        const record = maintenanceRecords?.find(r => r.id === recordId);
        await onRecordCompleted(record);
      }
    } catch (error) {
      notify('Failed to update status', "error");
    }
  };

  const handlePartAdd = (partId: string) => {
    setFormData(prev => {
      const existing = prev.selectedParts.find(sp => sp.id === partId);
      if (existing) {
        return {
          ...prev,
          selectedParts: prev.selectedParts.map(sp =>
            sp.id === partId ? { ...sp, quantity: sp.quantity + 1 } : sp
          )
        };
      }
      return {
        ...prev,
        selectedParts: [...prev.selectedParts, { id: partId, quantity: 1 }]
      };
    });
  };

  const handlePartQuantityChange = (partId: string, delta: number) => {
    setFormData(prev => {
      const updated = prev.selectedParts.map(sp => {
        if (sp.id !== partId) return sp;
        const newQty = Math.max(1, sp.quantity + delta);
        return { ...sp, quantity: newQty };
      });
      return { ...prev, selectedParts: updated };
    });
  };

  const handlePartRemove = (partId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedParts: prev.selectedParts.filter(sp => sp.id !== partId)
    }));
  };

  const getAvailableParts = () => {
    if (!parts) return [];
    return parts.filter(p => p.quantity > 0 && p.id && p.id.trim() !== '');
  };

  const getSelectedPartDetails = () => {
    if (!parts || !formData.selectedParts.length) return [];
    return formData.selectedParts.map(sp => {
      const part = parts.find(p => p.id === sp.id);
      if (!part) return null;
      return {
        id: sp.id,
        name: part.name,
        stock: part.quantity,
        cost: part.cost,
        quantity: sp.quantity,
        total: part.cost * sp.quantity
      };
    }).filter(Boolean) as { id: string; name: string; stock: number; cost: number; quantity: number; total: number }[];
  };

  if (recordsLoading || trucksLoading || partsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="text-foreground">
      <div>
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Maintenance</h1>
              <p className="text-muted-foreground">Schedule and track maintenance</p>
            </div>
            <div className="flex items-center gap-2">
              {unnumbered.length > 0 && (
                <Button
                  onClick={numberOldRecords}
                  disabled={numbering}
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-secondary"
                  title="Assign work order numbers to older records"
                >
                  {numbering
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Hash className="h-4 w-4 mr-2" />}
                  {numbering ? 'Numbering...' : `Number ${unnumbered.length} older`}
                </Button>
              )}
              <Button
                onClick={() => { resetForm(); setIsDialogOpen(true); }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Maintenance
              </Button>
            </div>
          </div>

          {lowStockInOpenOrders.length > 0 && (
            <button
              onClick={() => navigate('/inventory')}
              className="w-full mb-4 p-3 rounded-xl text-left flex items-start gap-3"
              style={{ background: 'rgba(232,168,56,0.10)', border: '1px solid rgba(232,168,56,0.30)' }}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--accent-amber)' }} />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--accent-amber)' }}>
                  {lowStockInOpenOrders.length} part{lowStockInOpenOrders.length !== 1 ? 's' : ''} running out on open orders
                  <span className="font-normal" style={{ color: 'var(--text-muted)' }}> / peças acabando em ordens abertas</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {lowStockInOpenOrders.map(p => `${p.name} (${p.quantity})`).join(' • ')}
                </p>
              </div>
            </button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{maintenanceRecords?.filter(r => r.status === 'pending').length || 0}</div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{maintenanceRecords?.filter(r => {
                    try {
                      const date = r.date instanceof Date ? r.date : r.date?.toDate ? r.date.toDate() : new Date(r.date);
                      return r.status === 'pending' && isValid(date) && date < new Date();
                    } catch { return false; }
                  }).length || 0}</div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{maintenanceRecords?.filter(r => r.status === 'completed').length || 0}</div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{maintenanceRecords?.length || 0}</div>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search WO #, truck, service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card border-border text-foreground"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 bg-card border-border text-foreground">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground whitespace-nowrap">WO #</TableHead>
                    <TableHead className="text-muted-foreground">Truck</TableHead>
                    <TableHead className="text-muted-foreground">Type</TableHead>
                    <TableHead className="text-muted-foreground">Title</TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("date")}>
                      <div className="flex items-center gap-1">Date {getSortIcon("date")}</div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">Priority</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Parts</TableHead>
                    <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => handleSort("cost")}>
                      <div className="flex items-center gap-1">Total Cost {getSortIcon("cost")}</div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No maintenance records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRecords.map((record) => (
                      <TableRow key={record.id} className="border-border hover:bg-secondary/60">
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm whitespace-nowrap" style={{ color: record.woNumber ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                              {displayWoNumber(record)}
                            </span>
                            {record.checklistId && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/checklists?wo=${encodeURIComponent(displayWoNumber(record))}`);
                                }}
                                title="Opened from a driver checklist — click to see the original / Aberta a partir de um checklist"
                                className="p-0.5 rounded hover:bg-white/10"
                                style={{ color: 'var(--accent-green)' }}
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-primary">{record.truckName || 'Unknown'}</div>
                          <div className="text-sm text-muted-foreground">{record.type || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-border text-foreground">
                            {record.type || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{record.title || record.description || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {safeFormatDate(record.date, 'yyyy-MM-dd')}
                        </TableCell>
                        <TableCell className={getPriorityColor(record.priority || 'Medium')}>
                          {record.priority || 'Medium'}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            record.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            record.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {record.status === 'pending' ? 'Pending' :
                             record.status === 'in-progress' ? 'In Progress' : 'Completed'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {record.partIds && record.partIds.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Package className="h-4 w-4 text-primary" />
                              <span className="text-sm text-muted-foreground">{record.partIds.length}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-green-400 font-medium">
                          ${(parseFloat(String(record.cost || 0)) + parseFloat(String(record.partsCost || 0))).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStatusChange(record.id, record.status === 'completed' ? 'pending' : 'completed')}
                              className="p-1 hover:bg-secondary rounded"
                            >
                              <Wrench className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => handleEdit(record)}
                              className="p-1 hover:bg-secondary rounded"
                            >
                              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(record)}
                              className="p-1 hover:bg-secondary rounded"
                            >
                              <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedRecord ? 'Edit Maintenance' : 'New Maintenance'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="truck" className="text-foreground">Truck *</Label>
                <Select
                  value={formData.truckId || undefined}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, truckId: value }))}
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="bg-secondary border-border">
                    {trucks?.filter(t => t.id && t.id.trim() !== '').map((truck) => (
                      <SelectItem key={truck.id} value={truck.id} className="text-foreground hover:bg-secondary">
                        {truck.fleetId || truck.id} - {truck.brand || truck.model || truck.name || 'Truck'} ({(truck.currentKm || truck.mileage || 0).toLocaleString()} mi)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type" className="text-foreground">Type *</Label>
                <Select
                  value={formData.type || undefined}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="bg-secondary border-border">
                    {MAINTENANCE_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="text-foreground hover:bg-secondary">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. 100k mile oil change"
                className="bg-secondary border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Maintenance details..."
                className="w-full min-h-[80px] p-3 bg-secondary border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-foreground">Scheduled Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="bg-secondary border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mileage" className="text-foreground">Scheduled Miles</Label>
                <Input
                  id="mileage"
                  type="number"
                  value={formData.mileage}
                  onChange={(e) => setFormData(prev => ({ ...prev, mileage: e.target.value }))}
                  placeholder="150000"
                  className="bg-secondary border-border text-foreground"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Parts Used
              </Label>
              <div className="relative">
                <select
                  className="w-full h-10 px-3 bg-secondary border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
                  value=""
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) handlePartAdd(value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Select part...</option>
                  {getAvailableParts().map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.name} (Stock: {part.quantity}) - ${part.cost.toFixed(2)}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {formData.selectedParts.length > 0 && (
                <div className="space-y-2 mt-2">
                  {getSelectedPartDetails().map((detail) => (
                    <div key={detail.id} className="flex items-center justify-between bg-secondary p-2 rounded">
                      <div className="flex-1">
                        <span className="text-sm text-foreground">{detail.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">(${detail.cost.toFixed(2)} each)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePartQuantityChange(detail.id, -1)}
                            className="w-6 h-6 flex items-center justify-center bg-secondary hover:bg-secondary rounded text-foreground text-xs"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm text-foreground w-6 text-center">{detail.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handlePartQuantityChange(detail.id, 1)}
                            className="w-6 h-6 flex items-center justify-center bg-secondary hover:bg-secondary rounded text-foreground text-xs"
                            disabled={detail.quantity >= detail.stock}
                          >
                            <PlusCircle className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm text-primary w-16 text-right">${detail.total.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => handlePartRemove(detail.id)}
                          className="text-red-400 hover:text-red-300 text-sm ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="text-sm text-primary font-medium text-right">
                    Parts Cost: ${selectedPartsCost.toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost" className="text-foreground">Labor Cost ($)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                  placeholder="0.00"
                  className="bg-secondary border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalCost" className="text-foreground">Total Cost</Label>
                <div className="flex items-center h-10 px-3 bg-secondary border border-border rounded-md">
                  <span className="text-green-400 font-bold">${totalCost.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-foreground">Priority</Label>
                <Select
                  value={formData.priority || undefined}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger className="bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-secondary border-border">
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="text-foreground hover:bg-secondary">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider" className="text-foreground">Provider</Label>
                <Input
                  id="provider"
                  value={formData.provider}
                  onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                  placeholder="Shop or provider name"
                  className="bg-secondary border-border text-foreground"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              {selectedRecord && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWoOpen(true)}
                  className="border-green-600 text-green-500 hover:bg-secondary"
                >
                  <Printer className="h-4 w-4 mr-2" /> Work Order
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => { resetForm(); setIsDialogOpen(false); }}
                className="flex-1 border-border text-foreground hover:bg-secondary"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                {selectedRecord ? 'Update' : 'Schedule'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <WorkOrderDialog
        open={woOpen}
        onOpenChange={setWoOpen}
        record={selectedRecord}
        trucks={trucks}
        parts={parts}
      />
    </div>
  );
};

export default Maintenance;
