import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { AdminProfesionalesComponent } from './admin-profesionales';

describe('AdminProfesionalesComponent', () => {
  let component: AdminProfesionalesComponent;
  let fixture: ComponentFixture<AdminProfesionalesComponent>;
  let httpMock: HttpTestingController;

  const profesionalesMock = [
    { id: 1, nombre: 'Dr. Pérez', especialidad: 'Psicología', correo: 'perez@utem.cl', rut: '11.111.111-1', estado: 'activo', iniciales: 'DP', duracion_min: 45 },
    { id: 2, nombre: 'Dra. Soto', especialidad: 'Odontología', correo: 'soto@utem.cl', rut: '22.222.222-2', estado: 'activo', iniciales: 'DS', duracion_min: 30 }
  ];

  beforeEach(async () => {
    // provideHttpClient/HttpTestingController se incluyen únicamente para
    // poder verificar (punto 5) que este componente NO dispara ningún GET
    // propio de profesionales: el arreglo llega siempre por @Input.
    await TestBed.configureTestingModule({
      imports: [AdminProfesionalesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminProfesionalesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Si el componente hiciera un GET propio (p. ej. su propio cargarProfesionales),
    // esta verificación fallaría por la petición pendiente sin atender.
    httpMock.verify();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('renderiza el listado de profesionales recibido por Input', () => {
    component.profesionales = profesionalesMock;
    component.especialidades = ['Psicología', 'Odontología'];
    fixture.detectChanges();

    const filas = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(filas.length).toBe(2);
    expect(component.profesionalesPaginados.length).toBe(2);
  });

 it('filtra el listado con la búsqueda local (busquedaProfesional)', async () => {
  component.profesionales = profesionalesMock;
  fixture.detectChanges();
  await fixture.whenStable();

  const input = fixture.nativeElement.querySelector('.search-input') as HTMLInputElement;

  input.value = 'Soto';
  input.dispatchEvent(new Event('input'));

  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  expect(component.busquedaProfesional).toBe('Soto');
  expect(component.profesionalesFiltradosBusqueda.length).toBe(1);
  expect(component.profesionalesFiltradosBusqueda[0].nombre).toBe('Dra. Soto');

const elementosNombre = fixture.nativeElement.querySelectorAll(
  'tbody .tabla-usuario strong'
) as NodeListOf<HTMLElement>;

const nombres = Array.from(elementosNombre)
  .map(element => element.textContent?.trim());

expect(nombres).toEqual(['Dra. Soto']);
});
  it('emite eliminarProfesional con el profesional seleccionado al confirmar desde el modal', () => {
    component.profesionales = profesionalesMock;
    fixture.detectChanges();

    component.abrirModalAcciones(profesionalesMock[0]);
    fixture.detectChanges();

    let emitido: any = null;
    component.eliminarProfesional.subscribe((p: any) => emitido = p);

    component.eliminarProfesionalDesdeModal();

    expect(emitido).toBeTruthy();
    expect(emitido.id).toBe(1);
    expect(emitido.nombre).toBe('Dr. Pérez');
  });

  it('emite crearProfesional con el payload correcto al confirmar el alta', () => {
    fixture.detectChanges();

    component.abrirModalAgregar();
    component.profNuevoDatos.nombre = 'Dr. Nuevo';
    component.profNuevoDatos.especialidad = 'Kinesiología';
    component.profNuevoDatos.correo = 'nuevo@utem.cl';

    let payload: any = null;
    component.crearProfesional.subscribe((p: any) => payload = p);

    component.continuarCrearProf();
    component.confirmarCrearProf();

    expect(payload).toEqual({
      nombre: 'Dr. Nuevo', especialidad: 'Kinesiología',
      correo: 'nuevo@utem.cl', rut: '',
      duracion_min: 45, estado: 'activo', password: 'prof123'
    });
  });

  it('preserva el feedback de validación emitiendo errorValidacion cuando falta el nombre', () => {
    fixture.detectChanges();

    component.abrirModalAgregar();
    component.profNuevoDatos.nombre = '';
    component.profNuevoDatos.especialidad = 'Kinesiología';
    component.profNuevoDatos.correo = 'nuevo@utem.cl';

    let mensaje: string | null = null;
    component.errorValidacion.subscribe((m: string) => mensaje = m);

    const resultado = component.continuarCrearProf();

    expect(resultado).toBe(false);
    expect(mensaje).toBe('El nombre es obligatorio.');
    expect(component.mostrarConfirmacionProf).toBe(false);
  });

  it('NO realiza ningún GET propio de profesionales al inicializarse', () => {
    component.profesionales = profesionalesMock;
    fixture.detectChanges();
    // httpMock.verify() en afterEach comprueba que no quedó ninguna petición
    // pendiente; este test documenta explícitamente la intención del punto 5.
    expect(true).toBe(true);
  });
});
