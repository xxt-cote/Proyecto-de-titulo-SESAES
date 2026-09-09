import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdminEstudiantesComponent } from './admin-estudiantes';

describe('AdminEstudiantesComponent', () => {
  let component: AdminEstudiantesComponent;
  let fixture: ComponentFixture<AdminEstudiantesComponent>;

  const estudiantes = [
    {
      id: 1,
      nombre: 'Ana Pérez',
      correo: 'ana@utem.cl',
      rut: '11.111.111-1',
      carrera: 'Derecho'
    },
    {
      id: 2,
      nombre: 'Luis Soto',
      correo: 'luis@utem.cl',
      rut: '22.222.222-2',
      carrera: 'Ingeniería'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEstudiantesComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminEstudiantesComponent);
    component = fixture.componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('debe calcular las páginas según el total y tamaño de página', () => {
    fixture.componentRef.setInput('estudiantesTotal', 45);
    fixture.componentRef.setInput('estudiantesPorPagina', 20);
    fixture.detectChanges();

    expect(component.getPaginasEstudiantes()).toEqual([1, 2, 3]);
  });

  it('debe renderizar el listado de estudiantes', () => {
    fixture.componentRef.setInput('estudiantesAdmin', estudiantes);
    fixture.componentRef.setInput('estudiantesTotal', 2);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ana Pérez');
    expect(texto).toContain('Luis Soto');
    expect(texto).toContain('Derecho');
  });

  it('debe mostrar el estado vacío cuando no hay estudiantes', () => {
    fixture.componentRef.setInput('estudiantesAdmin', []);
    fixture.componentRef.setInput('estudiantesTotal', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No hay estudiantes con los filtros aplicados'
    );
  });

  it('debe mostrar el estado de carga', () => {
    fixture.componentRef.setInput('estudiantesCargando', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cargando...');
    expect(fixture.nativeElement.querySelector('table.admin-tabla')).toBeNull();
  });

  it('debe emitir buscar y limpiar desde sus botones', () => {
    const buscarSpy = vi.spyOn(component.buscar, 'emit');
    const limpiarSpy = vi.spyOn(component.limpiar, 'emit');
    fixture.detectChanges();

    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    );

    botones.find(b => b.textContent?.trim() === 'Buscar')!.click();
    botones.find(b => b.textContent?.trim() === 'Limpiar')!.click();

    expect(buscarSpy).toHaveBeenCalledTimes(1);
    expect(limpiarSpy).toHaveBeenCalledTimes(1);
  });

  it('debe emitir la página solicitada', () => {
    const paginaSpy = vi.spyOn(component.cambiarPagina, 'emit');
    fixture.componentRef.setInput('estudiantesTotal', 45);
    fixture.componentRef.setInput('estudiantesPagina', 1);
    fixture.componentRef.setInput('estudiantesPorPagina', 20);
    fixture.detectChanges();

    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('button.btn-pag') as NodeListOf<HTMLButtonElement>
    );

    const pagina2 = botones.find(b => b.textContent?.trim() === '2');
    expect(pagina2).toBeTruthy();

    pagina2!.click();
    expect(paginaSpy).toHaveBeenCalledWith(2);
  });

  it('debe emitir verPerfil con el estudiante seleccionado', () => {
    const verSpy = vi.spyOn(component.verPerfil, 'emit');
    fixture.componentRef.setInput('estudiantesAdmin', [estudiantes[0]]);
    fixture.componentRef.setInput('estudiantesTotal', 1);
    fixture.detectChanges();

    const boton = fixture.nativeElement.querySelector(
      'button.btn-tabla-acciones'
    ) as HTMLButtonElement;

    boton.click();
    expect(verSpy).toHaveBeenCalledWith(estudiantes[0]);
  });

  it('debe renderizar la ficha y emitir cerrarPerfil', () => {
    const cerrarSpy = vi.spyOn(component.cerrarPerfil, 'emit');

    fixture.componentRef.setInput('modalPerfilEstudianteAbierto', true);
    fixture.componentRef.setInput('perfilEstudianteCargando', false);
    fixture.componentRef.setInput('fichaEstudianteSeleccionado', {
      nombre: 'Ana Pérez',
      rut: '11.111.111-1',
      correo: 'ana@utem.cl',
      carrera: 'Derecho',
      citas_totales: 4,
      citas_atendidas: 3,
      ultimas_atenciones: [
        {
          fecha: '2026-08-20',
          hora: '10:00',
          profesional: 'Profesional SESAES',
          especialidad: 'Medicina General',
          estado: 'completada'
        }
      ]
    });
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Ficha del estudiante');
    expect(texto).toContain('Ana Pérez');
    expect(texto).toContain('Profesional SESAES');

    const cerrar = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>
    ).find(b => b.textContent?.trim() === 'Cerrar');

    expect(cerrar).toBeTruthy();
    cerrar!.click();

    expect(cerrarSpy).toHaveBeenCalledTimes(1);
  });
});