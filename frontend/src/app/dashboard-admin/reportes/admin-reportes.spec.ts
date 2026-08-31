import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdminReportesComponent } from './admin-reportes';

describe('AdminReportesComponent', () => {
  let component: AdminReportesComponent;
  let fixture: ComponentFixture<AdminReportesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReportesComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReportesComponent);
    component = fixture.componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('debe calcular los totales desde historialAdmin', () => {
    fixture.componentRef.setInput('historialAdmin', [
      { estado: 'completada' },
      { estado: 'completada' },
      { estado: 'cancelada' },
      { estado: 'pendiente' },
      { estado: 'inasistencia' }
    ]);
    fixture.detectChanges();

    expect(component.reporteCompletadas).toBe(2);
    expect(component.reporteCanceladas).toBe(1);
    expect(component.reportePendientes).toBe(1);
    expect(component.reporteInasistencias).toBe(1);
  });

  it('debe mostrar profesionales activos y urgentes pendientes', () => {
    fixture.componentRef.setInput('profesionalesActivos', 7);
    fixture.componentRef.setInput('urgentesPendientes', 3);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('7');
    expect(texto).toContain('3');
  });

  it('debe renderizar el gráfico por especialidad', () => {
    fixture.componentRef.setInput('graficoEspecialidad', [
      { especialidad: 'Psicología', porcentaje: 60 },
      { especialidad: 'Medicina General', porcentaje: 40 }
    ]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Psicología');
    expect(texto).toContain('60%');
    expect(texto).toContain('Medicina General');
    expect(texto).toContain('40%');
  });

  it('debe mostrar Sin datos cuando no hay gráfico por especialidad', () => {
    fixture.componentRef.setInput('graficoEspecialidad', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sin datos');
  });

  it('debe emitir exportarEspecialidadExcel', () => {
    const emitSpy = vi.spyOn(component.exportarEspecialidadExcel, 'emit');
    fixture.detectChanges();

    const boton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find(b => b.textContent?.includes('Excel'));

    expect(boton).toBeTruthy();
    boton!.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('debe emitir irAHistorial', () => {
    const emitSpy = vi.spyOn(component.irAHistorial, 'emit');
    fixture.detectChanges();

    const boton = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find(b => b.textContent?.includes('Ir a Historial'));

    expect(boton).toBeTruthy();
    boton!.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });
});