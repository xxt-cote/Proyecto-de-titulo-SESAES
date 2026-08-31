import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PhotoCropperComponent } from '../../shared/photo-cropper/photo-cropper';
import { PhotoViewerComponent } from '../../shared/photo-viewer/photo-viewer';

/**
 * Fase 3.4D — extracción de la sección "Mi Perfil" del dashboard-admin.
 *
 * `configCentro` NO es exclusivo de esta vista (también lo usan el topbar,
 * Configuración → General e Inicio), así que DashboardAdminComponent sigue
 * siendo su dueño: este componente lo recibe por @Input (misma referencia,
 * sin clonar) y solo lee de él (nombre, correo, foto) o, en el caso puntual
 * de la foto recién recortada, lo muta directamente para preservar la
 * actualización en vivo que ya existía en el monolito (el topbar comparte
 * la misma instancia de objeto). El PATCH que confirma ese cambio en el
 * backend sigue disparándolo el shell.
 *
 * Estado exclusivo de Mi Perfil (formulario de edición, visibilidad de
 * contraseñas, selección/recorte de foto, lightbox) vive aquí. El guardado
 * real (PATCH /configuracion-centro y /configuracion-centro/cambiar-password)
 * permanece en el shell porque modifica configCentro, la fuente de verdad
 * compartida; este componente solo emite la intención mediante
 * `guardarPerfil` y expone `finalizarEdicion()` para que el shell restablezca
 * el estado de edición tras un guardado exitoso (vía @ViewChild).
 */
@Component({
  selector: 'app-admin-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, PhotoCropperComponent, PhotoViewerComponent],
  templateUrl: './admin-perfil.html'
})
export class AdminPerfilComponent implements OnChanges {

  // ── Dato recibido del shell (fuente de verdad: DashboardAdminComponent) ──
  @Input() configCentro: any = {};

  // ── Intención emitida al shell (el shell ejecuta el/los PATCH reales) ──
  @Output() guardarPerfil = new EventEmitter<{
    nombre_admin: string;
    foto_admin_url?: string;
    contrasena_actual: string;
    contrasena_nueva: string;
    contrasena_conf: string;
  }>();

  // ══════════════════════════════════════
  // FORMULARIO DE PERFIL (estado exclusivo/local)
  // ══════════════════════════════════════
  configPerfil: any = { nombre_admin: '', contrasena_actual: '', contrasena_nueva: '', contrasena_conf: '' };
  mostrarContrasenaActual = false;
  mostrarContrasenaaNueva  = false;
  mostrarContrasenaConf   = false;

  // Edición de Mi Perfil: campos bloqueados hasta presionar "Editar"
  adminPerfilEnEdicion = false;
  fotoAdminCambiada    = false;

  /**
   * Sincroniza configPerfil.nombre_admin cuando el shell recarga/reasigna
   * configCentro (cargarConfiguracionCentro reasigna la referencia en cada
   * GET exitoso). Reproduce exactamente lo que antes hacía
   * DashboardAdminComponent.cargarConfiguracionCentro() de forma directa.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['configCentro']) {
      this.configPerfil.nombre_admin = this.configCentro?.nombre_admin ?? '';
    }
  }

  habilitarEdicionPerfilAdmin(): void { this.adminPerfilEnEdicion = true; }

  cancelarEdicionPerfilAdmin(): void {
    this.adminPerfilEnEdicion = false;
    this.configPerfil.nombre_admin      = this.configCentro.nombre_admin || '';
    this.configPerfil.contrasena_actual = '';
    this.configPerfil.contrasena_nueva  = '';
    this.configPerfil.contrasena_conf   = '';
  }

  get perfilAdminModificado(): boolean {
    return this.configPerfil.nombre_admin !== (this.configCentro.nombre_admin || '')
        || !!this.configPerfil.contrasena_actual
        || !!this.configPerfil.contrasena_nueva
        || this.fotoAdminCambiada;
  }

  /** Emite la intención al shell; el shell ejecuta el/los PATCH reales. */
  guardarPerfilAdmin(): void {
    if (!this.perfilAdminModificado) return;
    this.guardarPerfil.emit({
      nombre_admin: this.configPerfil.nombre_admin,
      ...(this.configCentro.foto_admin_url ? { foto_admin_url: this.configCentro.foto_admin_url } : {}),
      contrasena_actual: this.configPerfil.contrasena_actual,
      contrasena_nueva: this.configPerfil.contrasena_nueva,
      contrasena_conf: this.configPerfil.contrasena_conf
    });
  }

  /**
   * Público: el shell lo invoca (vía @ViewChild) tras un guardado exitoso
   * para restablecer el estado de edición, que ahora vive en este hijo.
   * `limpiarPassword` distingue el caso en que también se cambió la
   * contraseña con éxito (se limpian los 3 campos), igual que hacía el
   * monolito.
   */
  finalizarEdicion(limpiarPassword: boolean): void {
    this.adminPerfilEnEdicion = false;
    this.fotoAdminCambiada = false;
    if (limpiarPassword) {
      this.configPerfil.contrasena_actual = '';
      this.configPerfil.contrasena_nueva  = '';
      this.configPerfil.contrasena_conf   = '';
    }
  }

  // ══════════════════════════════════════
  // FOTO (selección, recorte, visor ampliado — exclusivos de Mi Perfil)
  // ══════════════════════════════════════
  imagenParaRecortar: string | null = null;
  verFotoAmpliada = false;

  onFotoSeleccionada(event: any): void {
    if (!this.adminPerfilEnEdicion) return;
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagenParaRecortar = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Muta configCentro directamente (misma referencia recibida por @Input)
   * para preservar la actualización en vivo de la foto en el topbar, tal
   * como ocurría en el monolito. No dispara HTTP: el cambio se confirma
   * recién al presionar "Guardar cambios".
   */
  onFotoRecortada(dataUrl: string): void {
    this.configCentro.foto_admin_url = dataUrl;
    this.fotoAdminCambiada  = true;
    this.imagenParaRecortar = null;
  }

  // Mi Perfil es autoservicio del usuario autenticado: no hay Permission
  // administrativo asociado (documentado únicamente; sin permissionGuard).
}
