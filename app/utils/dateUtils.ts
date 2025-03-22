// app/utils/dateUtils.ts

import { parse, isValid, differenceInDays, format } from 'date-fns';

// Define accepted date formats
export const DATE_FORMATS = [
  'dd/MM/yyyy',
  'dd-MM-yyyy',
  'yyyy/MM/dd',
  'yyyy-MM-dd',
  'MM/dd/yyyy',
  'MM-dd-yyyy'
];

export const parseDate = (dateStr: string): Date | null => {
  if (!dateStr || dateStr === '-' || dateStr.trim() === '') {
    return null;
  }

  // Try each format until one works
  for (const dateFormat of DATE_FORMATS) {
    try {
      const parsedDate = parse(dateStr, dateFormat, new Date());
      if (isValid(parsedDate)) {
        return parsedDate;
      }
    } catch (error) {
      continue; // Try next format
    }
  }

  // If no format worked, try native Date parsing as fallback
  const fallbackDate = new Date(dateStr);
  return isValid(fallbackDate) ? fallbackDate : null;
};

export const getDaysUntilExpiration = (expDate: string): number | null => {
  const parsedDate = parseDate(expDate);
  
  if (!parsedDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return differenceInDays(parsedDate, today);
};

// Helper to format dates consistently
export const formatDate = (date: Date): string => {
  return format(date, 'dd/MM/yyyy');
};
