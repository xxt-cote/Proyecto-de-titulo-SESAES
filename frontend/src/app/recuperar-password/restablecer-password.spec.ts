import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { RestablecerPasswordComponent } from './restablecer-password';
import { environment } from '../config';

const URL = `${environment.apiUrl}/restablecer-password`;
const CLAVE_OK = 'Nueva#Clave2';

function crear(token: string | null = 'tok123') {
  TestBed.configureTestingModule({
    imports: [RestablecerPasswordComponent],
    providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } } },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RestablecerPasswordComponent);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, http: TestBed.inject(HttpTestingController), el: fixture.nativeElement as HTMLElement, navegar };
}

/** Escribe en un campo como lo haría una persona (evento `input`) y deja que Angular termine de actualizar. */
async function escribir(fixture: { detectChanges(): void; whenStable(): Promise<unknown>; nativeElement: HTMLElement }, selector: string, valor: string) {
  const campo = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('RestablecerPasswordComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('quita el token de la barra de direcciones al abrir (no queda en el historial)', () => {
    const { navegar } = crear();
    expect(navegar).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { token: null }, replaceUrl: true }));
  });

  it('sin token muestra que el enlace no es válido y ofrece pedir uno nuevo', () => {
    const { el, c } = crear(null);
    expect(c.enlaceInvalido).toBe(true);
    expect(el.textContent).toContain('El enlace no es válido');
    expect(el.querySelector('a[href="/recuperar"]')).not.toBeNull();
    expect(el.querySelector('form')).toBeNull();
  });

  it('marca los requisitos a medida que se cumplen y bloquea el botón hasta cumplirlos todos', async () => {
    const { fixture, el } = crear();
    const boton = () => el.querySelector('button[type="submit"]') as HTMLButtonElement;
    await escribir(fixture, '#rp-nueva', 'abc');
    await escribir(fixture, '#rp-repetir', 'abc');
    expect(el.querySelectorAll('.rp-reglas li.cumple').length).toBeGreaterThan(0);
    expect(el.querySelectorAll('.rp-reglas li.cumple').length).toBeLessThan(6);
    expect(boton().disabled).toBe(true);
    await escribir(fixture, '#rp-nueva', CLAVE_OK);
    await escribir(fixture, '#rp-repetir', CLAVE_OK);
    expect(el.querySelectorAll('.rp-reglas li.cumple').length).toBe(6);
    expect(boton().disabled).toBe(false);
  });

  it('avisa cuando las contraseñas no coinciden y no deja enviar', async () => {
    const { fixture, c, http, el } = crear();
    await escribir(fixture, '#rp-nueva', CLAVE_OK);
    await escribir(fixture, '#rp-repetir', 'Otra#Clave3');
    expect(el.textContent).toContain('no coinciden');
    c.enviar();
    http.expectNone(URL);
  });

  it('envía el token y la contraseña nueva, y al terminar ofrece ir a iniciar sesión', () => {
    const { fixture, c, http, el } = crear();
    c.nueva = CLAVE_OK;
    c.repetir = CLAVE_OK;
    c.enviar();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok123', nueva_password: CLAVE_OK });
    req.flush({ message: 'ok' });
    fixture.detectChanges();
    expect(c.listo).toBe(true);
    expect(el.textContent).toContain('Ya puedes iniciar sesión');
    expect(el.querySelector('a[href="/login"]')).not.toBeNull();
    expect(c.nueva).toBe('');
  });

  it('si el enlace venció o ya se usó, lo dice y ofrece pedir otro', () => {
    const { fixture, c, http, el } = crear();
    c.nueva = CLAVE_OK;
    c.repetir = CLAVE_OK;
    c.enviar();
    http.expectOne(URL).flush({ detail: 'El enlace no es válido o ya venció. Solicita uno nuevo.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(c.enlaceInvalido).toBe(true);
    expect(el.querySelector('a[href="/recuperar"]')).not.toBeNull();
  });

  it('muestra el motivo si el servidor rechaza la contraseña, sin perder lo escrito', () => {
    const { fixture, c, http, el } = crear();
    c.nueva = CLAVE_OK;
    c.repetir = CLAVE_OK;
    c.enviar();
    http.expectOne(URL).flush({ detail: 'La contraseña debe tener al menos 8 caracteres.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(c.enlaceInvalido).toBe(false);
    expect(el.querySelector('.rp-error')?.textContent).toContain('al menos 8 caracteres');
    expect(c.nueva).toBe(CLAVE_OK);
  });

  it('el botón de mostrar contraseña es un botón real con nombre accesible', () => {
    const { fixture, el } = crear();
    const ojo = () => el.querySelector('button.rp-ojo') as HTMLButtonElement;
    expect(ojo().getAttribute('aria-label')).toBe('Mostrar contraseña');
    ojo().click();
    fixture.detectChanges();
    expect(ojo().getAttribute('aria-label')).toBe('Ocultar contraseña');
    expect((el.querySelector('#rp-nueva') as HTMLInputElement).type).toBe('text');
  });
});
