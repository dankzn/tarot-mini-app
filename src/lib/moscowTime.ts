import { addDays, format } from 'date-fns';

export const MOSCOW_TIME_ZONE = 'Europe/Moscow';

export const toMoscowDateTimeString = (date: Date, time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const value = new Date(date);
  value.setHours(hours, minutes, 0, 0);
  return format(value, "yyyy-MM-dd'T'HH:mm:ss");
};

export const dateToMoscowDateString = (date: Date) => format(date, 'yyyy-MM-dd');

export const getMoscowDayRange = (date: Date) => {
  const day = dateToMoscowDateString(date);
  const nextDay = dateToMoscowDateString(addDays(date, 1));
  return {
    start: `${day}T00:00:00`,
    end: `${nextDay}T00:00:00`,
  };
};

export const formatMoscowTime = (value: string | Date | null | undefined) => {
  if (!value) return '';
  return format(new Date(value), 'HH:mm');
};

export const formatMoscowDateKey = (value: string | Date | null | undefined) => {
  if (!value) return '';
  return format(new Date(value), 'yyyy-MM-dd');
};
