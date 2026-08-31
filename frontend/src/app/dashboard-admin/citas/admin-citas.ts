import { Component, EventEmitter, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../config';

const API = environment.apiUrl;

/**
 * Fase 3.4B — extracción de la sección "Gestión de Citas" del dashboard-admin.
 *
 * Este componente es dueño de su propio listado, filtros, paginación y carga
 * de datos (exclusivos de Citas, sin uso en ninguna otra sección del shell).
 *
 * Las acciones que también son usadas por otras secciones del dashboard
 * (ver detalle de cita, marcar/quitar prioridad urgente, cancelar cita)
 * NO se implementan aquí: se comunican al shell (DashboardAdminComponent)
 * mediante Outputs, porque el shell sigue siendo responsable de ellas
 * (modal de detalle compartido con Historial, actualización de
 * proximasCitas/citasHorario usados en Inicio y Horario).
 */
@Component({
  selector: 'app-admin-citas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-citas.html'
})
export class AdminCitasComponent implements OnInit {

  @Output() verDetalle = new EventEmitter<any>();
  @Output() marcarPrioridad = new EventEmitter<{ cita: any; urgente: boolean }>();
  @Output() cancelarCita = new EventEmitter<any>();
  @Output() irAHorario = new EventEmitter<void>();

  citasAdmin: any[] = [];
  pagCitas = 1;
  citasFiltroEstudiante = '';
  citasFiltroRango = 'todas';   // 'todas' | 'hoy' | 'semana'
  citasFiltroEstado = '';
  citasFiltroPrioridad = '';    // '' | 'urgente' | 'normal'
  citasCargando = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.cargarCitas();
  }

  cargarCitas(): void {
    this.citasCargando = true;
    let url = `${API}/admin/historial?`;
    if (this.citasFiltroEstudiante) url += `estudiante=${encodeURIComponent(this.citasFiltroEstudiante)}&`;
    if (this.citasFiltroEstado)     url += `estado=${this.citasFiltroEstado}&`;

    if (this.citasFiltroRango === 'hoy') {
      const hoy = new Date().toISOString().slice(0, 10);
      url += `fecha_inicio=${hoy}&fecha_fin=${hoy}&`;
    } else if (this.citasFiltroRango === 'semana') {
      const hoy = new Date();
      const fin = new Date(hoy); fin.setDate(hoy.getDate() + 7);
      url += `fecha_inicio=${hoy.toISOString().slice(0,10)}&fecha_fin=${fin.toISOString().slice(0,10)}&`;
    }

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.citasAdmin = data ?? []; this.pagCitas = 1; this.citasCargando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.citasCargando = false; }
    });
  }

  get citasFiltradas(): any[] {
    if (!this.citasFiltroPrioridad) return this.citasAdmin;
    const quiereUrgente = this.citasFiltroPrioridad === 'urgente';
    return this.citasAdmin.filter(c => !!c.urgente === quiereUrgente);
  }

  get citasPaginadas(): any[] {
    return this.citasFiltradas.slice((this.pagCitas - 1) * 8, this.pagCitas * 8);
  }

  getPaginasCitas(): number[] {
    const total = Math.ceil(this.citasFiltradas.length / 8);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  limpiarFiltrosCitas(): void {
    this.citasFiltroEstudiante = ''; this.citasFiltroRango = 'todas';
    this.citasFiltroEstado = ''; this.citasFiltroPrioridad = '';
    this.cargarCitas();
  }

  minVal(a: number, b: number): number { return Math.min(a, b); }

  // Permission esperado: agenda.gestionar
  // (documentado únicamente; el guard de permisos no se conecta en esta fase)

  onVerDetalle(cita: any): void {
    this.verDetalle.emit(cita);
  }

  onMarcarPrioridad(cita: any, urgente: boolean): void {
    this.marcarPrioridad.emit({ cita, urgente });
  }

  onCancelarCita(cita: any): void {
    this.cancelarCita.emit(cita);
  }

  onIrAHorario(): void {
    this.irAHorario.emit();
  }
}
