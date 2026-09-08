import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface HorarioBloqueClick {
  fecha: string;
  hora: string;
}

@Component({
  selector: 'app-admin-horario',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-horario.html'
})
export class AdminHorarioComponent {
  @Input() puedeGestionarAgenda = false;
  @Input() solicitudesHorarioAdmin: any[] = [];

  @Input() especialidades: string[] = [];
  @Input() profesionalesFiltrados: any[] = [];

  @Input() filtroEspecialidad = '';
  @Output() filtroEspecialidadChange = new EventEmitter<string>();

  @Input() filtroProfesionalId: string | number = '';
  @Output() filtroProfesionalIdChange = new EventEmitter<string | number>();

  @Input() profesionalActual: any = null;
  @Input() profesionalActualBloqueado = false;

  @Input() semanaActual: any[] = [];
  @Input() semanaLabel = '';
  @Input() horasGrilla: string[] = [];

  @Input() diaSeleccionado: string | null = null;
  @Output() diaSeleccionadoChange = new EventEmitter<string | null>();

  @Input() citasDiaSeleccionado: any[] = [];

  @Input() bloqueEstadoFn: (fecha: string, hora: string) => string =
    () => 'disponible';

  @Input() bloqueInfoFn: (fecha: string, hora: string) => string =
    () => '';

  @Input() formatearFechaFn: (fecha: string) => string =
    fecha => fecha;

  @Input() esFeriadoFn: (fecha: string | undefined) => boolean =
    () => false;

  @Input() nombreFeriadoFn: (fecha: string | undefined) => string =
    () => '';

  @Output() aprobarSolicitud = new EventEmitter<any>();
  @Output() rechazarSolicitud = new EventEmitter<any>();

  @Output() filtrar = new EventEmitter<void>();
  @Output() recargarHorario = new EventEmitter<void>();

  @Output() abrirNuevaCita = new EventEmitter<void>();
  @Output() imprimir = new EventEmitter<void>();

  @Output() anterior = new EventEmitter<void>();
  @Output() siguiente = new EventEmitter<void>();
  @Output() hoy = new EventEmitter<void>();

  @Output() bloqueClick = new EventEmitter<HorarioBloqueClick>();
  @Output() cancelarCita = new EventEmitter<any>();

  onAprobarSolicitud(solicitud: any): void {
    if (!this.puedeGestionarAgenda) return;
    this.aprobarSolicitud.emit(solicitud);
  }

  onRechazarSolicitud(solicitud: any): void {
    if (!this.puedeGestionarAgenda) return;
    this.rechazarSolicitud.emit(solicitud);
  }

  onAbrirNuevaCita(): void {
    if (!this.puedeGestionarAgenda) return;
    this.abrirNuevaCita.emit();
  }

  onCancelarCita(cita: any): void {
    if (!this.puedeGestionarAgenda) return;
    this.cancelarCita.emit(cita);
  }
}