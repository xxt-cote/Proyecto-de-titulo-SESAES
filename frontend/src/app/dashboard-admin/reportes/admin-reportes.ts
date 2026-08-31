import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-reportes.html'
})
export class AdminReportesComponent {
  @Input() historialAdmin: any[] = [];
  @Input() graficoEspecialidad: any[] = [];
  @Input() profesionalesActivos = 0;
  @Input() urgentesPendientes = 0;

  @Output() exportarEspecialidadExcel = new EventEmitter<void>();
  @Output() irAHistorial = new EventEmitter<void>();

  get reporteCompletadas(): number {
    return this.historialAdmin.filter(h => h.estado === 'completada').length;
  }

  get reporteCanceladas(): number {
    return this.historialAdmin.filter(h => h.estado === 'cancelada').length;
  }

  get reportePendientes(): number {
    return this.historialAdmin.filter(h => h.estado === 'pendiente').length;
  }

  get reporteInasistencias(): number {
    return this.historialAdmin.filter(h => h.estado === 'inasistencia').length;
  }
}