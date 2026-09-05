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

describe('AdminProfesionalesComponent.colorDeProfesional', () => {
  const componente = new AdminProfesionalesComponent();

  it('usa el color propio del profesional si existe', () => {
    expect(componente.colorDeProfesional({ especialidad: 'Nutrición', color_identificador: '#4F8EF7' }))
      .toBe('#4F8EF7');
  });

  it('usa el fallback por especialidad si no tiene color propio', () => {
    expect(componente.colorDeProfesional({ especialidad: 'Odontología', color_identificador: null }))
      .toBe('#7FB8A6');
  });

  it('dos profesionales con la misma especialidad pueden tener colores distintos', () => {
    const a = componente.colorDeProfesional({ especialidad: 'Nutrición', color_identificador: '#C75B5B' });
    const b = componente.colorDeProfesional({ especialidad: 'Nutrición', color_identificador: '#8B5CF6' });
    expect(a).not.toBe(b);
  });

  it('usa un neutro si no hay color propio ni fallback conocido para la especialidad', () => {
    expect(componente.colorDeProfesional({ especialidad: 'Especialidad Nueva Sin Mapeo', color_identificador: null }))
      .toBe('#5C706D');
  });
});

describe('AdminProfesionalesComponent — chips de las cards (datos reales, sin inventar significado)', () => {
  it('textoPorcentajeActivos refleja activos/total, no "capacidad"', () => {
    const componente = new AdminProfesionalesComponent();
    componente.profesionales = [{}, {}, {}, {}, {}, {}, {}]; // 7 total
    componente.profesionalesActivos = 5;
    expect(componente.textoPorcentajeActivos).toBe('71% activos');
  });

  it('textoActivosChip usa "activos", nunca "en turno"', () => {
    const componente = new AdminProfesionalesComponent();
    componente.profesionalesActivos = 7;
    expect(componente.textoActivosChip).toBe('7 activos');
    componente.profesionalesActivos = 1;
    expect(componente.textoActivosChip).toBe('1 activo');
    componente.profesionalesActivos = 0;
    expect(componente.textoActivosChip).toBe('Sin profesionales activos');
  });

  it('textoIncidenciasChip usa "incidencias", nunca "reportes"', () => {
    const componente = new AdminProfesionalesComponent();
    componente.profesionalesConIncidencia = 0;
    expect(componente.textoIncidenciasChip).toBe('Sin incidencias');
    componente.profesionalesConIncidencia = 1;
    expect(componente.textoIncidenciasChip).toBe('1 incidencia');
    componente.profesionalesConIncidencia = 3;
    expect(componente.textoIncidenciasChip).toBe('3 incidencias');
  });

  it('especialidadesReales cuenta solo especialidades presentes en profesionales[], no la lista base', () => {
    const componente = new AdminProfesionalesComponent();
    componente.profesionales = [
      { especialidad: 'Nutrición' },
      { especialidad: 'Nutrición' },
      { especialidad: 'Kinesiología' }
    ];
    expect(componente.especialidadesReales.length).toBe(2);
  });
});
