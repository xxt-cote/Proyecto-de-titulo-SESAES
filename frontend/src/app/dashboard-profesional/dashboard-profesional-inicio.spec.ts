import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DashboardProfesionalComponent } from './dashboard-profesional';
import { AuthService } from '../auth.service';
import { environment } from '../config';

/** Inicio del profesional: saludo, 4 indicadores, agenda de hoy, acciones rápidas y recordatorio. */
describe('DashboardProfesionalComponent — Inicio', () => {
  let fixture: ComponentFixture<DashboardProfesionalComponent>;
  let c: DashboardProfesionalComponent;
  let el: HTMLElement;

  const hoy = new Date().toISOString().slice(0, 10);

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DashboardProfesionalComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: AuthService, useValue: { getRol: () => 'profesional', getUsuarioId: () => 7, logout: vi.fn() } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardProfesionalComponent);
    c = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    c.seccionActiva = 'inicio';
    c.perfil = { ...c.perfil, nombre: 'Dra. María Pérez', estado: 'activo' };
    c.estadisticasDia = { total_hoy: 5, completadas: 2, pendientes: 3, inasistencias: 0 };
    c.documentosHoy = { total: 3, recetas: 2, justificativos: 1 };
    c.citasHoy = [
      { id: 2, hora: '11:30', estudiante: 'Valentina Torres', estado: 'pendiente', fecha: hoy, urgente: false },
      { id: 1, hora: '08:30', estudiante: 'Camila Rojas', estado: 'completada', fecha: hoy, urgente: false },
      { id: 3, hora: '10:00', estudiante: 'Matías López', estado: 'pendiente', fecha: hoy, urgente: true },
    ];
    c.citasSinCerrar = [];
  });

  it('muestra el saludo y los 4 indicadores con datos reales', () => {
    fixture.detectChanges();
    const texto = el.textContent ?? '';
    expect(texto).toContain('Dra. María Pérez');
    const nums = Array.from(el.querySelectorAll('.inicio-kpi-num-prof')).map(n => n.textContent?.trim());
    expect(nums).toEqual(['2', '3', '3', '0']);      // atendidos · pendientes · documentos · sin cerrar
    expect(texto).toContain('de 5 programados');
    expect(texto).toContain('2 recetas · 1 justificativo');
  });

  it('la agenda de hoy va ordenada por hora y solo ofrece completar lo pendiente', () => {
    fixture.detectChanges();
    expect(c.agendaHoyCitas.map(x => x.hora)).toEqual(['08:30', '10:00', '11:30']);
    const filas = el.querySelectorAll('.inicio-agenda-fila-prof');
    expect(filas).toHaveLength(3);
    expect(filas[0].querySelector('.btn-completar')).toBeNull();          // ya completada
    expect(filas[1].querySelector('.btn-completar')).not.toBeNull();      // pendiente
    expect(filas[1].textContent).toContain('URGENTE');
  });

  it('"Completar atención" apunta a la próxima cita pendiente de hoy', () => {
    fixture.detectChanges();
    expect(c.proximaAtencionPendiente?.id).toBe(3);                       // 10:00 es la primera pendiente
    const boton = el.querySelector('.inicio-acciones-prof button') as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
  });

  it('"Completar atención" se desactiva si no queda nada pendiente hoy', () => {
    c.citasHoy = c.citasHoy.map(x => ({ ...x, estado: 'completada' }));
    fixture.detectChanges();
    expect(c.proximaAtencionPendiente).toBeNull();
    const boton = el.querySelector('.inicio-acciones-prof button') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });

  it('el indicador de citas sin cerrar alerta y abre la más antigua', () => {
    c.citasSinCerrar = [{ id: 9, hora: '09:00', estudiante: 'Fernanda Castillo', estado: 'pendiente', fecha: '2020-01-01' }];
    const abrir = vi.spyOn(c, 'abrirModalCompletar').mockImplementation(() => {});
    fixture.detectChanges();
    const kpi = el.querySelector('.inicio-kpi-alerta-prof') as HTMLButtonElement;
    expect(kpi.classList).toContain('con-alerta');
    kpi.click();
    expect(abrir).toHaveBeenCalledWith(c.citasSinCerrar[0]);
  });

  it('sin citas sin cerrar el indicador queda en calma y desactivado', () => {
    fixture.detectChanges();
    const kpi = el.querySelector('.inicio-kpi-alerta-prof') as HTMLButtonElement;
    expect(kpi.classList).not.toContain('con-alerta');
    expect(kpi.disabled).toBe(true);
    expect(kpi.textContent).toContain('Todo al día');
  });

  it('incluye el recordatorio y NO duplica el bloque de notificaciones', () => {
    fixture.detectChanges();
    expect(el.querySelector('.inicio-recuerda-prof')?.textContent).toContain('se envía automáticamente al dashboard del estudiante');
    expect(el.querySelector('.inicio-grid-prof')?.textContent).not.toContain('Notificaciones');
  });

  it('carga los documentos de hoy desde el backend', () => {
    const http = TestBed.inject(HttpTestingController);
    (c as any).profesionalId = 5;   // es privado: se fija directamente para esta prueba
    c.cargarDocumentosHoy();
    const req = http.expectOne(`${environment.apiUrl}/documentos/profesional/5/hoy`);
    req.flush({ fecha: hoy, total: 4, recetas: 3, justificativos: 1 });
    expect(c.documentosHoy.total).toBe(4);
  });

  it('la fecha larga empieza con mayúscula', () => {
    expect(c.fechaHoyLarga.charAt(0)).toBe(c.fechaHoyLarga.charAt(0).toUpperCase());
    expect(c.fechaHoyLarga).toContain(String(new Date().getFullYear()));
  });
});
