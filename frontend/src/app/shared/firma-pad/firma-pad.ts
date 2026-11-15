import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ajustarALimites, bytesDeDataUrl, cajaDeTinta, volverTransparenteElFondoClaro,
  FIRMA_MAX_ALTO, FIRMA_MAX_ANCHO, FIRMA_MAX_BYTES, FIRMA_MIN_ALTO, FIRMA_MIN_ANCHO,
} from './firma-pad.utils';

export type MetodoFirma = 'dibujada' | 'escrita' | 'subida';
export interface FirmaCapturada { imagen: string; metodo: MetodoFirma; }
type Pestana = 'dibujar' | 'escribir' | 'subir';

const LIENZO_ANCHO = 600;
const LIENZO_ALTO = 200;
const TINTA = '#111827';
const MAX_ARCHIVO_BYTES = 3 * 1024 * 1024;

/**
 * Captura de la firma manuscrita digitalizada del profesional, con tres
 * maneras: dibujarla, escribirla con letra manuscrita o subir una imagen.
 * Entrega siempre un PNG con fondo transparente, recortado al trazo, que es lo
 * único que acepta el backend. La imagen es una firma DIGITALIZADA, no una
 * firma electrónica avanzada con certificado.
 */
@Component({
  selector: 'app-firma-pad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './firma-pad.html',
  styleUrl: './firma-pad.css',
})
export class FirmaPadComponent implements AfterViewInit {

  @Input() guardando = false;
  @Input() nombreSugerido = '';
  @Output() guardar = new EventEmitter<FirmaCapturada>();
  @Output() cancelar = new EventEmitter<void>();

  @ViewChild('lienzo') private lienzoRef?: ElementRef<HTMLCanvasElement>;

  readonly pestanas: { id: Pestana; texto: string }[] = [
    { id: 'dibujar', texto: 'Dibujar' },
    { id: 'escribir', texto: 'Escribir' },
    { id: 'subir', texto: 'Subir firma' },
  ];
  readonly estilosEscritura = [
    { nombre: 'Cursiva fluida', familia: '"Segoe Script","Brush Script MT","Snell Roundhand","Apple Chancery",cursive' },
    { nombre: 'Cursiva clásica', familia: '"Lucida Handwriting","Apple Chancery","URW Chancery L",cursive' },
    { nombre: 'Trazo marcado', familia: '"Bradley Hand","Segoe Print","Comic Sans MS",cursive' },
  ];

  pestana: Pestana = 'dibujar';
  texto = '';
  estilo = 0;
  hayTrazo = false;
  archivoNombre = '';
  imagenSubida: string | null = null;     // vista previa ya limpia (PNG transparente)
  error = '';

  constructor(private cdr: ChangeDetectorRef) {}

  private dibujando = false;
  private ultimo: { x: number; y: number } | null = null;

  ngAfterViewInit(): void {
    this.texto = this.nombreSugerido;
    const lienzo = this.lienzoRef?.nativeElement;
    if (lienzo) {
      lienzo.width = LIENZO_ANCHO;
      lienzo.height = LIENZO_ALTO;
    }
  }

  elegirPestana(p: Pestana): void {
    this.pestana = p;
    this.error = '';
    this.cdr.markForCheck();
  }

  // ───────────── Dibujar ─────────────
  private ctx(): CanvasRenderingContext2D | null {
    return this.lienzoRef?.nativeElement.getContext('2d') ?? null;
  }

  private punto(e: PointerEvent): { x: number; y: number } {
    const lienzo = this.lienzoRef!.nativeElement;
    const r = lienzo.getBoundingClientRect();
    const ancho = r.width || LIENZO_ANCHO;
    const alto = r.height || LIENZO_ALTO;
    return { x: (e.clientX - r.left) * (lienzo.width / ancho), y: (e.clientY - r.top) * (lienzo.height / alto) };
  }

  empezarTrazo(e: PointerEvent): void {
    const ctx = this.ctx();
    if (!ctx) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.dibujando = true;
    this.ultimo = this.punto(e);
    ctx.fillStyle = TINTA;
    ctx.beginPath();
    ctx.arc(this.ultimo.x, this.ultimo.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
    this.hayTrazo = true;
    this.error = '';
    this.cdr.markForCheck();
  }

  moverTrazo(e: PointerEvent): void {
    if (!this.dibujando || !this.ultimo) return;
    const ctx = this.ctx();
    if (!ctx) return;
    const p = this.punto(e);
    ctx.strokeStyle = TINTA;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.ultimo.x, this.ultimo.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    this.ultimo = p;
  }

  terminarTrazo(): void {
    this.dibujando = false;
    this.ultimo = null;
  }

  borrar(): void {
    const lienzo = this.lienzoRef?.nativeElement;
    this.ctx()?.clearRect(0, 0, lienzo?.width ?? LIENZO_ANCHO, lienzo?.height ?? LIENZO_ALTO);
    this.hayTrazo = false;
    this.error = '';
    this.cdr.markForCheck();
  }

  // ───────────── Escribir ─────────────
  private imagenDeTexto(): string | null {
    const nombre = this.texto.trim();
    if (!nombre) return null;
    const medidor = document.createElement('canvas').getContext('2d');
    if (!medidor) return null;
    const fuente = `italic 64px ${this.estilosEscritura[this.estilo].familia}`;
    medidor.font = fuente;
    const ancho = Math.min(FIRMA_MAX_ANCHO, Math.ceil(medidor.measureText(nombre).width) + 60);
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(ancho, 120);
    lienzo.height = 130;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return null;
    ctx.font = fuente;
    ctx.fillStyle = TINTA;
    ctx.textBaseline = 'middle';
    ctx.fillText(nombre, 30, lienzo.height / 2, lienzo.width - 60);
    return this.exportar(lienzo);
  }

  // ───────────── Subir ─────────────
  alElegirArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    this.error = '';
    this.imagenSubida = null;
    this.archivoNombre = '';
    if (!archivo) return;
    if (!/^image\/(png|jpeg|webp)$/.test(archivo.type)) {
      this.error = 'Sube una imagen PNG, JPG o WEBP.';
      this.cdr.markForCheck();
      return;
    }
    if (archivo.size > MAX_ARCHIVO_BYTES) {
      this.error = 'La imagen pesa más de 3 MB. Sube una más liviana.';
      this.cdr.markForCheck();
      return;
    }
    this.archivoNombre = archivo.name;
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ajustado = ajustarALimites(img.naturalWidth, img.naturalHeight, 1000, 400);
      const lienzo = document.createElement('canvas');
      lienzo.width = ajustado.ancho;
      lienzo.height = ajustado.alto;
      const ctx = lienzo.getContext('2d', { willReadFrequently: true });
      if (!ctx) { this.error = 'Tu navegador no puede procesar la imagen.'; return; }
      ctx.drawImage(img, 0, 0, ajustado.ancho, ajustado.alto);
      const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
      volverTransparenteElFondoClaro(datos.data);
      ctx.putImageData(datos, 0, 0);
      const resultado = this.exportar(lienzo);
      if (resultado) this.imagenSubida = resultado;
      else this.error = 'No se distingue ninguna firma en la imagen. Prueba con una foto más nítida sobre fondo blanco.';
      this.cdr.markForCheck();
    };
    img.onerror = () => { URL.revokeObjectURL(url); this.error = 'No se pudo leer la imagen.'; this.cdr.markForCheck(); };
    img.src = url;
  }

  // ───────────── Exportar ─────────────
  /** Recorta al trazo, reduce a los límites del backend y devuelve un PNG (data URL), o null si está en blanco. */
  private exportar(origen: HTMLCanvasElement): string | null {
    const ctx = origen.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const pixeles = ctx.getImageData(0, 0, origen.width, origen.height);
    const caja = cajaDeTinta(pixeles.data, origen.width, origen.height);
    if (!caja) return null;

    const margen = 8;
    const x0 = Math.max(0, caja.x - margen);
    const y0 = Math.max(0, caja.y - margen);
    const w0 = Math.min(origen.width - x0, caja.ancho + margen * 2);
    const h0 = Math.min(origen.height - y0, caja.alto + margen * 2);

    for (const factor of [1, 0.6, 0.35]) {
      const ajustado = ajustarALimites(w0 * factor, h0 * factor, FIRMA_MAX_ANCHO, FIRMA_MAX_ALTO);
      const destino = document.createElement('canvas');
      destino.width = Math.max(ajustado.ancho, FIRMA_MIN_ANCHO);
      destino.height = Math.max(ajustado.alto, FIRMA_MIN_ALTO);
      const dctx = destino.getContext('2d');
      if (!dctx) return null;
      const dx = Math.round((destino.width - ajustado.ancho) / 2);
      const dy = Math.round((destino.height - ajustado.alto) / 2);
      dctx.drawImage(origen, x0, y0, w0, h0, dx, dy, ajustado.ancho, ajustado.alto);
      const url = destino.toDataURL('image/png');
      if (bytesDeDataUrl(url) <= FIRMA_MAX_BYTES * 0.9) return url;
    }
    return null;
  }

  confirmar(): void {
    this.error = '';
    let imagen: string | null = null;
    let metodo: MetodoFirma = 'dibujada';
    if (this.pestana === 'dibujar') {
      imagen = this.hayTrazo && this.lienzoRef ? this.exportar(this.lienzoRef.nativeElement) : null;
      metodo = 'dibujada';
    } else if (this.pestana === 'escribir') {
      imagen = this.imagenDeTexto();
      metodo = 'escrita';
    } else {
      imagen = this.imagenSubida;
      metodo = 'subida';
    }
    if (!imagen) {
      this.error = this.pestana === 'dibujar' ? 'Dibuja tu firma en el recuadro antes de guardar.'
        : this.pestana === 'escribir' ? 'Escribe tu nombre para generar la firma.'
        : 'Sube una imagen de tu firma antes de guardar.';
      this.cdr.markForCheck();
      return;
    }
    this.guardar.emit({ imagen, metodo });
  }
}
