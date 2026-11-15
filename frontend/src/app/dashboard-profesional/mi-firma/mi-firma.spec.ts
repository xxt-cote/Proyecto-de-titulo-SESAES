import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { EstadoFirma, MiFirmaComponent } from './mi-firma';
import { environment } from '../../config';

const API = environment.apiUrl;
const URL_FIRMA = `${API}/profesional/5/firma`;
const SIN_FIRMA: EstadoFirma = { tiene_firma: false, metodo: null, actualizada_en: null, imagen: null };
const CON_FIRMA: EstadoFirma = {
  tiene_firma: true, metodo: 'dibujada', actualizada_en: '2026-11-14T15:00:00Z',
  imagen: 'data:image/png;base64,AAAA',
};

function crear(compacto = false) {
  const fixture = TestBed.createComponent(MiFirmaComponent);
  fixture.componentInstance.profId = 5;
  fixture.componentInstance.compacto = compacto;
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  const cargar = (estado: EstadoFirma) => { http.expectOne(URL_FIRMA).flush(estado); fixture.detectChanges(); };
  return { fixture, c: fixture.componentInstance, http, el: fixture.nativeElement as HTMLElement, cargar };
}

describe('MiFirmaComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [MiFirmaComponent],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sin firma avisa que los documentos saldrán sin ella y ofrece registrarla', () => {
    const { el, cargar } = crear();
    cargar(SIN_FIRMA);
    expect(el.textContent).toContain('saldrán sin ella');
    expect(el.textContent).toContain('Registrar mi firma');
    expect(el.querySelector('.mf-vista img')).toBeNull();
  });

  it('con firma muestra la vista previa y permite cambiarla o eliminarla', () => {
    const { el, cargar } = crear();
    cargar(CON_FIRMA);
    expect(el.querySelector('.mf-vista img')?.getAttribute('src')).toBe(CON_FIRMA.imagen);
    expect(el.textContent).toContain('Cambiar firma');
    expect(el.textContent).toContain('Eliminar');
  });

  it('dice con claridad que es una firma digitalizada y no una firma electrónica avanzada', () => {
    const { el, cargar } = crear();
    cargar(SIN_FIRMA);
    expect(el.textContent).toContain('firma manuscrita digitalizada');
    expect(el.textContent).toContain('no equivale a una firma electrónica avanzada');
  });

  it('en la versión compacta no repite la explicación larga', () => {
    const { el, cargar } = crear(true);
    cargar(CON_FIRMA);
    expect(el.textContent).not.toContain('no equivale a una firma electrónica avanzada');
    expect(el.textContent).toContain('Se incorporará a los documentos que emitas');
  });

  it('guardar envía la firma al servidor y refleja el resultado', () => {
    const { fixture, c, http, el, cargar } = crear();
    cargar(SIN_FIRMA);
    c.abrirEditor();
    fixture.detectChanges();
    expect(el.querySelector('app-firma-pad')).not.toBeNull();

    c.guardar({ imagen: 'data:image/png;base64,AAAA', metodo: 'dibujada' });
    const req = http.expectOne(URL_FIRMA);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ imagen: 'data:image/png;base64,AAAA', metodo: 'dibujada' });
    req.flush(CON_FIRMA);
    fixture.detectChanges();

    expect(c.tieneFirma).toBe(true);
    expect(c.editando).toBe(false);
    expect(el.querySelector('app-firma-pad')).toBeNull();
    expect(el.textContent).toContain('quedó registrada');
  });

  it('si el servidor rechaza la firma muestra su motivo y deja abierto el editor', () => {
    const { fixture, c, http, el, cargar } = crear();
    cargar(SIN_FIRMA);
    c.abrirEditor();
    c.guardar({ imagen: 'data:image/png;base64,AAAA', metodo: 'subida' });
    http.expectOne(URL_FIRMA).flush({ detail: 'La firma es demasiado pesada (máximo ~300 KB).' }, { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();
    expect(c.editando).toBe(true);
    expect(el.querySelector('.mf-error')?.textContent).toContain('demasiado pesada');
  });

  it('eliminar pide confirmación antes de llamar al servidor', () => {
    const { fixture, c, http, el, cargar } = crear();
    cargar(CON_FIRMA);
    c.pedirEliminar();
    fixture.detectChanges();
    expect(el.textContent).toContain('Los documentos que ya emitiste no cambian');
    http.expectNone(URL_FIRMA);

    c.eliminar();
    const req = http.expectOne(URL_FIRMA);
    expect(req.request.method).toBe('DELETE');
    req.flush(SIN_FIRMA);
    fixture.detectChanges();
    expect(c.tieneFirma).toBe(false);
    expect(el.textContent).toContain('Registrar mi firma');
  });

  it('si no puede consultar la firma lo avisa y permite reintentar', () => {
    const { fixture, c, http, el } = crear();
    http.expectOne(URL_FIRMA).flush('error', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo consultar tu firma');
    c.cargar();
    http.expectOne(URL_FIRMA).flush(SIN_FIRMA);
    fixture.detectChanges();
    expect(el.textContent).toContain('Registrar mi firma');
  });

  it('con un id de profesional inválido no hace ninguna llamada', () => {
    const fixture = TestBed.createComponent(MiFirmaComponent);
    fixture.componentInstance.profId = 0;
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectNone(() => true);
    expect(fixture.componentInstance.cargando).toBe(false);
  });
});
