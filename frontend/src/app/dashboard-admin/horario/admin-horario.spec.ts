import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdminHorarioComponent } from './admin-horario';

describe('AdminHorarioComponent', () => {
  let component: AdminHorarioComponent;
  let fixture: ComponentFixture<AdminHorarioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminHorarioComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminHorarioComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput(
      'formatearFechaFn',
      (fecha: string) => `FORMATO:${fecha}`
    );
    fixture.componentRef.setInput(
      'bloqueEstadoFn',
      () => 'disponible'
    );
    fixture.componentRef.setInput(
      'bloqueInfoFn',
      () => ''
    );
    fixture.componentRef.setInput(
      'esFeriadoFn',
      () => false
    );
    fixture.componentRef.setInput(
      'nombreFeriadoFn',
      () => ''
    );
  });

  it('debe crearse', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('debe mostrar y emitir acciones sobre solicitudes pendientes', () => {
    const aprobarSpy = vi.spyOn(component.aprobarSolicitud, 'emit');
    const rechazarSpy = vi.spyOn(component.rechazarSolicitud, 'emit');

    const solicitud = {
      id: 1,
      profesional_nombre: 'Profesional SESAES',
      especialidad: 'Medicina',
      tipo: 'jornada',
      hora_inicio: '08:00',
      hora_fin: '17:00',
      fecha_solicitud: '2026-08-31T09:00:00'
    };

    fixture.componentRef.setInput('solicitudesHorarioAdmin', [solicitud]);
    fixture.detectChanges();

    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    );

    botones.find(b => b.textContent?.includes('Aprobar'))!.click();
    botones.find(b => b.textContent?.includes('Rechazar'))!.click();

    expect(aprobarSpy).toHaveBeenCalledWith(solicitud);
    expect(rechazarSpy).toHaveBeenCalledWith(solicitud);
  });

  it('debe emitir los cambios de filtros', () => {
    const especialidadSpy = vi.spyOn(
      component.filtroEspecialidadChange,
      'emit'
    );
    const profesionalSpy = vi.spyOn(
      component.filtroProfesionalIdChange,
      'emit'
    );

    component.filtroEspecialidadChange.emit('Medicina');
    component.filtroProfesionalIdChange.emit('10');

    expect(especialidadSpy).toHaveBeenCalledWith('Medicina');
    expect(profesionalSpy).toHaveBeenCalledWith('10');
  });

  it('debe mostrar el aviso cuando el profesional está bloqueado', () => {
    fixture.componentRef.setInput('filtroProfesionalId', '10');
    fixture.componentRef.setInput('profesionalActualBloqueado', true);
    fixture.componentRef.setInput('profesionalActual', {
      nombre: 'Profesional Bloqueado',
      estado: 'licencia'
    });

    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Profesional Bloqueado');
    expect(texto).toContain('licencia');
  });

  it('debe renderizar la semana y emitir un clic de bloque', () => {
    const bloqueSpy = vi.spyOn(component.bloqueClick, 'emit');

    fixture.componentRef.setInput('filtroProfesionalId', '10');
    fixture.componentRef.setInput('semanaActual', [
      {
        nombre: 'Lun',
        num: 31,
        fecha: '2026-08-31',
        esHoy: true
      }
    ]);
    fixture.componentRef.setInput('semanaLabel', 'Agosto 2026');
    fixture.componentRef.setInput('horasGrilla', ['08:00']);

    fixture.detectChanges();

    const bloque = fixture.nativeElement.querySelector(
      '.bloque-celda'
    ) as HTMLDivElement;

    expect(bloque).toBeTruthy();
    bloque.click();

    expect(bloqueSpy).toHaveBeenCalledWith({
      fecha: '2026-08-31',
      hora: '08:00'
    });
  });

  it('debe emitir navegación semanal y Hoy', () => {
    const anteriorSpy = vi.spyOn(component.anterior, 'emit');
    const siguienteSpy = vi.spyOn(component.siguiente, 'emit');
    const hoySpy = vi.spyOn(component.hoy, 'emit');

    fixture.componentRef.setInput('filtroProfesionalId', '10');
    fixture.detectChanges();

    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    );

    botones.find(b => b.textContent?.trim() === '‹')!.click();
    botones.find(b => b.textContent?.trim() === '›')!.click();
    botones.find(b => b.textContent?.trim() === 'Hoy')!.click();

    expect(anteriorSpy).toHaveBeenCalledTimes(1);
    expect(siguienteSpy).toHaveBeenCalledTimes(1);
    expect(hoySpy).toHaveBeenCalledTimes(1);
  });

  it('debe emitir Nueva Cita e Imprimir Agenda', () => {
    const nuevaSpy = vi.spyOn(component.abrirNuevaCita, 'emit');
    const imprimirSpy = vi.spyOn(component.imprimir, 'emit');

    fixture.componentRef.setInput('filtroProfesionalId', '10');
    fixture.componentRef.setInput('profesionalActualBloqueado', false);
    fixture.detectChanges();

    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    );

    botones.find(b => b.textContent?.includes('Nueva Cita'))!.click();
    botones.find(b => b.textContent?.includes('Imprimir Agenda'))!.click();

    expect(nuevaSpy).toHaveBeenCalledTimes(1);
    expect(imprimirSpy).toHaveBeenCalledTimes(1);
  });

  it('debe mostrar las citas del día y emitir cancelación', () => {
    const cancelarSpy = vi.spyOn(component.cancelarCita, 'emit');

    const cita = {
      id: 20,
      estudiante: 'Ana Pérez',
      especialidad: 'Psicología',
      hora: '10:00',
      estado: 'pendiente',
      urgente: false
    };

    fixture.componentRef.setInput('filtroProfesionalId', '10');
    fixture.componentRef.setInput('diaSeleccionado', '2026-08-31');
    fixture.componentRef.setInput('citasDiaSeleccionado', [cita]);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ana Pérez');

    const cancelar = fixture.nativeElement.querySelector(
      '.detalle-acciones button'
    ) as HTMLButtonElement;

    cancelar.click();

    expect(cancelarSpy).toHaveBeenCalledWith(cita);
  });

  it('debe emitir cierre del detalle del día', () => {
    const diaSpy = vi.spyOn(component.diaSeleccionadoChange, 'emit');

    fixture.componentRef.setInput('filtroProfesionalId', '10');
    fixture.componentRef.setInput('diaSeleccionado', '2026-08-31');
    fixture.componentRef.setInput('citasDiaSeleccionado', []);

    fixture.detectChanges();

    const cerrar = fixture.nativeElement.querySelector(
      '.detalle-cerrar'
    ) as HTMLButtonElement;

    expect(cerrar).toBeTruthy();
    cerrar.click();

    expect(diaSpy).toHaveBeenCalledWith(null);
  });
});