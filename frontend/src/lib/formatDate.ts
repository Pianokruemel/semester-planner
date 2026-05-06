export const DAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const MONTHS_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function fmtDate(d: string | Date): string {
  const dt = new Date(d);
  return `${dt.getDate()}. ${MONTHS_DE[dt.getMonth()]}`;
}

export function fmtTime(d: string | Date): string {
  const dt = new Date(d);
  return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

export function fmtDay(d: string | Date): string {
  return DAYS_DE[new Date(d).getDay()];
}
