import { addDays, format } from 'date-fns';

export const MOSCOW_TIME_ZONE = 'Europe/Moscow';
const MOSCOW_UTC_OFFSET_HOURS = 3;

const getMoscowDateParts = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: byType.year,
    month: byType.month,
    day: byType.day,
  };
};

export const toMoscowDateTimeStringFromParts = (date: string, time: string) => {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map(Number);

  return new Date(Date.UTC(
    year,
    month - 1,
    day,
    hours - MOSCOW_UTC_OFFSET_HOURS,
    minutes,
    seconds
  )).toISOString();
};

export const toMoscowDateTimeString = (date: Date, time: string) => {
  return toMoscowDateTimeStringFromParts(dateToMoscowDateString(date), time);
};

export const dateToMoscowDateString = (date: Date) => format(date, 'yyyy-MM-dd');

export const getMoscowDayRange = (date: Date) => {
  const day = dateToMoscowDateString(date);
  const nextDay = dateToMoscowDateString(addDays(date, 1));
  return {
    start: toMoscowDateTimeStringFromParts(day, '00:00'),
    end: toMoscowDateTimeStringFromParts(nextDay, '00:00'),
  };
};

export const formatMoscowTime = (value: string | Date | null | undefined) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: MOSCOW_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
};

export const formatMoscowDateKey = (value: string | Date | null | undefined) => {
  if (!value) return '';
  const { year, month, day } = getMoscowDateParts(value);
  return `${year}-${month}-${day}`;
};
