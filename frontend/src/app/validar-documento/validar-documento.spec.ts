import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect } from 'vitest';

import { ValidarDocumentoComponent } from './validar-documento';
import { environment } from '../config';

function crear(codigoEnUrl: string | null) {
  TestBed.configureTestingModule({
    imports: [ValidarDocumentoComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => codigoEnUrl } } } },
    ],
  });
  const fixture: ComponentFixture<ValidarDocumentoComponent> = TestBed.createComponent(ValidarDocumentoComponent);
  const http = TestBed.inject(HttpTestingController);
  return { fixture, component: fixture.componentInstance, http };
}

describe('ValidarDocumentoComponent', () => {
  it('valida el código ingresado y muestra el documento válido', () => {
    const { fixture, component, http } = crear(null);
    fixture.detectChanges();

    component.onCodigoChange('ses-4k9p-72qx-m8td');
    expect(component.codigo).toBe('SES-4K9P-72QX-M8TD');
    component.validar();

    const req = http.expectOne(`${environment.apiUrl}/documentos/validar/SES-4K9P-72QX-M8TD`);
    req.flush({ valido: true, estado: 'vigente', tipo: 'Receta médica', emitido_por: 'Dra. Ana Pérez',
                fecha_emision: '2026-10-09', estudiante: 'Valentina T. S.' });
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Documento registrado y no anulado');
    expect(texto).toContain('Valentina T. S.');
    expect(texto).toContain('09 de octubre de 2026');
  });

  it('al abrir el QR (?codigo=) valida automáticamente', () => {
    const { component, http } = crear('SES-AAAA-BBBB-CCCC');
    component.ngOnInit();
    const req = http.expectOne(`${environment.apiUrl}/documentos/validar/SES-AAAA-BBBB-CCCC`);
    req.flush({ valido: false, estado: 'no_encontrado' });
    expect(component.titulo).toBe('Código no encontrado');
  });

  it('muestra aviso claro si se superó el límite de consultas', () => {
    const { component, http } = crear(null);
    component.codigo = 'SES-AAAA-BBBB-CCCC';
    component.validar();
    http.expectOne(() => true).flush({ detail: 'x' }, { status: 429, statusText: 'Too Many Requests' });
    expect(component.errorRed).toContain('demasiadas consultas');
  });

  it('extrae el código desde la URL del QR', () => {
    const { component } = crear(null);
    const extraer = (component as any).extraerCodigo.bind(component);
    expect(extraer('https://sesaes.cl/validar-documento?codigo=ses-1111-2222-3333')).toBe('SES-1111-2222-3333');
    expect(extraer(' ses-1111-2222-3333 ')).toBe('SES-1111-2222-3333');
  });

  it('consulta la fecha de ausencia y distingue autenticidad de una fecha no cubierta', () => {
    const { component, fixture, http } = crear(null);
    fixture.detectChanges();
    component.codigo = 'SES-AAAA-BBBB-CCCC';
    component.fechaConsulta = '2026-11-24';
    component.validar();
    http.expectOne(environment.apiUrl + '/documentos/validar/SES-AAAA-BBBB-CCCC?fecha=2026-11-24')
      .flush({ valido: true, estado: 'vigente', tipo: 'Justificativo médico',
        verificacion_uso: { estado: 'fuera_de_periodo', desde: '2026-11-19', hasta: '2026-11-23',
          fecha_consultada: '2026-11-24', apto_para_uso: false, mensaje: 'La fecha consultada no está cubierta por este justificativo.' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Documento registrado y no anulado');
    expect(fixture.nativeElement.textContent).toContain('no está cubierta');
    expect(fixture.nativeElement.querySelector('.vd-uso-rechazado')).toBeTruthy();
  });

  it('una receta vencida no se presenta como autorizada para usar ni ofrece elegir fecha pasada', () => {
    const { component, fixture, http } = crear(null);
    fixture.detectChanges();
    component.codigo = 'SES-AAAA-BBBB-CCCC';
    component.validar();
    http.expectOne(() => true).flush({ valido: true, estado: 'vigente', tipo: 'Receta médica',
      verificacion_uso: { estado: 'vencida', desde: '2026-11-19', hasta: '2026-11-23',
        fecha_consultada: '2026-11-24', apto_para_uso: false, mensaje: 'Fuera del período de uso indicado por el profesional.' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fuera del período');
    expect(fixture.nativeElement.querySelector('#vd-fecha')).toBeNull();
  });

  it('cambiar código limpia la fecha de la consulta anterior', () => {
    const { component } = crear(null);
    component.fechaConsulta = '2026-11-24';
    component.onCodigoChange('ses-nuevo');
    expect(component.fechaConsulta).toBe('');
    expect(component.resultado).toBeNull();
  });
});
