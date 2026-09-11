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
  templateUrl: './admin-horario.html',
  styleUrls: ['./admin-horario.css']
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

  @Input() citasHorario: any[] = [];
  @Input() diasCerrados: any[] = [];

  @Input() bloqueEstadoFn: (fecha: string, hora: string) => string =
    () => 'sin-datos';

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


  get tieneProfesionalSeleccionado(): boolean {
    return String(this.filtroProfesionalId ?? '').trim().length > 0;
  }

  private get fechasSemana(): Set<string> {
    return new Set((this.semanaActual ?? []).map(dia => String(dia?.fecha ?? '')));
  }

  private get citasSemana(): any[] {
    const fechas = this.fechasSemana;
    return (this.citasHorario ?? []).filter(cita => fechas.has(String(cita?.fecha ?? '')));
  }

  private esCitaOperativa(cita: any): boolean {
    const estado = String(cita?.estado ?? '').toLowerCase();
    return estado !== 'cancelada' && estado !== 'inasistencia';
  }

  get citasProgramadasSemana(): number | null {
    if (!this.tieneProfesionalSeleccionado) return null;
    return this.citasSemana.filter(cita => this.esCitaOperativa(cita)).length;
  }

  get atencionesRealizadasSemana(): number | null {
    if (!this.tieneProfesionalSeleccionado) return null;
    return this.citasSemana.filter(
      cita => String(cita?.estado ?? '').toLowerCase() === 'completada'
    ).length;
  }

  get sobrecuposSemana(): number | null {
    if (!this.tieneProfesionalSeleccionado) return null;
    return this.citasSemana.filter(
      cita => this.esCitaOperativa(cita) && !!cita?.sobrecupo
    ).length;
  }

  get urgenciasSemana(): number | null {
    if (!this.tieneProfesionalSeleccionado) return null;
    return this.citasSemana.filter(
      cita => this.esCitaOperativa(cita) && !!cita?.urgente
    ).length;
  }

  get bloqueosSemana(): number | null {
    if (!this.tieneProfesionalSeleccionado) return null;
    const fechas = this.fechasSemana;
    return new Set(
      (this.diasCerrados ?? [])
        .map(dia => String(dia?.fecha ?? ''))
        .filter(fecha => fechas.has(fecha))
    ).size;
  }

  get citasProgramadasDia(): number {
    return (this.citasDiaSeleccionado ?? []).filter(cita => this.esCitaOperativa(cita)).length;
  }

  get atencionesRealizadasDia(): number {
    return (this.citasDiaSeleccionado ?? []).filter(
      cita => String(cita?.estado ?? '').toLowerCase() === 'completada'
    ).length;
  }

  get sobrecuposDia(): number {
    return (this.citasDiaSeleccionado ?? []).filter(
      cita => this.esCitaOperativa(cita) && !!cita?.sobrecupo
    ).length;
  }

  get urgenciasDia(): number {
    return (this.citasDiaSeleccionado ?? []).filter(
      cita => this.esCitaOperativa(cita) && !!cita?.urgente
    ).length;
  }

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