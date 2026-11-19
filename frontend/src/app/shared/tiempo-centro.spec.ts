import { calendarioCentro, fechaCentro, formatoCentro, instanteCentro } from './tiempo-centro';
import { FechaCentroPipe } from './fecha-centro.pipe';

describe('Hora del centro America/Santiago', () => {
  it('hoy sigue siendo el día chileno aunque UTC ya sea el día siguiente', () => {
    const instante = new Date('2025-07-16T01:30:00Z');
    expect(fechaCentro(instante)).toBe('2025-07-15');
    const civil = calendarioCentro(instante);
    expect([civil.getFullYear(), civil.getMonth() + 1, civil.getDate(), civil.getHours()])
      .toEqual([2025, 7, 15, 21]);
  });

  it('convierte una cita civil según verano o invierno, sin offset fijo', () => {
    expect(instanteCentro('2025-01-15T09:00:00').toISOString()).toBe('2025-01-15T12:00:00.000Z');
    expect(instanteCentro('2025-07-15T09:00:00').toISOString()).toBe('2025-07-15T13:00:00.000Z');
  });

  it('respeta offsets explícitos y conserva fechas sin hora', () => {
    expect(formatoCentro('2025-07-16T01:30:00Z')).toBe('15/07/2025 21:30');
    expect(formatoCentro('2025-07-15T09:00:00-04:00')).toBe('15/07/2025 09:00');
    expect(formatoCentro('2025-07-15', 'dd/MM/yyyy')).toBe('15/07/2025');
  });

  it('no desplaza registros legacy sin offset y no inventa una hora civil inexistente', () => {
    expect(formatoCentro('2025-07-15T09:00:00')).toBe('15/07/2025 09:00');
    expect(Number.isNaN(instanteCentro('2025-09-07T00:30:00').getTime())).toBe(true);
    expect(formatoCentro('ilegible')).toBe('—');
  });

  it('el pipe utiliza Santiago y mantiene vacío un timestamp ausente', () => {
    const pipe = new FechaCentroPipe();
    expect(pipe.transform('2025-07-16T01:30:00Z', 'dd/MM HH:mm')).toBe('15/07 21:30');
    expect(pipe.transform(null)).toBe('');
  });
});
