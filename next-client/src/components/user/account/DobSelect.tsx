'use client';

import { useEffect, useState } from 'react';

// Date of birth as three selects in Vietnamese order (Ngày / Tháng / Năm). A native date input shows the browser's own
// order ("mm/dd/yyyy" on an English browser), which customers here read the wrong way round.
// value / onChange use "YYYY-MM-DD" ('' when not set), the same as the date input it replaces.

const SELECT_CLASS =
  'h-11 w-full rounded-md border border-white/[0.2] bg-[#0e1730] px-2 text-sm text-white focus:border-blue-500/50 focus:outline-none';

const pad = (value: number) => String(value).padStart(2, '0');
const daysIn = (year: number, month: number) => new Date(year || 2000, month || 1, 0).getDate();

export default function DobSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [initialYear = '', initialMonth = '', initialDay = ''] = (value || '').slice(0, 10).split('-');
  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);

  // The profile loads after the first render: take its date when it arrives
  useEffect(() => {
    const [nextYear = '', nextMonth = '', nextDay = ''] = (value || '').slice(0, 10).split('-');
    setYear(nextYear);
    setMonth(nextMonth);
    setDay(nextDay);
  }, [value]);

  const update = (nextDay: string, nextMonth: string, nextYear: string) => {
    // A day past the end of the chosen month (31 in a 30-day month) moves back to the last day
    let safeDay = nextDay;
    if (nextDay && nextMonth && nextYear && Number(nextDay) > daysIn(Number(nextYear), Number(nextMonth))) {
      safeDay = pad(daysIn(Number(nextYear), Number(nextMonth)));
    }
    setDay(safeDay);
    setMonth(nextMonth);
    setYear(nextYear);
    onChange(safeDay && nextMonth && nextYear ? `${nextYear}-${nextMonth}-${safeDay}` : '');
  };

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, index) => String(thisYear - index));
  const dayCount = daysIn(Number(year), Number(month)) || 31;

  return (
    <div className="grid grid-cols-3 gap-2">
      <select aria-label="Ngày sinh" className={SELECT_CLASS} value={day} onChange={(e) => update(e.target.value, month, year)}>
        <option value="">Ngày</option>
        {Array.from({ length: dayCount }, (_, index) => pad(index + 1)).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select aria-label="Tháng sinh" className={SELECT_CLASS} value={month} onChange={(e) => update(day, e.target.value, year)}>
        <option value="">Tháng</option>
        {Array.from({ length: 12 }, (_, index) => pad(index + 1)).map((option) => (
          <option key={option} value={option}>
            Tháng {Number(option)}
          </option>
        ))}
      </select>
      <select aria-label="Năm sinh" className={SELECT_CLASS} value={year} onChange={(e) => update(day, month, e.target.value)}>
        <option value="">Năm</option>
        {years.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
