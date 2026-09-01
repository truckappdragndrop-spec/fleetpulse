import { format, isValid } from 'date-fns';

/** Opções do campo "tipo de manutenção". */
export const MAINTENANCE_TYPES = [
  'Oil Change',
  'Tire Inspection',
  'Brake Check',
  'Engine Tune-up',
  'Filter Replacement',
  'Electrical',
  'Suspension',
  'Transmission',
  'Cooling System',
  'Other',
];

export const PRIORITIES = ['Low', 'Medium', 'High'];

/**
 * Formata uma data que pode chegar em vários formatos: Date, Timestamp do
 * Firestore, `{ seconds }`, texto ou número. Registros antigos e novos foram
 * gravados de jeitos diferentes, então a função aceita todos e devolve "-"
 * quando não consegue entender, em vez de quebrar a tela.
 */
export const safeFormatDate = (dateValue: any, formatStr: string = 'yyyy-MM-dd'): string => {
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
  } catch {
    return '-';
  }
};

/** Mesma ideia, mas para preencher um `<input type="date">`: sempre devolve
 *  uma data válida (hoje, se não der para interpretar). */
export const safeToDateInput = (dateValue: any): string => {
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
  } catch {
    return format(new Date(), 'yyyy-MM-dd');
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'High': return 'text-red-400';
    case 'Medium': return 'text-primary';
    case 'Low': return 'text-green-400';
    default: return 'text-muted-foreground';
  }
};
