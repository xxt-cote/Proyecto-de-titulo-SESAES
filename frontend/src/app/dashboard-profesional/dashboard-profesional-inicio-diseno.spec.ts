import { By } from '@angular/platform-browser';
import { CalendarioInstitucionalComponent } from '../shared/calendario-institucional/calendario-institucional';
import { fechaISOLocal } from '../dashboard-admin/citas/admin-citas.utils';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DashboardProfesionalComponent } from './dashboard-profesional';
import { AuthService } from '../auth.service';

/** Inicio del profesional: igualado al diseño de referencia (agenda, calendario, tabla y barra inferior). */
describe('DashboardProfesionalComponent — Inicio según el diseño', () => {
  let fixture: ComponentFixture<DashboardProfesionalComponent>;
  let c: DashboardProfesionalComponent;
  let el: HTMLElement;
  const hoy = fechaISOLocal(new Date());
  const cita = (id: number, hora: string, estado: string) =>
    ({ id, hora, estado, fecha: hoy, estudiante: `Estudiante ${id}`, estudiante_id: 100 + id, carrera: 'Kinesiología', observaciones: 'Control', urgente: false });

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
    (c as any).profesionalId = 5;
    c.seccionActiva = 'inicio';
    c.perfil = { ...c.perfil, nombre: 'Carlos Muñoz', estado: 'activo' };
    c.documentosHoy = { total: 0, recetas: 0, justificativos: 0 };
    c.citasSinCerrar = [];
    c.citasHoy = [cita(1, '08:30', 'completada'), cita(2, '10:00', 'pendiente'), cita(3, '11:30', 'pendiente')];
    c.pacientesHistorial = [{ estudiante_id: 1, nombre: 'Valentina Rojas', rut: '11.222.333-9', carrera: 'Contador Auditor', tiene_ficha: true, total_atenciones: 2, dias_desde_ultima_visita: 2 }];
  });

  describe('calendario', () => {
    const calendario = () => {
      fixture.detectChanges();
      return fixture.debugElement.query(By.directive(CalendarioInstitucionalComponent)).componentInstance as CalendarioInstitucionalComponent;
    };
    it('octubre de 2026 empieza en jueves: tres días de septiembre en gris y semanas completas', () => {
      const cal = calendario();
      cal.anioVisible = 2026; cal.mesVisible = 9;
      cal.generar();
      const celdas = cal.celdas.filter(d => d !== null);
      expect(celdas.length % 7).toBe(0);
      expect(celdas.slice(0, 3).map(d => [d.num, d.otroMes])).toEqual([[28, true], [29, true], [30, true]]);
      expect(celdas[3]).toMatchObject({ num: 1, fecha: '2026-10-01', otroMes: false });
      expect(celdas.at(-1)).toMatchObject({ otroMes: true });
      expect(celdas.filter(d => !d.otroMes)).toHaveLength(31);
    });

    it('enero y diciembre usan el año vecino correcto en las fechas de relleno', () => {
      const cal = calendario();
      cal.anioVisible = 2026; cal.mesVisible = 0;           // enero 2026 empieza en jueves
      cal.generar();
      expect(cal.celdas[0]?.fecha).toBe('2025-12-29');
      cal.anioVisible = 2026; cal.mesVisible = 11;          // diciembre 2026 termina en jueves
      cal.generar();
      expect(cal.celdas.at(-1)?.fecha).toBe('2027-01-03');
    });

    it('muestra los días de semana compartidos, el mes junto a las flechas y sin enlace extra', () => {
      fixture.detectChanges();
      const cal = el.querySelector('.inicio-calendario-prof') as HTMLElement;
      expect(Array.from(cal.querySelectorAll('.cal-semana span')).map(s => s.textContent)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
      expect(cal.querySelector('.cal-mes')?.textContent?.trim()).toBe(calendario().tituloMes);
      expect(cal.querySelectorAll('.cal-nav-btn')).toHaveLength(2);
      expect(cal.textContent).not.toContain('Ver calendario');
    });
  });

  describe('agenda de hoy', () => {
    it('usa avatares suaves y un menú de tres puntos por cita', () => {
      fixture.detectChanges();
      expect(el.querySelectorAll('.inicio-agenda-fila-prof .inicio-avatar-prof.suave')).toHaveLength(3);
      expect(el.querySelectorAll('.inicio-agenda-fila-prof .inicio-menu-prof')).toHaveLength(3);
    });

    it('"Marcar inasistencia" solo se ofrece en lo pendiente', () => {
      fixture.detectChanges();
      const filas = Array.from(el.querySelectorAll('.inicio-agenda-fila-prof'));
      const opciones = (f: Element) => Array.from(f.querySelectorAll('.inicio-menu-lista-prof button')).map(b => b.textContent?.trim());
      expect(opciones(filas[0])).toEqual(['Ver detalle']);                                  // completada
      expect(opciones(filas[1])).toEqual(['Ver detalle', 'Marcar inasistencia']);           // pendiente
    });

    it('marcar inasistencia desde el menú llama a la acción y cierra el menú', () => {
      const marcar = vi.spyOn(c, 'marcarInasistencia').mockImplementation(() => {});
      fixture.detectChanges();
      const fila = el.querySelectorAll('.inicio-agenda-fila-prof')[1];
      const menu = fila.querySelector('details') as HTMLDetailsElement;
      menu.open = true;
      (fila.querySelectorAll('.inicio-menu-lista-prof button')[1] as HTMLButtonElement).click();
      expect(marcar).toHaveBeenCalledWith(c.agendaHoyCitas[1]);
      expect(menu.open).toBe(false);
    });
  });

  describe('indicadores, pacientes y barra inferior', () => {
    it('la próxima cita lleva el icono en tono azul, como en el diseño', () => {
      fixture.detectChanges();
      expect(el.querySelectorAll('.inicio-kpi-icono-prof.azul')).toHaveLength(1);
    });

    it('pacientes recientes: avatar verde, botón "Ver ficha" y flecha al final de la fila', () => {
      fixture.detectChanges();
      const fila = el.querySelector('.inicio-tabla-prof tbody tr') as HTMLElement;
      expect(fila.querySelector('.inicio-avatar-prof.fuerte')?.textContent?.trim()).toBe(c.iniciales('Valentina Rojas'));
      expect(fila.querySelector('.inicio-btn-detalle-prof')?.textContent).toContain('Ver ficha');
      expect(fila.querySelector('.inicio-tabla-flecha-prof')).not.toBeNull();
    });

    it('la barra "Requiere tu atención" tiñe cada ítem como en el diseño', () => {
      fixture.detectChanges();
      const items = Array.from(el.querySelectorAll('.inicio-requiere-item-prof'));
      expect(items.map(i => i.classList.contains('verde') ? 'verde' : i.classList.contains('rojo') ? 'rojo' : 'neutro')).toEqual(['verde', 'rojo', 'verde']);
    });
  });
});
