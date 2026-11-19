import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardEstudianteComponent } from './dashboard-estudiante';

describe('Calendario estudiantil según agenda aprobada', () => {
  let c: DashboardEstudianteComponent;
  let http: HttpTestingController;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const futuro = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
  };
  const calendario = (id: number) => http.expectOne(r => r.url.endsWith(`/disponibilidad/${id}/calendario`));
  const mostrarMes = (d: Date) => {
    c.mesVisible = d.getMonth();
    c.anioVisible = d.getFullYear();
    c.generarCalendario();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DashboardEstudianteComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    c = TestBed.createComponent(DashboardEstudianteComponent).componentInstance;
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('bloquea todos los días hasta recibir disponibilidad y habilita solo las fechas publicadas', () => {
    c.seleccionarProfesional({ id: 1 });
    expect(c.diasMes.filter(Boolean).every(d => d.deshabilitado)).toBe(true);
    const fecha = futuro();
    calendario(1).flush({ fechas: [iso(fecha)] });
    mostrarMes(fecha);
    expect(c.diasMes.filter(d => d && !d.deshabilitado).map(d => d.fecha)).toEqual([iso(fecha)]);
  });

  it('descarta la respuesta del profesional anterior', () => {
    c.seleccionarProfesional({ id: 1 });
    const anterior = calendario(1);
    c.seleccionarProfesional({ id: 2 });
    calendario(2).flush({ fechas: [] });
    anterior.flush({ fechas: [iso(futuro())] });
    expect(c.fechasHabilitadas.size).toBe(0);
    expect(c.diasMes.filter(Boolean).every(d => d.deshabilitado)).toBe(true);
  });

  it('mantiene el calendario bloqueado ante un fallo de red', () => {
    c.seleccionarProfesional({ id: 1 });
    calendario(1).flush({}, { status: 500, statusText: 'Error' });
    expect(c.diasMes.filter(Boolean).every(d => d.deshabilitado)).toBe(true);
    c.seleccionarDia({ fecha: iso(futuro()), deshabilitado: false });
    expect(c.fechaSeleccionada).toBeNull();
  });

  it('respeta cierres y fines de semana incluso si llegan como habilitados', () => {
    const fecha = futuro();
    const sabado = new Date(fecha);
    while (sabado.getDay() !== 6) sabado.setDate(sabado.getDate() + 1);
    c.diasCerrados = [{ fecha: iso(fecha), motivo: 'Cierre' }];
    c.seleccionarProfesional({ id: 1 });
    calendario(1).flush({ fechas: [iso(fecha), iso(sabado)] });
    mostrarMes(fecha);
    expect(c.diasMes.find(d => d?.fecha === iso(fecha)).deshabilitado).toBe(true);
    mostrarMes(sabado);
    expect(c.diasMes.find(d => d?.fecha === iso(sabado)).deshabilitado).toBe(true);
  });
});
