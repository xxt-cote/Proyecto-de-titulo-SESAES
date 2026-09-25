import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { vi } from 'vitest';

import { AdminCitasComponent } from './admin-citas';

/**
 * Cada respuesta HTTP se refleja en la vista recién cuando Angular corre un
 * ciclo de detección de cambios (zone.js lo hace solo en la app real; en un
 * test síncrono como este hay que pedirlo explícitamente). Por eso se llama
 * fixture.detectChanges() después de CADA flush, no solo al final.
 */
function flushInit(
  fixture: ComponentFixture<AdminCitasComponent>,
  httpMock: HttpTestingController,
  citas: any[] = [],
  profesionales: any[] = [],
): void {
  httpMock.expectOne((req) => req.url.includes('/agenda/citas')).flush(citas);
  fixture.detectChanges();
  httpMock.expectOne((req) => req.url.includes('/agenda/profesionales')).flush(profesionales);
  fixture.detectChanges();
}

describe('AdminCitasComponent', () => {
  let component: AdminCitasComponent;
  let fixture: ComponentFixture<AdminCitasComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCitasComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCitasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    flushInit(fixture, httpMock);
    expect(component).toBeTruthy();
  });

  it('SA-10.2C usa lectura operacional /agenda/citas y no /admin/historial', () => {
    const req = httpMock.expectOne((r) => r.url.includes('/agenda/citas'));
    expect(req.request.url).not.toContain('/admin/historial');
    req.flush([]);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/agenda/profesionales')).flush([]);
  });

  it('debe cargar y renderizar el listado de citas', () => {
    flushInit(fixture, httpMock, [
      {
        id: 1,
        estudiante: 'Ana Soto',
        rut: '11.111.111-1',
        especialidad: 'Psicología',
        profesional: 'Dr. Pérez',
        fecha: new Date().toISOString().slice(0, 10),
        hora: '10:00',
        estado: 'pendiente',
        urgente: false,
        iniciales: 'AS',
      },
    ]);

    expect(component.citasAdmin.length).toBe(1);
    const filas = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(filas.length).toBe(1);
  });

  it('debe emitir cancelarCita con la cita correcta desde el menú de la fila', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const cita = {
      id: 5,
      estudiante: 'Bruno Ríos',
      estado: 'pendiente',
      urgente: false,
      fecha: hoy,
      hora: '09:00',
    };
    flushInit(fixture, httpMock, [cita]);
    fixture.componentRef.setInput('puedeGestionarAgenda', true);
    fixture.detectChanges();

    let citaEmitida: any = null;
    component.cancelarCita.subscribe((c: any) => (citaEmitida = c));

    const btnMenu: HTMLButtonElement = fixture.nativeElement.querySelector('.citas-btn-menu');
    btnMenu.click();
    fixture.detectChanges();

    const btnCancelar: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.citas-menu-item[data-accion="cancelar"]',
    );
    btnCancelar.click();

    expect(citaEmitida).toEqual(cita);
  });

  it('debe emitir marcarPrioridad con la cita y el flag urgente correctos desde el menú', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const cita = {
      id: 7,
      estudiante: 'Carla Díaz',
      estado: 'pendiente',
      urgente: false,
      fecha: hoy,
      hora: '09:00',
    };
    flushInit(fixture, httpMock, [cita]);
    fixture.componentRef.setInput('puedeGestionarAgenda', true);
    fixture.detectChanges();

    let payload: any = null;
    component.marcarPrioridad.subscribe((p: any) => (payload = p));

    fixture.nativeElement.querySelector('.citas-btn-menu').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.citas-menu-item[data-accion="urgente"]').click();

    expect(payload).toEqual({ cita, urgente: true });
  });

  it('limpiarFiltrosCitas resetea los filtros y vuelve a cargar', () => {
    flushInit(fixture, httpMock);

    component.citasFiltroEstudiante = 'algo';
    component.citasFiltroEstado = 'pendiente';
    component.citasFiltroPrioridad = 'urgente';

    component.limpiarFiltrosCitas();

    expect(component.citasFiltroEstudiante).toBe('');
    expect(component.citasFiltroEstado).toBe('');
    expect(component.citasFiltroPrioridad).toBe('');
    expect(component.citasFiltroRango).toBe('ultimos30');

    httpMock.expectOne((r) => r.url.includes('/agenda/citas')).flush([]);
  });

  it('read-only oculta las acciones de mutación', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    flushInit(fixture, httpMock, [
      {
        id: 9,
        estudiante: 'Diego Mora',
        estado: 'pendiente',
        urgente: false,
        fecha: hoy,
        hora: '09:00',
      },
    ]);
    fixture.componentRef.setInput('puedeGestionarAgenda', false);
    fixture.detectChanges();

    // "Agendar cita" (acceso rápido lateral) requiere agenda.gestionar.
    expect(fixture.nativeElement.querySelector('.citas-accion.tono-mint')).toBeNull();

    // El botón "Acciones" sigue visible: "Ver detalles" es de solo lectura y
    // no requiere agenda.gestionar. Lo que debe faltar son las opciones de
    // mutación dentro del menú.
    const btnAcciones: HTMLButtonElement = fixture.nativeElement.querySelector('.citas-btn-menu');
    expect(btnAcciones).not.toBeNull();

    btnAcciones.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.citas-menu-item[data-accion="detalle"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.citas-menu-item[data-accion="urgente"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.citas-menu-item[data-accion="cancelar"]')).toBeNull();
  });

  it('read-only bloquea handlers aunque se invoquen directamente', () => {
    flushInit(fixture, httpMock);
    const cita = { id: 10, estudiante: 'Elena Ruiz', estado: 'pendiente', urgente: false };
    const cancelarSpy = vi.spyOn(component.cancelarCita, 'emit');
    const prioridadSpy = vi.spyOn(component.marcarPrioridad, 'emit');
    const horarioSpy = vi.spyOn(component.irAHorario, 'emit');

    component.puedeGestionarAgenda = false;
    component.onCancelarCita(cita);
    component.onMarcarPrioridad(cita, true);
    component.onIrAHorario();

    expect(cancelarSpy).not.toHaveBeenCalled();
    expect(prioridadSpy).not.toHaveBeenCalled();
    expect(horarioSpy).not.toHaveBeenCalled();
  });

  it('las pestañas cuentan las citas del período por estado', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    flushInit(fixture, httpMock, [
      { id: 1, estudiante: 'A', estado: 'pendiente', urgente: false, fecha: hoy, hora: '09:00' },
      { id: 2, estudiante: 'B', estado: 'pendiente', urgente: false, fecha: hoy, hora: '10:00' },
      { id: 3, estudiante: 'C', estado: 'completada', urgente: false, fecha: hoy, hora: '11:00' },
    ]);

    expect(component.contar('')).toBe(3);
    expect(component.contar('pendiente')).toBe(2);
    expect(component.contar('completada')).toBe(1);
    expect(component.contar('cancelada')).toBe(0);
  });

  it('seleccionar una pestaña filtra el listado por ese estado', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    flushInit(fixture, httpMock, [
      { id: 1, estudiante: 'A', estado: 'pendiente', urgente: false, fecha: hoy, hora: '09:00' },
      { id: 2, estudiante: 'B', estado: 'completada', urgente: false, fecha: hoy, hora: '10:00' },
    ]);

    component.seleccionarEstado('completada');
    fixture.detectChanges();

    expect(component.citasFiltradas.length).toBe(1);
    expect(component.citasFiltradas[0].id).toBe(2);
  });

  it('el KPI de citas totales no muestra variación cuando no hay período previo (rango "todas")', () => {
    flushInit(fixture, httpMock, [
      {
        id: 1,
        estudiante: 'A',
        estado: 'pendiente',
        urgente: false,
        fecha: '2020-01-01',
        hora: '09:00',
      },
    ]);
    component.cambiarRango('todas');
    httpMock
      .expectOne((r) => r.url.includes('/agenda/citas'))
      .flush([
        {
          id: 1,
          estudiante: 'A',
          estado: 'pendiente',
          urgente: false,
          fecha: '2020-01-01',
          hora: '09:00',
        },
      ]);
    fixture.detectChanges();

    const kpiTotal = component.kpis.find((k) => k.clave === 'total');
    expect(kpiTotal?.delta).toBeNull();
  });

  it('no inventa un porcentaje cuando el período previo no tuvo citas', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    // 60 días atrás cae fuera de la ventana previa de "últimos 30 días" (que
    // cubre los 30 días anteriores al período actual): la previa queda vacía.
    const lejos = new Date();
    lejos.setDate(lejos.getDate() - 60);
    flushInit(fixture, httpMock, [
      { id: 1, estudiante: 'A', estado: 'pendiente', urgente: false, fecha: hoy, hora: '09:00' },
    ]);

    const kpiTotal = component.kpis.find((k) => k.clave === 'total');
    expect(kpiTotal?.delta).toBeNull();
    expect(kpiTotal?.nota).toBe('Sin citas en el período anterior');
  });

  it('alternarSoloUrgentes filtra solo las citas urgentes', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    flushInit(fixture, httpMock, [
      { id: 1, estudiante: 'A', estado: 'pendiente', urgente: true, fecha: hoy, hora: '09:00' },
      { id: 2, estudiante: 'B', estado: 'pendiente', urgente: false, fecha: hoy, hora: '10:00' },
    ]);

    component.alternarSoloUrgentes();
    fixture.detectChanges();

    expect(component.citasFiltradas.length).toBe(1);
    expect(component.citasFiltradas[0].urgente).toBe(true);
  });

  it('el checkbox de fila es solo selección visual (no dispara ninguna llamada HTTP)', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const cita = { id: 1, estudiante: 'A', estado: 'pendiente', urgente: false, fecha: hoy, hora: '09:00' };
    flushInit(fixture, httpMock, [cita]);

    expect(component.estaSeleccionada(cita)).toBe(false);
    const checkboxFila: HTMLInputElement = fixture.nativeElement.querySelector('tbody .citas-checkbox');
    checkboxFila.click();
    fixture.detectChanges();

    expect(component.estaSeleccionada(cita)).toBe(true);
    httpMock.expectNone((r) => !r.url.includes('/agenda/citas') && !r.url.includes('/agenda/profesionales'));
  });

  it('"Ver detalles" del menú "Acciones" emite verDetalle incluso en modo solo lectura', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const cita = { id: 1, estudiante: 'A', estado: 'pendiente', urgente: false, fecha: hoy, hora: '09:00' };
    flushInit(fixture, httpMock, [cita]);
    fixture.componentRef.setInput('puedeGestionarAgenda', false);
    fixture.detectChanges();

    let citaEmitida: any = null;
    component.verDetalle.subscribe((c: any) => (citaEmitida = c));

    fixture.nativeElement.querySelector('.citas-btn-menu').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.citas-menu-item[data-accion="detalle"]').click();

    expect(citaEmitida).toBe(cita);
  });

  it('el menú se cierra si la fila deja de estar en la página visible', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const cita = {
      id: 1,
      estudiante: 'A',
      estado: 'pendiente',
      urgente: false,
      fecha: hoy,
      hora: '09:00',
    };
    flushInit(fixture, httpMock, [cita]);
    fixture.componentRef.setInput('puedeGestionarAgenda', true);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.citas-btn-menu').click();
    fixture.detectChanges();
    expect(component.menuCita).toBe(cita);

    // Filtrar por un estado que excluye a la cita saca la fila de la página
    // visible: el menú, que apuntaba a esa fila, debe cerrarse.
    component.seleccionarEstado('completada');
    fixture.detectChanges();

    expect(component.menuCita).toBeNull();
  });
});
