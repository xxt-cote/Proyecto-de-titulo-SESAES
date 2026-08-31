import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { AdminPerfilComponent } from './admin-perfil';

describe('AdminPerfilComponent', () => {
  let component: AdminPerfilComponent;
  let fixture: ComponentFixture<AdminPerfilComponent>;
  let httpMock: HttpTestingController;

  const configCentroMock = {
    nombre_centro: 'SESAES', direccion: 'José Pedro Alessandri 1200, Ñuñoa',
    telefono: '', correo_contacto: 'sesaes@utem.cl', horario_atencion: 'Lunes a Viernes 08:00–18:00',
    nombre_admin: 'Admin SESAES', foto_admin_url: null
  };

  beforeEach(async () => {
    // provideHttpClient/HttpTestingController se incluyen únicamente para
    // verificar que este componente NO dispara ningún HTTP propio: el
    // guardado real (PATCH /configuracion-centro y cambiar-password) sigue
    // siendo responsabilidad del shell, este hijo solo emite la intención.
    await TestBed.configureTestingModule({
      imports: [AdminPerfilComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPerfilComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

it('renderiza los datos recibidos por Input (nombre y correo del centro)', () => {
  fixture.componentRef.setInput('configCentro', { ...configCentroMock });
  fixture.detectChanges();

  expect(component.configPerfil.nombre_admin).toBe('Admin SESAES');

  const inputsPerfil = fixture.nativeElement.querySelectorAll(
    '.campo-grupo input'
  ) as NodeListOf<HTMLInputElement>;

  const inputCorreo = Array.from(inputsPerfil).find(
    input => input.value === 'sesaes@utem.cl'
  );

  expect(inputCorreo).toBeTruthy();
  expect(inputCorreo?.value).toBe('sesaes@utem.cl');
});

  it('habilitar edición mantiene comportamiento: desbloquea campos y permite cancelar sin cambios', () => {
    fixture.componentRef.setInput('configCentro', { ...configCentroMock });
    fixture.detectChanges();

    expect(component.adminPerfilEnEdicion).toBe(false);
    component.habilitarEdicionPerfilAdmin();
    expect(component.adminPerfilEnEdicion).toBe(true);
    expect(component.perfilAdminModificado).toBe(false);

    component.configPerfil.nombre_admin = 'Otro nombre';
    expect(component.perfilAdminModificado).toBe(true);

    component.cancelarEdicionPerfilAdmin();
    expect(component.adminPerfilEnEdicion).toBe(false);
    expect(component.configPerfil.nombre_admin).toBe('Admin SESAES');
    expect(component.configPerfil.contrasena_actual).toBe('');
  });

  it('guardar emite el payload correcto (nombre y contraseñas)', () => {
    fixture.componentRef.setInput('configCentro', { ...configCentroMock });
    fixture.detectChanges();

    component.habilitarEdicionPerfilAdmin();
    component.configPerfil.nombre_admin = 'Nuevo Nombre Admin';
    component.configPerfil.contrasena_actual = 'actual123';
    component.configPerfil.contrasena_nueva = 'nueva123';
    component.configPerfil.contrasena_conf = 'nueva123';

    let payload: any = null;
    component.guardarPerfil.subscribe((p: any) => payload = p);

    component.guardarPerfilAdmin();

    expect(payload).toEqual({
      nombre_admin: 'Nuevo Nombre Admin',
      contrasena_actual: 'actual123',
      contrasena_nueva: 'nueva123',
      contrasena_conf: 'nueva123'
    });
  });

  it('guardar no emite nada si no hay cambios (perfilAdminModificado en false)', () => {
    fixture.componentRef.setInput('configCentro', { ...configCentroMock });
    fixture.detectChanges();

    let emitido = false;
    component.guardarPerfil.subscribe(() => emitido = true);

    component.guardarPerfilAdmin();

    expect(emitido).toBe(false);
  });

  it('finalizarEdicion(true) restablece edición y limpia los campos de contraseña', () => {
    fixture.componentRef.setInput('configCentro', { ...configCentroMock });
    fixture.detectChanges();

    component.habilitarEdicionPerfilAdmin();
    component.fotoAdminCambiada = true;
    component.configPerfil.contrasena_actual = 'a';
    component.configPerfil.contrasena_nueva = 'b';
    component.configPerfil.contrasena_conf = 'b';

    component.finalizarEdicion(true);

    expect(component.adminPerfilEnEdicion).toBe(false);
    expect(component.fotoAdminCambiada).toBe(false);
    expect(component.configPerfil.contrasena_actual).toBe('');
    expect(component.configPerfil.contrasena_nueva).toBe('');
    expect(component.configPerfil.contrasena_conf).toBe('');
  });

  it('finalizarEdicion(false) restablece edición pero NO toca los campos de contraseña', () => {
    fixture.componentRef.setInput('configCentro', { ...configCentroMock });
    fixture.detectChanges();

    component.habilitarEdicionPerfilAdmin();
    component.configPerfil.contrasena_actual = 'sigue-aqui';

    component.finalizarEdicion(false);

    expect(component.adminPerfilEnEdicion).toBe(false);
    expect(component.configPerfil.contrasena_actual).toBe('sigue-aqui');
  });

  it('onFotoRecortada actualiza configCentro.foto_admin_url (misma referencia) y marca fotoAdminCambiada', () => {
    const centro = { ...configCentroMock };
    fixture.componentRef.setInput('configCentro', centro);
    fixture.detectChanges();

    component.onFotoRecortada('data:image/png;base64,ABC');

    expect(component.configCentro.foto_admin_url).toBe('data:image/png;base64,ABC');
    expect(centro.foto_admin_url).toBe('data:image/png;base64,ABC');
    expect(component.fotoAdminCambiada).toBe(true);
    expect(component.imagenParaRecortar).toBeNull();
  });

  it('ngOnChanges sincroniza configPerfil.nombre_admin cuando el shell reasigna configCentro', () => {
    fixture.componentRef.setInput('configCentro', { ...configCentroMock });
    fixture.detectChanges();
    expect(component.configPerfil.nombre_admin).toBe('Admin SESAES');

    fixture.componentRef.setInput('configCentro', { ...configCentroMock, nombre_admin: 'Recargado' });
    fixture.detectChanges();
    expect(component.configPerfil.nombre_admin).toBe('Recargado');
  });

  it('NO realiza ningún HTTP propio: el guardado se emite, no se ejecuta aquí', () => {
    fixture.componentRef.setInput('configCentro', { ...configCentroMock });
    fixture.detectChanges();
    // httpMock.verify() en afterEach comprueba que no quedó ninguna petición pendiente.
    expect(true).toBe(true);
  });
});
