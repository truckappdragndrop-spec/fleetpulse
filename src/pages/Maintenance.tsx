import React, { useState, useMemo } from 'react';
import { useCollection } from '@/hooks/useCollection';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Wrench, Search, Filter, Package, Minus, PlusCircle, ArrowUpDown, ArrowUp, ArrowDown, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { format, isValid } from 'date-fns';

interface MaintenanceRecord {
  id: string;
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
}

interface Truck {
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

interface PartDoc {
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

interface SelectedPart {
  id: string;
  quantity: number;
}

type SortField = "date" | "cost" | null;
type SortDir = "asc" | "desc";

const safeFormatDate = (dateValue: any, formatStr: string = 'yyyy-MM-dd'): string => {
  try {
    if (!dateValue) return '-';
    let date: Date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue.toDate === 'function') {
      date = dateValue.toDate();
    } else if (dateValue.seconds && typeof dateValue.seconds === 'number') {
      date = new Date(dateValue.seconds * 1000);
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else if (typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      return '-';
    }
    if (!isValid(date) || isNaN(date.getTime())) {
      return '-';
    }
    return format(date, formatStr);
  } catch (e) {
    return '-';
  }
};

const safeToDateInput = (dateValue: any): string => {
  try {
    if (!dateValue) return format(new Date(), 'yyyy-MM-dd');
    let date: Date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue.toDate === 'function') {
      date = dateValue.toDate();
    } else if (dateValue.seconds && typeof dateValue.seconds === 'number') {
      date = new Date(dateValue.seconds * 1000);
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
    } else {
      return format(new Date(), 'yyyy-MM-dd');
    }
    if (!isValid(date) || isNaN(date.getTime())) {
      return format(new Date(), 'yyyy-MM-dd');
    }
    return format(date, 'yyyy-MM-dd');
  } catch (e) {
    return format(new Date(), 'yyyy-MM-dd');
  }
};

const Maintenance = () => {
  const { data: maintenanceRecords, isLoading: recordsLoading, create: createRecord, update: updateRecord, remove: removeRecord } = useCollection<MaintenanceRecord>('maintenance');
  const { data: trucks, isLoading: trucksLoading } = useCollection<Truck>('trucks');
  const { data: parts, isLoading: partsLoading, update: updatePart } = useCollection<PartDoc>('parts');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [woOpen, setWoOpen] = useState(false);

  const handlePrintWo = () => {
    const content = document.getElementById('work-order-print');
    if (!content) return;
    const win = window.open('', '_blank', 'width=850,height=900');
    if (!win) { alert('Please allow popups to print'); return; }
    win.document.write('<html><head><title>Work Order</title></head><body style="margin:0;padding:24px;background:#fff;">' + content.innerHTML + '</body></html>');
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(function(el) {
      win.document.head.appendChild(el.cloneNode(true));
    });
    win.document.close();
    win.focus();
    setTimeout(function() { win.print(); }, 400);
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

  const maintenanceTypes = [
    'Oil Change',
    'Tire Inspection',
    'Brake Check',
    'Engine Tune-up',
    'Filter Replacement',
    'Electrical',
    'Suspension',
    'Transmission',
    'Cooling System',
    'Other'
  ];

  const priorities = ['Low', 'Medium', 'High'];

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
    const matchesSearch =
      (record.truckName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.title || record.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.mechanic || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.type || '').toLowerCase().includes(searchTerm.toLowerCase());

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.truckId || !formData.type || !formData.title) {
      toast.error('Please fill in all required fields');
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
        const oldWoParts = (selectedRecord as any).woParts || [];
        const oldPartIds = oldWoParts.length > 0 ? oldWoParts.flatMap((wp: any) => Array(wp.qty || 1).fill(wp.id)) : (selectedRecord.partIds || []);
        const newPartIds = formData.selectedParts.map(sp => sp.id);

        for (const partId of oldPartIds) {
          const part = parts?.find(p => p.id === partId);
          if (part) {
            await updatePart(partId, { quantity: part.quantity + 1 });
          }
        }

        for (const sp of formData.selectedParts) {
          const part = parts?.find(p => p.id === sp.id);
          if (part && part.quantity >= sp.quantity) {
            await updatePart(sp.id, { quantity: part.quantity - sp.quantity });
          }
        }

        await updateRecord(selectedRecord.id, recordData);
        toast.success('Maintenance record updated successfully');
      } else {
        for (const sp of formData.selectedParts) {
          const part = parts?.find(p => p.id === sp.id);
          if (part && part.quantity >= sp.quantity) {
            await updatePart(sp.id, { quantity: part.quantity - sp.quantity });
          }
        }

        await createRecord(recordData);
        toast.success('Maintenance record added successfully');
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving maintenance record:', error);
      toast.error('Failed to save maintenance record');
    }
  };

  const handleDelete = async (record: MaintenanceRecord) => {
    if (!confirm('Are you sure you want to delete this maintenance record?')) return;

    try {
      const delWoParts = (record as any).woParts || [];
      const delPartIds = delWoParts.length > 0 ? delWoParts.flatMap((wp: any) => Array(wp.qty || 1).fill(wp.id)) : (record.partIds || []);
      if (delPartIds.length > 0) {
        for (const partId of delPartIds) {
          const part = parts?.find(p => p.id === partId);
          if (part) {
            await updatePart(partId, { quantity: part.quantity + 1 });
          }
        }
      }

      await removeRecord(record.id);
      toast.success('Maintenance record deleted successfully');
    } catch (error) {
      toast.error('Failed to delete maintenance record');
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
      toast.error('Failed to open edit dialog');
    }
  };

  const handleStatusChange = async (recordId: string, newStatus: string) => {
    try {
      await updateRecord(recordId, { status: newStatus });
      toast.success('Status updated successfully');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-400';
      case 'Medium': return 'text-primary';
      case 'Low': return 'text-green-400';
      default: return 'text-muted-foreground';
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
            <Button
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Maintenance
            </Button>
          </div>

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
                placeholder="Search maintenance..."
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
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No maintenance records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRecords.map((record) => (
                      <TableRow key={record.id} className="border-border hover:bg-secondary/60">
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
                    {maintenanceTypes.map((type) => (
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
                    {priorities.map((p) => (
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

      <Dialog open={woOpen} onOpenChange={setWoOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-black">
          
          <div className="flex items-center justify-between">
            <DialogHeader>
              <DialogTitle className="text-black">Work Order</DialogTitle>
            </DialogHeader>
            <Button onClick={handlePrintWo} className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
              <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
            </Button>
          </div>

          {selectedRecord && (() => {
            const truck = trucks?.find(t => t.id === selectedRecord.truckId);
            const savedWoParts = (selectedRecord as any).woParts || [];
            const woParts = savedWoParts.length > 0
              ? savedWoParts.map((wp: any) => ({ id: wp.id, name: wp.name || 'Part', cost: wp.unitCost || 0, qty: wp.qty || 1 }))
              : (selectedRecord.partIds || []).map(pid => {
                  const p = parts?.find(pp => pp.id === pid);
                  return { id: pid, name: p?.name || 'Part', cost: p?.cost || 0, qty: 1 };
                });
            const partsTotal = parseFloat(String(selectedRecord.partsCost || 0));
            const laborTotal = parseFloat(String(selectedRecord.cost || 0));
            const woNumber = 'WO-' + selectedRecord.id.slice(-6).toUpperCase();
            const statusLabel = selectedRecord.status === 'completed' ? 'Completed' : selectedRecord.status === 'in-progress' ? 'In Progress' : 'Pending';
            return (
              <div id="work-order-print" className="mt-4 text-black">
                <div className="flex items-start justify-between pb-4 border-b-2 border-green-600">
                  <div>
                    <h1 className="text-2xl font-bold text-green-600">DRAG N' DROP</h1>
                    <p className="text-sm text-gray-600">Fleet Maintenance</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold">WORK ORDER</h2>
                    <p className="text-sm font-mono">{woNumber}</p>
                    <p className="text-xs text-gray-600">Generated: {format(new Date(), 'MM/dd/yyyy')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="border border-gray-300 rounded p-3">
                    <h3 className="text-xs font-bold text-gray-500 mb-2">VEHICLE</h3>
                    <p className="font-semibold">{truck ? (truck.fleetId || truck.id) + ' - ' + (truck.brand || '') + ' ' + (truck.model || '') : selectedRecord.truckName}</p>
                    <div className="text-sm mt-1 space-y-0.5">
                      <p><span className="text-gray-500">Plate:</span> {truck?.plate || '-'}</p>
                      <p><span className="text-gray-500">VIN:</span> {truck?.vin || '-'}</p>
                      <p><span className="text-gray-500">Odometer:</span> {Number(selectedRecord.mileage || truck?.currentKm || truck?.mileage || 0).toLocaleString()} mi</p>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded p-3">
                    <h3 className="text-xs font-bold text-gray-500 mb-2">SERVICE</h3>
                    <div className="text-sm space-y-0.5">
                      <p><span className="text-gray-500">Date:</span> {safeFormatDate(selectedRecord.date, 'MM/dd/yyyy')}</p>
                      <p><span className="text-gray-500">Type:</span> {selectedRecord.type || '-'}</p>
                      <p><span className="text-gray-500">Priority:</span> {selectedRecord.priority || 'Medium'}</p>
                      <p><span className="text-gray-500">Status:</span> {statusLabel}</p>
                      <p><span className="text-gray-500">Provider:</span> {selectedRecord.provider || selectedRecord.mechanic || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-300 rounded p-3 mt-4">
                  <h3 className="text-xs font-bold text-gray-500 mb-1">SERVICE DESCRIPTION</h3>
                  <p className="font-semibold">{selectedRecord.title || selectedRecord.description || '-'}</p>
                  {selectedRecord.description && selectedRecord.title && (
                    <p className="whitespace-pre-wrap text-sm text-gray-700 mt-1">{selectedRecord.description}</p>
                  )}
                </div>

                {woParts.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-xs font-bold text-gray-500 mb-1">PARTS USED</h3>
                    <table className="w-full text-sm border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left p-2 border-b border-gray-300">Part</th>
                          <th className="text-center p-2 border-b border-gray-300 w-16">Qty</th>
                          <th className="text-right p-2 border-b border-gray-300 w-24">Unit</th>
                          <th className="text-right p-2 border-b border-gray-300 w-24">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {woParts.map(wp => (
                          <tr key={wp.id}>
                            <td className="p-2 border-b border-gray-200">{wp.name}</td>
                            <td className="p-2 border-b border-gray-200 text-center">{wp.qty}</td>
                            <td className="p-2 border-b border-gray-200 text-right">{'$' + wp.cost.toFixed(2)}</td>
                            <td className="p-2 border-b border-gray-200 text-right">{'$' + (wp.cost * wp.qty).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <div className="w-64 border border-gray-300 rounded p-3 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Labor:</span><span>{'$' + laborTotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Parts:</span><span>{'$' + partsTotal.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold text-base border-t border-gray-300 mt-2 pt-2"><span>TOTAL:</span><span className="text-green-700">{'$' + (laborTotal + partsTotal).toFixed(2)}</span></div>
                  </div>
                </div>

                {selectedRecord.notes && (
                  <div className="border border-gray-300 rounded p-3 mt-4">
                    <h3 className="text-xs font-bold text-gray-500 mb-1">NOTES</h3>
                    <p className="text-sm">{selectedRecord.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-6 mt-10">
                  <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">Authorized by</div>
                  <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">Mechanic</div>
                  <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">Date</div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Maintenance;
