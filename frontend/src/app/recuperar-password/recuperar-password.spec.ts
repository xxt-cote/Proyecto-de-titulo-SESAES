import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { RecuperarPasswordComponent } from './recuperar-password';
import { environment } from '../config';

const URL = `${environment.apiUrl}/recuperar-password`;

function crear() {
  const fixture = TestBed.createComponent(RecuperarPasswordComponent);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  return { fixture, c: fixture.componentInstance, http, el: fixture.nativeElement as HTMLElement };
}

describe('RecuperarPasswordComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [RecuperarPasswordComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }));
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra el formulario con el campo de correo etiquetado y un enlace para volver al login', () => {
    const { el } = crear();
    expect(el.querySelector('label[for="rp-correo"]')?.textContent).toContain('Correo institucional');
    expect(el.querySelector('#rp-correo')).not.toBeNull();
    expect(el.querySelector('a[href="/login"]')).not.toBeNull();
    expect(el.querySelector('main#main')).not.toBeNull();
  });

  it('no llama al servidor si el correo no es institucional', () => {
    const { fixture, c, http, el } = crear();
    c.correo = 'persona@gmail.com';
    c.enviar();
    fixture.detectChanges();
    http.expectNone(URL);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('@utem.cl');
  });

  it('envía el correo y muestra el mensaje del servidor, que no revela si la cuenta existe', () => {
    const { fixture, c, http, el } = crear();
    c.correo = '  ana@utem.cl ';
    c.enviar();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ correo: 'ana@utem.cl' });
    req.flush({ message: 'Si el correo está registrado, te enviamos un enlace.' });
    fixture.detectChanges();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Si el correo está registrado');
    expect(el.querySelector('form')).toBeNull();
  });

  it('con demasiadas solicitudes (429) lo dice con claridad y deja volver a intentar', () => {
    const { fixture, c, http, el } = crear();
    c.correo = 'ana@utem.cl';
    c.enviar();
    http.expectOne(URL).flush({ detail: 'x' }, { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('muchas solicitudes');
    expect(c.enviando).toBe(false);
  });

  it('ante un error del servidor muestra un aviso genérico', () => {
    const { fixture, c, http, el } = crear();
    c.correo = 'ana@utem.cl';
    c.enviar();
    http.expectOne(URL).flush('error', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No pudimos procesar');
  });

  it('evita enviar dos veces mientras espera la respuesta', () => {
    const { c, http } = crear();
    c.correo = 'ana@utem.cl';
    c.enviar();
    c.enviar();
    http.expectOne(URL).flush({ message: 'ok' });
  });
});
