import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';


import { AdminInicioComponent } from './admin-inicio';

describe('AdminInicioComponent', () => {
  let component: AdminInicioComponent;
  let fixture: ComponentFixture<AdminInicioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminInicioComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminInicioComponent);
    component = fixture.componentInstance;
    vi.spyOn(component as any, 'crearGraficos').mockImplementation(() => {});
  });

  it('debe crearse', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('debe mostrar las estadísticas recibidas', () => {
    fixture.componentRef.setInput('estadisticas', {
      reservas_hoy: 5,
      profesionales_activos: 7,
      horas_disponibles: 12,
      urgentes: 2
    });

    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('5');
    expect(texto).toContain('7');
    expect(texto).toContain('12');
    expect(texto).toContain('2');
  });

  it('debe mostrar la disponibilidad recibida', () => {
    fixture.componentRef.setInput('resumenDia', [
      {
        nombre: 'Profesional SESAES',
        estado: 'activo',
        citas_hoy: 3
      }
    ]);

    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Profesional SESAES');
    expect(texto).toContain('Activo');
  });

  it('debe emitir recarga al cambiar filtros del gráfico', () => {
    const anioSpy = vi.spyOn(component.filtroGraficoAnioChange, 'emit');
    const carreraSpy = vi.spyOn(component.filtroGraficoCarreraChange, 'emit');
    const recargaSpy = vi.spyOn(component.recargarGraficoEspecialidad, 'emit');

    component.filtroGraficoAnio = 2026;
    component.filtroGraficoCarrera = 'Ingeniería';
    component.cargarGraficoEspecialidad();

    expect(anioSpy).toHaveBeenCalledWith(2026);
    expect(carreraSpy).toHaveBeenCalledWith('Ingeniería');
    expect(recargaSpy).toHaveBeenCalledTimes(1);
  });

  it('debe emitir las exportaciones', () => {
    const especialidadSpy = vi.spyOn(component.exportarEspecialidad, 'emit');
    const semanaSpy = vi.spyOn(component.exportarSemana, 'emit');

    component.exportarEspecialidadExcel();
    component.exportarSemanaExcel();

    expect(especialidadSpy).toHaveBeenCalledTimes(1);
    expect(semanaSpy).toHaveBeenCalledTimes(1);
  });

  it('debe emitir navegación a Agenda', () => {
    const agendaSpy = vi.spyOn(component.verAgenda, 'emit');

    component.navegarA('horario');

    expect(agendaSpy).toHaveBeenCalledTimes(1);
  });

  it('debe emitir las acciones de una próxima cita', () => {
    const inasistenciaSpy = vi.spyOn(
      component.marcarInasistenciaCita,
      'emit'
    );
    const cancelarSpy = vi.spyOn(component.cancelarCita, 'emit');

    const cita = {
      id: 10,
      estudiante: 'Ana Pérez'
    };

    component.marcarInasistencia(cita);
    component.cancelarCitaAdmin(cita);

    expect(inasistenciaSpy).toHaveBeenCalledWith(cita);
    expect(cancelarSpy).toHaveBeenCalledWith(cita);
  });

  it('debe generar el calendario visual del mes', () => {
    fixture.detectChanges();

    expect(component.calDiasMes.length).toBeGreaterThan(27);
    expect(component.calNombreMesVisible.length).toBeGreaterThan(0);
  });

  it('debe mostrar actividad reciente', () => {
    fixture.componentRef.setInput('actividadReciente', [
      {
        mensaje: 'Cita actualizada',
        tiempo: 'Hace 5 min',
        tipo: 'info'
      }
    ]);

    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Cita actualizada');
    expect(texto).toContain('Hace 5 min');
  });
});