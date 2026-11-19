/** Instantes y hora civil se mantienen separados. Zona operativa de SESAES. */
export const ZONA_CENTRO = 'America/Santiago';

function partesCentro(instante: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_CENTRO, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(instante);
  const numero = (tipo: string) => Number(partes.find(p => p.type === tipo)?.value);
  return { anio: numero('year'), mes: numero('month'), dia: numero('day'),
    hora: numero('hour'), minuto: numero('minute'), segundo: numero('second') };
}

/** Portador de componentes civiles para aritmética de calendario; NO es un instante. */
export function calendarioCentro(instante: Date = new Date()): Date {
  const p = partesCentro(instante);
  return new Date(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
}

export function fechaCentro(instante: Date = new Date()): string {
  const p = partesCentro(instante);
  return `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;
}

/** Backend legacy sin offset = hora de Santiago; con offset/Z = instante explícito. */
export function instanteCentro(valor: string | Date | number): Date {
  if (valor instanceof Date) return new Date(valor.getTime());
  if (typeof valor === 'number') return new Date(valor);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/.exec(valor);
  if (!m) return new Date(valor);
  const [anio, mes, dia, hora, minuto, segundo] = m.slice(1, 7).map(v => Number(v ?? 0));
  // Fecha sin hora: mediodía evita la medianoche inexistente en cambios de verano.
  const h = m[4] === undefined ? 12 : hora;
  const objetivo = Date.UTC(anio, mes - 1, dia, h, minuto, segundo);
  let candidato = objetivo;
  for (let i = 0; i < 4; i++) {
    const p = partesCentro(new Date(candidato));
    const civil = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
    const ajuste = objetivo - civil;
    if (!ajuste) return new Date(candidato + Number(`0.${m[7] ?? '0'}`) * 1000);
    candidato += ajuste;
  }
  return new Date(NaN); // hora civil inexistente: no inventar otra hora
}

export function formatoCentro(valor: string | Date | number, formato = 'dd/MM/yyyy HH:mm'): string {
  if (!valor) return '';
  const d = instanteCentro(valor);
  if (Number.isNaN(d.getTime())) return '—';
  const p = partesCentro(d);
  const dos = (n: number) => String(n).padStart(2, '0');
  return formato.replace(/yyyy|MM|dd|HH|mm/g, token => ({
    yyyy: String(p.anio), MM: dos(p.mes), dd: dos(p.dia), HH: dos(p.hora), mm: dos(p.minuto)
  })[token]!);
}
