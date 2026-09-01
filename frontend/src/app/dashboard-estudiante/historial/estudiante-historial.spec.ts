import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { EstudianteHistorialComponent } from './estudiante-historial';

describe('EstudianteHistorialComponent', () => {
  let component: EstudianteHistorialComponent;
  let fixture: ComponentFixture<EstudianteHistorialComponent>;

  const crearHistorial = (cantidad: number) =>
    Array.from({ length: cantidad }, (_, i) => ({
      id: i + 1,
      iniciales: `E${i + 1}`,
      profesional: `Profesional ${i + 1}`,
      especialidad: i % 2 === 0 ? 'Medicina General' : 'Psicología',
      fecha: '31/08/2026',
      fechaRaw: '2026-08-31',
      hora: '10:00',
      estado: i === 0 ? 'cancelada' : 'completada',
      tiene_pdf: i === 1
    }));

  beforeEach(async () => {
    // No se provee HttpClient/HttpTestingController a propósito: si el
    // componente intentara inyectar HttpClient para cargar el historial,
    // esta configuración fallaría al crear el fixture. Que el test pase
    // así confirma que EstudianteHistorialComponent no hace HTTP propio.
    await TestBed.configureTestingModule({
      imports: [EstudianteHistorialComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EstudianteHistorialComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('especialidadesDisponibles', ['Medicina General', 'Psicología']);
    fixture.detectChanges();
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('no realiza llamadas HTTP propias', () => {
    // El componente no declara HttpClient como dependencia — no hay
    // ningún import de @angular/common/http en este archivo, y el
    // TestBed de arriba tampoco lo provee.
    expect((component as any).http).toBeUndefined();
  });

  it('muestra los registros recibidos por @Input', () => {
    const historial = crearHistorial(3);
    fixture.componentRef.setInput('historial', historial);
    fixture.detectChanges();

    expect(component.historialMostrado.length).toBe(3);
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Profesional 1');
    expect(texto).toContain('Profesional 3');
  });

  it('maneja correctamente un historial vacío', () => {
    fixture.componentRef.setInput('historial', []);

    expect(() => fixture.detectChanges()).not.toThrow();

    expect(component.historialMostrado).toEqual([]);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(0);
  });

  it('resetea la vista al llegar un nuevo valor de historial (ngOnChanges)', () => {
    fixture.componentRef.setInput('historial', crearHistorial(5));
    fixture.detectChanges();
    expect(component.historialMostrado.length).toBe(5);

    fixture.componentRef.setInput('historial', crearHistorial(2));
    fixture.detectChanges();
    expect(component.historialMostrado.length).toBe(2);
  });

  it('filtra por nombre de profesional al presionar "Filtrar"', () => {
    fixture.componentRef.setInput('historial', crearHistorial(3));
    fixture.detectChanges();

    component.filtroProfesional = 'Profesional 2';
    component.historialFiltrado();
    fixture.detectChanges();

    expect(component.historialMostrado.length).toBe(1);
    expect(component.historialMostrado[0].profesional).toBe('Profesional 2');
  });

  it('filtra por especialidad y por fecha exacta (fechaRaw)', () => {
    const historial = crearHistorial(4);
    fixture.componentRef.setInput('historial', historial);
    fixture.detectChanges();

    component.filtroEspecialidad = 'Psicología';
    component.historialFiltrado();
    expect(component.historialMostrado.every(h => h.especialidad === 'Psicología')).toBe(true);

    component.filtroEspecialidad = '';
    component.filtroFecha = '2026-08-31';
    component.historialFiltrado();
    expect(component.historialMostrado.length).toBe(4);

    component.filtroFecha = '2099-01-01';
    component.historialFiltrado();
    expect(component.historialMostrado.length).toBe(0);
  });

  it('"Limpiar" restablece los filtros y vuelve a mostrar todo el historial', () => {
    fixture.componentRef.setInput('historial', crearHistorial(3));
    fixture.detectChanges();

    component.filtroProfesional = 'Profesional 2';
    component.historialFiltrado();
    expect(component.historialMostrado.length).toBe(1);

    component.limpiarFiltros();

    expect(component.filtroProfesional).toBe('');
    expect(component.filtroEspecialidad).toBe('');
    expect(component.filtroFecha).toBe('');
    expect(component.historialMostrado.length).toBe(3);
  });

  it('emite reagendar con la cita cancelada seleccionada', () => {
    const historial = crearHistorial(1); // estado 'cancelada'
    const emitSpy = vi.spyOn(component.reagendar, 'emit');
    fixture.componentRef.setInput('historial', historial);
    fixture.detectChanges();

    const boton = fixture.nativeElement.querySelector('.doc-link') as HTMLElement;
    boton.click();

    expect(emitSpy).toHaveBeenCalledWith(historial[0]);
  });

  it('emite verDetalle con la atención completada seleccionada', () => {
    const historial = crearHistorial(2); // el segundo elemento está 'completada'
    const emitSpy = vi.spyOn(component.verDetalle, 'emit');
    fixture.componentRef.setInput('historial', historial);
    fixture.detectChanges();

    const enlaces = Array.from(
      fixture.nativeElement.querySelectorAll('.doc-link') as NodeListOf<HTMLElement>
    );
    const verDetalleLink = enlaces.find(el => el.textContent?.includes('Ver detalle'));

    expect(verDetalleLink).toBeTruthy();
    verDetalleLink!.click();

    expect(emitSpy).toHaveBeenCalledWith(historial[1]);
  });

  it('emite descargarPdf con el id cuando la atención tiene PDF', () => {
    const historial = crearHistorial(2); // el segundo elemento tiene tiene_pdf=true
    const emitSpy = vi.spyOn(component.descargarPdf, 'emit');
    fixture.componentRef.setInput('historial', historial);
    fixture.detectChanges();

    const enlaces = Array.from(
      fixture.nativeElement.querySelectorAll('.doc-link') as NodeListOf<HTMLElement>
    );
    const pdfLink = enlaces.find(el => el.textContent?.includes('PDF'));

    expect(pdfLink).toBeTruthy();
    pdfLink!.click();

    expect(emitSpy).toHaveBeenCalledWith(historial[1].id);
  });
});
