import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { AdminCitasComponent } from './admin-citas';

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
    // ngOnInit dispara cargarCitas(); se responde la petición pendiente.
    const req = httpMock.expectOne(req => req.url.includes('/admin/historial'));
    req.flush([]);
    expect(component).toBeTruthy();
  });

  it('debe cargar y renderizar el listado de citas', () => {
    const req = httpMock.expectOne(req => req.url.includes('/admin/historial'));
    req.flush([
      { id: 1, estudiante: 'Ana Soto', rut: '11.111.111-1', especialidad: 'Psicología', profesional: 'Dr. Pérez', fecha: '2026-09-01', hora: '10:00', estado: 'pendiente', urgente: false, iniciales: 'AS' }
    ]);
    fixture.detectChanges();

    expect(component.citasAdmin.length).toBe(1);
    const filas = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(filas.length).toBe(1);
  });

  it('debe emitir cancelarCita con la cita correcta al pulsar cancelar', () => {
    const req = httpMock.expectOne(req => req.url.includes('/admin/historial'));
    const cita = { id: 5, estudiante: 'Bruno Ríos', estado: 'pendiente', urgente: false };
    req.flush([cita]);
    fixture.detectChanges();

    let citaEmitida: any = null;
    component.cancelarCita.subscribe((c: any) => citaEmitida = c);

    const btnCancelar: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-tabla.cancelar');
    btnCancelar.click();

    expect(citaEmitida).toEqual(cita);
  });

  it('debe emitir marcarPrioridad con la cita y el flag urgente correctos', () => {
    const req = httpMock.expectOne(req => req.url.includes('/admin/historial'));
    const cita = { id: 7, estudiante: 'Carla Díaz', estado: 'pendiente', urgente: false };
    req.flush([cita]);
    fixture.detectChanges();

    let payload: any = null;
    component.marcarPrioridad.subscribe((p: any) => payload = p);

    const btnUrgente: HTMLButtonElement = fixture.nativeElement.querySelector('.tabla-acciones .btn-tabla:not(.ver):not(.cancelar)');
    btnUrgente.click();

    expect(payload).toEqual({ cita, urgente: true });
  });

  it('limpiarFiltrosCitas resetea los filtros y vuelve a cargar', () => {
    httpMock.expectOne(req => req.url.includes('/admin/historial')).flush([]);

    component.citasFiltroEstudiante = 'algo';
    component.citasFiltroEstado = 'pendiente';
    component.citasFiltroPrioridad = 'urgente';

    component.limpiarFiltrosCitas();

    expect(component.citasFiltroEstudiante).toBe('');
    expect(component.citasFiltroEstado).toBe('');
    expect(component.citasFiltroPrioridad).toBe('');

    httpMock.expectOne(req => req.url.includes('/admin/historial')).flush([]);
  });
});
