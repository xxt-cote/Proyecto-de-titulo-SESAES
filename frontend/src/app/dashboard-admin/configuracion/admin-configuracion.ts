import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export type ConfigTab =
  | 'general'
  | 'citas'
  | 'horarios'
  | 'usuarios'
  | 'seguridad';

@Component({
  selector: 'app-admin-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-configuracion.html'
})
export class AdminConfiguracionComponent {
  @Input() configTabActiva: ConfigTab = 'general';
  @Output() configTabActivaChange = new EventEmitter<ConfigTab>();

  @Input() configCentro: any = {};
  @Input() centroEnEdicion = false;
  @Input() centroModificado = false;
  @Input() guardandoConfig = false;

  @Input() configCitas: any = {};
  @Input() guardandoConfigCitas = false;

  @Input() diasCerrados: any[] = [];
  @Input() nuevoDiaCerrado: { fecha: string; motivo: string } = {
    fecha: '',
    motivo: ''
  };
  @Input() creandoDiaCerrado = false;
  @Input() hoyISO = '';

  @Input() usuariosDelSistema: any[] = [];

  @Input() auditoria: any[] = [];
  @Input() auditFiltroDesde = '';
  @Output() auditFiltroDesdeChange = new EventEmitter<string>();

  @Input() auditFiltroHasta = '';
  @Output() auditFiltroHastaChange = new EventEmitter<string>();

  @Input() cargandoAuditoria = false;
  @Input() hayAuditoriaSeleccionada = false;
  @Input() auditoriaSeleccionada: any[] = [];
  @Input() todaAuditoriaSeleccionada = false;

  @Output() habilitarEdicionCentro = new EventEmitter<void>();
  @Output() cancelarEdicionCentro = new EventEmitter<void>();
  @Output() guardarInfoCentro = new EventEmitter<void>();

  @Output() guardarConfiguracionCitas = new EventEmitter<void>();

  @Output() crearDiaCerrado = new EventEmitter<void>();
  @Output() verCitasDiaCerrado = new EventEmitter<any>();
  @Output() reabrirDiaCerrado = new EventEmitter<any>();

  @Output() cargarAuditoria = new EventEmitter<void>();
  @Output() exportarAuditoriaExcel = new EventEmitter<void>();
  @Output() exportarAuditoriaPdf = new EventEmitter<void>();
  @Output() eliminarAuditoriaSeleccionada = new EventEmitter<void>();
  @Output() toggleSeleccionarTodaAuditoria = new EventEmitter<void>();

  cambiarTab(tab: ConfigTab): void {
    this.configTabActiva = tab;
    this.configTabActivaChange.emit(tab);
  }
}