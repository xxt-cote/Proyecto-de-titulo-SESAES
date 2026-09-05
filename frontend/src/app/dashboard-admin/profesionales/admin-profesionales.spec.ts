import { describe, it, expect } from 'vitest';
import { AdminProfesionalesComponent } from './admin-profesionales';

/**
 * AdminProfesionalesComponent no tiene dependencias inyectadas en su
 * constructor, así que se puede instanciar directamente para probar sus
 * métodos puros sin necesidad de TestBed.
 */
describe('AdminProfesionalesComponent.nombreConTratamiento', () => {
  const componente = new AdminProfesionalesComponent();

  it('antepone el tratamiento cuando el nombre no lo trae', () => {
    const resultado = componente.nombreConTratamiento({
      nombre: 'Eduardo Carvajal',
      tratamiento: 'Dr.'
    });
    expect(resultado).toBe('Dr. Eduardo Carvajal');
  });

  it('no duplica el tratamiento si el nombre ya lo trae (dato histórico)', () => {
    const resultado = componente.nombreConTratamiento({
      nombre: 'Dr. Eduardo Carvajal',
      tratamiento: 'Dr.'
    });
    expect(resultado).toBe('Dr. Eduardo Carvajal');
  });

  it('no antepone nada si no hay tratamiento', () => {
    const resultado = componente.nombreConTratamiento({
      nombre: 'Carlos Muñoz',
      tratamiento: null
    });
    expect(resultado).toBe('Carlos Muñoz');
  });
});
