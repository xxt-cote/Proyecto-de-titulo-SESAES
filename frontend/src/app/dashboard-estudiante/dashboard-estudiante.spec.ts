import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DashboardEstudianteComponent } from './dashboard-estudiante';

/**
 * Inicio del estudiante: saludo, accesos, resumen (próxima cita y cuestionarios),
 * últimas atenciones y calendario. Sin tarjeta de notificaciones en el Inicio.
 */
describe('DashboardEstudianteComponent — Inicio', () => {
  let fixture: ComponentFixture<DashboardEstudianteComponent>;
  let c: DashboardEstudianteComponent;

  const render = () => {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    sessionStorage.clear();
    sessionStorage.setItem('usuario_id', '5');
    await TestBed.configureTestingModule({
      imports: [DashboardEstudianteComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardEstudianteComponent);
    c = fixture.componentInstance;
  });

  it('muestra el saludo, las frases y los accesos del Inicio', () => {
    const el = render();
    const texto = el.textContent ?? '';
    expect(texto).toContain('Aquí puedes gestionar tu atención de salud en SESAES.');
    expect(texto).toContain('Tu bienestar también es parte de tu vida universitaria');
    expect(texto).toContain('¿Qué necesitas hacer hoy?');
    expect(texto).toContain('Agendar una cita');
    expect(texto).toContain('Completar cuestionario');
    expect(texto).toContain('Tu salud importa');
  });

  it('el Inicio no incluye una tarjeta de notificaciones', () => {
    const el = render();
    const resumen = el.querySelector('.inicio-resumen-est');
    expect(resumen?.textContent).not.toContain('Notificaciones');
    expect(el.querySelectorAll('.resumen-card-est').length).toBe(2);
  });

  it('sin citas próximas ofrece agendar', () => {
    c.proximasCitas = [];
    const el = render();
    expect(el.querySelector('.resumen-card-est')?.textContent).toContain('No tienes citas próximas');
    expect(el.querySelector('.resumen-card-boton-primario')?.textContent).toContain('Agendar cita');
  });

  it('con una cita próxima muestra especialidad, fecha y profesional', () => {
    c.proximasCitas = [{ especialidad: 'Nutrición', fecha: '2026-10-05', hora: '10:00', profesional: 'Carlos Muñoz' }];
    const t = render().querySelector('.resumen-card-est')?.textContent ?? '';
    expect(t).toContain('Nutrición');
    expect(t).toContain('Carlos Muñoz');
  });

  it('cuenta los cuestionarios pendientes y enlaza a la sección', () => {
    c.cuestionariosPendientes = [{ profesional_id: 1 }, { profesional_id: 2 }];
    const el = render();
    const card = el.querySelectorAll('.resumen-card-est')[1];
    expect(card.textContent).toContain('2 cuestionarios');
    expect(card.querySelector('.resumen-card-boton')?.textContent).toContain('Ver cuestionarios');
  });

  it('la tabla muestra solo las 3 últimas atenciones con su estado', () => {
    c.historialMostrado = [
      { especialidad: 'Kinesiología', profesional: 'A', fecha: '21/09/2026', estado: 'cancelada' },
      { especialidad: 'Nutrición', profesional: 'B', fecha: '30/07/2026', estado: 'completada' },
      { especialidad: 'Medicina General', profesional: 'C', fecha: '04/08/2026', estado: 'completada' },
      { especialidad: 'Otra', profesional: 'D', fecha: '01/01/2026', estado: 'completada' }
    ];
    const filas = render().querySelectorAll('.tabla-inicio-est tbody tr');
    expect(filas.length).toBe(3);
    expect(filas[0].querySelector('.estado-badge')?.classList).toContain('cancelada');
  });

  it('el menú lateral tiene los accesos y navega a cada sección', () => {
    const el = render();
    const items = Array.from(el.querySelectorAll('.sidebar-nav .nav-item')).map(x => x.textContent?.trim());
    expect(items).toEqual(['home Inicio', 'event_available Agendar cita', 'calendar_month Mis citas',
      'assignment Cuestionarios', 'favorite Mis atenciones', 'person Mi perfil']);
    c.navegarA('citas', 'historial');
    expect(c.seccionActiva).toBe('citas');
    expect(c.citasTab).toBe('historial');
    c.navegarA('cuestionarios');
    expect(c.tituloSeccionEst).toBe('Cuestionarios');
  });

  it('la sección Cuestionarios lista los pendientes', () => {
    c.cuestionariosPendientes = [{ profesional_id: 1, profesional_nombre: 'Dra. Ana', especialidad: 'Medicina General' }];
    c.navegarA('cuestionarios');
    const el = render();
    expect(el.querySelector('.cuestionario-fila-est')?.textContent).toContain('Dra. Ana');
  });

  describe('calendario del Inicio', () => {
    it('marca el día de hoy y los días con cita', () => {
      const hoy = new Date();
      const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      c.proximasCitas = [{ fecha: iso }];
      const dias = c.calInicioDias.filter(d => d !== null);
      expect(dias.filter(d => d!.hoy).length).toBe(1);
      expect(dias.find(d => d!.hoy)!.conCita).toBe(true);
    });

    it('la semana empieza en lunes y navega entre meses', () => {
      const primera = c.calInicioDias.findIndex(d => d?.num === 1);
      const ref = new Date(); ref.setDate(1);
      expect(primera).toBe((ref.getDay() + 6) % 7);
      const titulo = c.calInicioTitulo;
      c.calInicioMesSiguiente();
      expect(c.calInicioTitulo).not.toBe(titulo);
      c.calInicioMesAnterior();
      expect(c.calInicioTitulo).toBe(titulo);
    });
  });

  it('usa Material Symbols y modo claro/oscuro con tokens (sin SVG inline)', () => {
    const el = render();
    expect(el.querySelectorAll('svg').length).toBe(0);
    expect(el.querySelectorAll('.material-symbols-outlined').length).toBeGreaterThan(10);
  });
});
