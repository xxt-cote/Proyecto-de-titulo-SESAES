import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { FirmaCapturada, FirmaPadComponent } from './firma-pad';

function crear() {
  const fixture = TestBed.createComponent(FirmaPadComponent);
  fixture.detectChanges();
  return { fixture, c: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('FirmaPadComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [FirmaPadComponent] }));

  it('ofrece las tres maneras de firmar, con Dibujar activa', () => {
    const { el } = crear();
    const pestanas = Array.from(el.querySelectorAll('[role="tab"]'));
    expect(pestanas.map(p => p.textContent?.trim())).toEqual(['Dibujar', 'Escribir', 'Subir firma']);
    expect(pestanas[0].getAttribute('aria-selected')).toBe('true');
    expect(pestanas[1].getAttribute('aria-selected')).toBe('false');
  });

  it('cambiar de pestaña muestra solo su panel y lo anuncia a los lectores de pantalla', () => {
    const { fixture, el } = crear();
    (el.querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    fixture.detectChanges();
    expect((el.querySelector('#fp-panel-escribir') as HTMLElement).hidden).toBe(false);
    expect((el.querySelector('#fp-panel-dibujar') as HTMLElement).hidden).toBe(true);
    expect(el.querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
  });

  it('el lienzo tiene una alternativa descrita para quien no puede dibujar', () => {
    const { el } = crear();
    expect(el.querySelector('canvas')?.getAttribute('aria-label')).toContain('pestaña Escribir');
  });

  it('guardar sin haber dibujado muestra un aviso y no emite nada', () => {
    const { fixture, c, el } = crear();
    const emitir = vi.fn();
    c.guardar.subscribe(emitir);
    c.confirmar();
    fixture.detectChanges();
    expect(emitir).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Dibuja tu firma');
  });

  it('en Escribir sin nombre pide escribirlo; en Subir sin imagen pide subirla', () => {
    const { fixture, c, el } = crear();
    c.texto = '   ';
    c.elegirPestana('escribir');
    c.confirmar();
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Escribe tu nombre');
    c.elegirPestana('subir');
    c.confirmar();
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Sube una imagen');
  });

  it('con una imagen ya subida emite la firma con el método "subida"', () => {
    const { c } = crear();
    const emitir = vi.fn<(f: FirmaCapturada) => void>();
    c.guardar.subscribe(emitir);
    c.elegirPestana('subir');
    c.imagenSubida = 'data:image/png;base64,AAAA';
    c.confirmar();
    expect(emitir).toHaveBeenCalledWith({ imagen: 'data:image/png;base64,AAAA', metodo: 'subida' });
  });

  it('rechaza archivos que no son imagen o pesan demasiado', () => {
    const { c } = crear();
    const evento = (archivo: File) => ({ target: { files: [archivo] } }) as unknown as Event;
    c.alElegirArchivo(evento(new File(['x'], 'doc.pdf', { type: 'application/pdf' })));
    expect(c.error).toContain('PNG, JPG o WEBP');
    const grande = new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' });
    c.alElegirArchivo(evento(grande));
    expect(c.error).toContain('3 MB');
    expect(c.imagenSubida).toBeNull();
  });

  it('cancelar avisa al padre y mientras se guarda los botones se bloquean', () => {
    const { fixture, c, el } = crear();
    const cancelar = vi.fn();
    c.cancelar.subscribe(cancelar);
    (el.querySelector('.fp-btn-sec.fp-btn-sec:last-of-type') as HTMLElement | null);
    const botones = Array.from(el.querySelectorAll('.fp-acciones .fp-btn')) as HTMLButtonElement[];
    botones[0].click();
    expect(cancelar).toHaveBeenCalled();
    c.guardando = true;
    fixture.detectChanges();
    expect(botones.every(b => b.disabled)).toBe(true);
    expect(botones[1].textContent).toContain('Guardando');
  });
});
