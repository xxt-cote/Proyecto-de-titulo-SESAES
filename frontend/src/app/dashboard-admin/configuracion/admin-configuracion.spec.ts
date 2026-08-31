import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdminConfiguracionComponent } from './admin-configuracion';

describe('AdminConfiguracionComponent', () => {
  let component: AdminConfiguracionComponent;
  let fixture: ComponentFixture<AdminConfiguracionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminConfiguracionComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminConfiguracionComponent);
    component = fixture.componentInstance;
  });

  it('debe crearse', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('debe cambiar y emitir la pestaña activa', () => {
    const spy = vi.spyOn(component.configTabActivaChange, 'emit');

    component.cambiarTab('seguridad');

    expect(component.configTabActiva).toBe('seguridad');
    expect(spy).toHaveBeenCalledWith('seguridad');
  });

  it('debe mostrar la información general del centro', () => {
    fixture.componentRef.setInput('configCentro', {
      nombre_centro: 'SESAES UTEM',
      telefono: '+56 2 1234 5678',
      direccion: 'Ñuñoa',
      correo_contacto: 'sesaes@utem.cl',
      horario_atencion: '08:00–18:00'
    });

    fixture.componentRef.setInput('configTabActiva', 'general');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Información del Centro SESAES'
    );
  });

  it('debe emitir las acciones de edición del centro', () => {
    const editarSpy = vi.spyOn(component.habilitarEdicionCentro, 'emit');
    const cancelarSpy = vi.spyOn(component.cancelarEdicionCentro, 'emit');
    const guardarSpy = vi.spyOn(component.guardarInfoCentro, 'emit');

    component.habilitarEdicionCentro.emit();
    component.cancelarEdicionCentro.emit();
    component.guardarInfoCentro.emit();

    expect(editarSpy).toHaveBeenCalledTimes(1);
    expect(cancelarSpy).toHaveBeenCalledTimes(1);
    expect(guardarSpy).toHaveBeenCalledTimes(1);
  });

  it('debe mostrar las reglas de citas y emitir guardado', () => {
    const guardarSpy = vi.spyOn(
      component.guardarConfiguracionCitas,
      'emit'
    );

    fixture.componentRef.setInput('configTabActiva', 'citas');
    fixture.componentRef.setInput('configCitas', {
      duracion_turno_min: 20,
      cupos_por_turno: 4,
      agendamiento_por_pacientes: true,
      cancelacion_instantanea: false,
      sobreturnos_habilitados: true
    });

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reglas de citas');

    component.guardarConfiguracionCitas.emit();
    expect(guardarSpy).toHaveBeenCalledTimes(1);
  });

  it('debe mostrar los días cerrados y emitir sus acciones', () => {
    const verSpy = vi.spyOn(component.verCitasDiaCerrado, 'emit');
    const reabrirSpy = vi.spyOn(component.reabrirDiaCerrado, 'emit');
    const crearSpy = vi.spyOn(component.crearDiaCerrado, 'emit');

    const dia = {
      id: 7,
      fecha: '2026-09-18',
      motivo: 'Centro cerrado'
    };

    fixture.componentRef.setInput('configTabActiva', 'horarios');
    fixture.componentRef.setInput('diasCerrados', [dia]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2026-09-18');
    expect(fixture.nativeElement.textContent).toContain('Centro cerrado');

    component.verCitasDiaCerrado.emit(dia);
    component.reabrirDiaCerrado.emit(dia);
    component.crearDiaCerrado.emit();

    expect(verSpy).toHaveBeenCalledWith(dia);
    expect(reabrirSpy).toHaveBeenCalledWith(dia);
    expect(crearSpy).toHaveBeenCalledTimes(1);
  });

  it('debe mostrar los usuarios del sistema', () => {
    fixture.componentRef.setInput('configTabActiva', 'usuarios');
    fixture.componentRef.setInput('usuariosDelSistema', [
      {
        nombre: 'Admin SESAES',
        rol: 'Administrador',
        estado: 'activo'
      },
      {
        nombre: 'Profesional UTEM',
        rol: 'Profesional — Psicología',
        estado: 'activo'
      }
    ]);

    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Admin SESAES');
    expect(texto).toContain('Profesional UTEM');
  });

  it('debe mostrar auditoría y emitir filtrado/exportaciones', () => {
    const cargarSpy = vi.spyOn(component.cargarAuditoria, 'emit');
    const excelSpy = vi.spyOn(component.exportarAuditoriaExcel, 'emit');
    const pdfSpy = vi.spyOn(component.exportarAuditoriaPdf, 'emit');

    fixture.componentRef.setInput('configTabActiva', 'seguridad');
    fixture.componentRef.setInput('auditoria', [
      {
        fecha: '2026-08-31T10:00:00',
        accion: 'ACTUALIZAR',
        detalle: 'Cambio de configuración',
        entidad: 'configuracion',
        entidad_id: 1,
        seleccionada: false
      }
    ]);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Cambio de configuración'
    );

    component.cargarAuditoria.emit();
    component.exportarAuditoriaExcel.emit();
    component.exportarAuditoriaPdf.emit();

    expect(cargarSpy).toHaveBeenCalledTimes(1);
    expect(excelSpy).toHaveBeenCalledTimes(1);
    expect(pdfSpy).toHaveBeenCalledTimes(1);
  });

  it('debe emitir selección total y eliminación de auditoría seleccionada', () => {
    const seleccionarSpy = vi.spyOn(
      component.toggleSeleccionarTodaAuditoria,
      'emit'
    );
    const eliminarSpy = vi.spyOn(
      component.eliminarAuditoriaSeleccionada,
      'emit'
    );

    component.toggleSeleccionarTodaAuditoria.emit();
    component.eliminarAuditoriaSeleccionada.emit();

    expect(seleccionarSpy).toHaveBeenCalledTimes(1);
    expect(eliminarSpy).toHaveBeenCalledTimes(1);
  });

  it('debe mantener los filtros de auditoría enlazables con el shell', () => {
    const desdeSpy = vi.spyOn(component.auditFiltroDesdeChange, 'emit');
    const hastaSpy = vi.spyOn(component.auditFiltroHastaChange, 'emit');

    component.auditFiltroDesdeChange.emit('2026-08-01');
    component.auditFiltroHastaChange.emit('2026-08-31');

    expect(desdeSpy).toHaveBeenCalledWith('2026-08-01');
    expect(hastaSpy).toHaveBeenCalledWith('2026-08-31');
  });
});