import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../config';
import { FirmaCapturada, FirmaPadComponent } from '../../shared/firma-pad/firma-pad';

const API = environment.apiUrl;

export interface EstadoFirma {
  tiene_firma: boolean;
  metodo: 'dibujada' | 'escrita' | 'subida' | null;
  actualizada_en: string | null;
  imagen: string | null;
}

const NOMBRE_METODO: Record<string, string> = {
  dibujada: 'dibujada',
  escrita: 'escrita con letra manuscrita',
  subida: 'subida desde una imagen',
};

/**
 * "Mi firma": registro de la firma manuscrita digitalizada del profesional,
 * que se incorpora a sus recetas y justificativos. Se usa completa en Mi
 * perfil y en versión compacta dentro de "Completar atención".
 *
 * Es una imagen de la firma, NO una firma electrónica avanzada: el documento
 * se verifica por folio y QR. El texto de la pantalla lo dice de forma
 * explícita para no inducir a error.
 */
@Component({
  selector: 'app-mi-firma',
  standalone: true,
  imports: [CommonModule, FirmaPadComponent],
  templateUrl: './mi-firma.html',
  styleUrl: './mi-firma.css',
})
export class MiFirmaComponent implements OnInit {

  @Input({ required: true }) profId!: number;
  @Input() compacto = false;
  @Input() nombreSugerido = '';

  firma: EstadoFirma | null = null;
  cargando = true;
  errorCarga = false;
  editando = false;
  guardando = false;
  confirmandoEliminar = false;
  mensaje = '';
  error = '';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargar();
  }

  get tieneFirma(): boolean { return !!this.firma?.tiene_firma; }

  get metodoTexto(): string {
    return this.firma?.metodo ? (NOMBRE_METODO[this.firma.metodo] ?? this.firma.metodo) : '';
  }

  private url(): string { return `${API}/profesional/${this.profId}/firma`; }

  cargar(): void {
    if (!this.profId || this.profId <= 0) { this.cargando = false; return; }
    this.cargando = true;
    this.errorCarga = false;
    this.http.get<EstadoFirma>(this.url()).subscribe({
      next: f => { this.firma = f; this.cargando = false; this.cdr.markForCheck(); },
      error: () => { this.cargando = false; this.errorCarga = true; this.cdr.markForCheck(); },
    });
  }

  abrirEditor(): void {
    this.editando = true;
    this.mensaje = '';
    this.error = '';
    this.confirmandoEliminar = false;
    this.cdr.markForCheck();
  }

  cerrarEditor(): void { this.editando = false; this.cdr.markForCheck(); }

  guardar(captura: FirmaCapturada): void {
    this.guardando = true;
    this.error = '';
    this.http.put<EstadoFirma>(this.url(), captura).subscribe({
      next: f => {
        this.firma = f;
        this.guardando = false;
        this.editando = false;
        this.mensaje = 'Tu firma quedó registrada. Se incorporará a los documentos que emitas desde ahora.';
        this.cdr.markForCheck();
      },
      error: (e: HttpErrorResponse) => {
        this.guardando = false;
        this.error = typeof e.error?.detail === 'string' ? e.error.detail : 'No se pudo guardar la firma. Intenta de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }

  pedirEliminar(): void { this.confirmandoEliminar = true; this.mensaje = ''; this.error = ''; this.cdr.markForCheck(); }
  cancelarEliminar(): void { this.confirmandoEliminar = false; this.cdr.markForCheck(); }

  eliminar(): void {
    this.guardando = true;
    this.http.delete<EstadoFirma>(this.url()).subscribe({
      next: f => {
        this.firma = f;
        this.guardando = false;
        this.confirmandoEliminar = false;
        this.mensaje = 'Eliminaste tu firma. Los documentos ya emitidos no cambian.';
        this.cdr.markForCheck();
      },
      error: () => {
        this.guardando = false;
        this.error = 'No se pudo eliminar la firma. Intenta de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }
}
