import { format } from 'date-fns';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDialogs } from '@/components/Dialogs';
import { safeFormatDate } from './utils';
import { displayWoNumber } from '@/lib/workOrderNumber';
import type { MaintenanceRecord, PartDoc, Truck } from './types';

/**
 * Ordem de serviço em papel — a única tela do sistema que é branca de
 * propósito, porque existe para ser impressa ou salva em PDF.
 */
export default function WorkOrderDialog({
  open,
  onOpenChange,
  record,
  trucks,
  parts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: MaintenanceRecord | null;
  trucks?: Truck[];
  parts?: PartDoc[];
}) {
  const { notify } = useDialogs();

  const handlePrint = () => {
    const content = document.getElementById('work-order-print');
    if (!content) return;
    const win = window.open('', '_blank', 'width=850,height=900');
    if (!win) {
      notify('Please allow pop-ups to print the work order', 'warning');
      return;
    }
    win.document.write(
      '<html><head><title>Work Order</title></head><body style="margin:0;padding:24px;background:#fff;">' +
        content.innerHTML +
        '</body></html>'
    );
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(function (el) {
      win.document.head.appendChild(el.cloneNode(true));
    });
    win.document.close();
    win.focus();
    setTimeout(function () {
      win.print();
    }, 400);
  };

  const truck = record ? trucks?.find((t) => t.id === record.truckId) : undefined;

  const savedWoParts = (record as any)?.woParts || [];
  const woParts: { id: string; name: string; cost: number; qty: number }[] = !record
    ? []
    : savedWoParts.length > 0
      ? savedWoParts.map((wp: any) => ({
          id: wp.id,
          name: wp.name || 'Part',
          cost: wp.unitCost || 0,
          qty: wp.qty || 1,
        }))
      : (record.partIds || []).map((pid) => {
          const p = parts?.find((pp) => pp.id === pid);
          return { id: pid, name: p?.name || 'Part', cost: p?.cost || 0, qty: 1 };
        });

  const partsTotal = parseFloat(String(record?.partsCost || 0));
  const laborTotal = parseFloat(String(record?.cost || 0));
  // Usa o número gravado; registros antigos caem no código derivado do id.
  const woNumber = displayWoNumber(record);
  const statusLabel =
    record?.status === 'completed'
      ? 'Completed'
      : record?.status === 'in-progress'
        ? 'In Progress'
        : 'Pending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-black">
        <div className="flex items-center justify-between">
          <DialogHeader>
            <DialogTitle className="text-black">Work Order</DialogTitle>
          </DialogHeader>
          <Button
            onClick={handlePrint}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
          </Button>
        </div>

        {record && (
          <div id="work-order-print" className="mt-4 text-black">
            <div className="flex items-start justify-between pb-4 border-b-2 border-green-600">
              <div>
                <h1 className="text-2xl font-bold text-green-600">DRAG N' DROP</h1>
                <p className="text-sm text-gray-600">Fleet Maintenance</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold">WORK ORDER</h2>
                <p className="text-sm font-mono">{woNumber}</p>
                <p className="text-xs text-gray-600">
                  Generated: {format(new Date(), 'MM/dd/yyyy')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="border border-gray-300 rounded p-3">
                <h3 className="text-xs font-bold text-gray-500 mb-2">VEHICLE</h3>
                <p className="font-semibold">
                  {truck
                    ? (truck.fleetId || truck.id) + ' - ' + (truck.brand || '') + ' ' + (truck.model || '')
                    : record.truckName}
                </p>
                <div className="text-sm mt-1 space-y-0.5">
                  <p><span className="text-gray-500">Plate:</span> {truck?.plate || '-'}</p>
                  <p><span className="text-gray-500">VIN:</span> {truck?.vin || '-'}</p>
                  <p>
                    <span className="text-gray-500">Odometer:</span>{' '}
                    {Number(record.mileage || truck?.currentKm || truck?.mileage || 0).toLocaleString()} mi
                  </p>
                </div>
              </div>
              <div className="border border-gray-300 rounded p-3">
                <h3 className="text-xs font-bold text-gray-500 mb-2">SERVICE</h3>
                <div className="text-sm space-y-0.5">
                  <p><span className="text-gray-500">Date:</span> {safeFormatDate(record.date, 'MM/dd/yyyy')}</p>
                  <p><span className="text-gray-500">Type:</span> {record.type || '-'}</p>
                  <p><span className="text-gray-500">Priority:</span> {record.priority || 'Medium'}</p>
                  <p><span className="text-gray-500">Status:</span> {statusLabel}</p>
                  <p><span className="text-gray-500">Provider:</span> {record.provider || record.mechanic || '-'}</p>
                </div>
              </div>
            </div>

            <div className="border border-gray-300 rounded p-3 mt-4">
              <h3 className="text-xs font-bold text-gray-500 mb-1">SERVICE DESCRIPTION</h3>
              <p className="font-semibold">{record.title || record.description || '-'}</p>
              {record.description && record.title && (
                <p className="whitespace-pre-wrap text-sm text-gray-700 mt-1">{record.description}</p>
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
                    {woParts.map((wp) => (
                      <tr key={wp.id}>
                        <td className="p-2 border-b border-gray-200">{wp.name}</td>
                        <td className="p-2 border-b border-gray-200 text-center">{wp.qty}</td>
                        <td className="p-2 border-b border-gray-200 text-right">{'$' + wp.cost.toFixed(2)}</td>
                        <td className="p-2 border-b border-gray-200 text-right">
                          {'$' + (wp.cost * wp.qty).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <div className="w-64 border border-gray-300 rounded p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Labor:</span>
                  <span>{'$' + laborTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Parts:</span>
                  <span>{'$' + partsTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-gray-300 mt-2 pt-2">
                  <span>TOTAL:</span>
                  <span className="text-green-700">{'$' + (laborTotal + partsTotal).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {record.notes && (
              <div className="border border-gray-300 rounded p-3 mt-4">
                <h3 className="text-xs font-bold text-gray-500 mb-1">NOTES</h3>
                <p className="text-sm">{record.notes}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-6 mt-10">
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">Authorized by</div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">Mechanic</div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-600">Date</div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
