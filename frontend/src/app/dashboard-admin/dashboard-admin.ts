import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { environment } from '../config';
Chart.register(...registerables);


const API = environment.apiUrl;

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './dashboard-admin.html',
  styleUrl: './dashboard-admin.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardAdminComponent implements OnInit, AfterViewInit, OnDestroy {
sidebarMovilAbierta = false;

toggleSidebarMovil(): void {
  this.sidebarMovilAbierta = !this.sidebarMovilAbierta;
}
  seccionActiva = 'inicio';
  temaOscuro    = false;
  mensajeExito  = '';
  mensajeError  = '';

  get tituloSeccion(): string {
    const map: Record<string, string> = {
      inicio: 'Panel Administrativo SESAES', horario: 'Gestión de Agenda Semanal',
      profesional: 'Gestión de Profesionales', historial: 'Historial de Citas',
      configuracion: 'Configuración del Sistema'
    };
    return map[this.seccionActiva] ?? 'SESAES';
  }

  get subtituloSeccion(): string {
    const map: Record<string, string> = {
      inicio: 'Gestiona profesionales, horarios y reservas de bienestar estudiantil.',
      horario: 'Visualiza y administra la agenda semanal de cada profesional.',
      profesional: 'Administra el personal médico, psicólogos y especialistas del centro de salud.',
      historial: 'Consulta el registro histórico de todas las atenciones y servicios realizados.',
      configuracion: 'Configuración del perfil, información del centro y auditoría.'
    };
    return map[this.seccionActiva] ?? '';
  }

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const temaGuardado = localStorage.getItem('admin_tema_oscuro');
    if (temaGuardado === 'true') this.temaOscuro = true;
    this.cargarDatos();
    this.generarSemanaActual();
    this.generarCalendarioInicio();
  }

  cargarDatos(): void {
    this.cargarEstadisticas();
    this.cargarProximasCitas();
    this.cargarGraficoEspecialidad();
    this.cargarGraficoSemana();
    this.cargarProfesionales();
    this.cargarHistorial();
    this.cargarNotificaciones();
    this.cargarResumenDia();
    this.cargarActividadReciente();
    this.cargarConfiguracionCentro();
    this.cargarSolicitudesHorarioAdmin();
  }

  navegarA(seccion: string): void {
  this.seccionActiva = seccion;
  this.mensajeExito  = '';
  this.mensajeError  = '';
  this.notifPanelAbierto = false;
  this.sidebarMovilAbierta = false;   
  if (seccion === 'configuracion') { this.cargarAuditoria(); this.cargarConfiguracionCentro(); }
  if (seccion === 'inicio') {
    setTimeout(() => this.crearGraficos(), 0);
  }
}

  cerrarSesion(): void { localStorage.clear(); window.location.href = '/login'; }

  toggleTema(): void {
    this.temaOscuro = !this.temaOscuro;
    localStorage.setItem('admin_tema_oscuro', String(this.temaOscuro));
  }

  minVal(a: number, b: number): number { return Math.min(a, b); }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const diasN = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const d = new Date(anio, mes-1, dia);
    return `${diasN[d.getDay()]} ${dia} de ${meses[mes-1]}`;
  }

  private convertirA24h(hora: string): string {
    if (!hora) return '';
    if (!hora.includes('AM') && !hora.includes('PM')) return hora.substring(0,5);
    const [time, period] = hora.trim().split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // ══════════════════════════════════════
  // NOTIFICACIONES ADMIN — selección múltiple
  // ══════════════════════════════════════

  notificaciones: any[] = [];
  notifPanelAbierto     = false;
  notifNoLeidas         = 0;

  cargarNotificaciones(): void {
    this.http.get<any[]>(`${API}/admin/notificaciones`).subscribe({
      next: (data) => {
        this.notificaciones = (data ?? []).map(n => ({ ...n, seleccionada: false }));
        this.notifNoLeidas  = this.notificaciones.filter(n => !n.leida).length;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  toggleNotificaciones(): void { this.notifPanelAbierto = !this.notifPanelAbierto; }

  marcarLeida(n: any): void {
    if (n.leida) return;
    this.http.patch(`${API}/notificaciones/${n.id}/leer`, {}).subscribe({
      next: () => {
        n.leida = true;
        this.notifNoLeidas = Math.max(0, this.notifNoLeidas - 1);
        this.cdr.detectChanges();
      }
    });
  }

  marcarTodasLeidas(): void {
    const adminId = Number(localStorage.getItem('usuario_id')) || 11;
    this.http.patch(`${API}/notificaciones/leer-todas/${adminId}`, {}).subscribe({
      next: () => {
        this.notificaciones.forEach(n => n.leida = true);
        this.notifNoLeidas = 0;
        this.cdr.detectChanges();
      }
    });
  }

  get notifSeleccionadas(): any[] { return this.notificaciones.filter(n => n.seleccionada); }
  get hayNotifSeleccionadas(): boolean { return this.notifSeleccionadas.length > 0; }
  get todasNotifSeleccionadas(): boolean {
    return this.notificaciones.length > 0 && this.notificaciones.every(n => n.seleccionada);
  }

  toggleSeleccionarTodasNotif(): void {
    const nuevoValor = !this.todasNotifSeleccionadas;
    this.notificaciones.forEach(n => n.seleccionada = nuevoValor);
  }

  eliminarNotifSeleccionadas(): void {
    const seleccionadas = this.notifSeleccionadas;
    if (!seleccionadas.length) return;
    if (!confirm(`¿Eliminar ${seleccionadas.length} notificación(es) seleccionada(s)?`)) return;
    seleccionadas.forEach(n => {
      this.http.delete(`${API}/notificaciones/${n.id}`).subscribe({
        next: () => {
          if (!n.leida) this.notifNoLeidas = Math.max(0, this.notifNoLeidas - 1);
          this.notificaciones = this.notificaciones.filter(x => x.id !== n.id);
          this.cdr.detectChanges();
        },
        error: () => { this.mensajeError = 'No se pudo eliminar una de las notificaciones.'; setTimeout(() => this.mensajeError = '', 3000); }
      });
    });
  }

  // ══════════════════════════════════════
  // ESTADÍSTICAS
  // ══════════════════════════════════════

  estadisticas = { reservas_hoy: 0, profesionales_activos: 0, horas_disponibles: 0, urgentes: 0 };

  cargarEstadisticas(): void {
    this.http.get<any>(`${API}/admin/estadisticas`).subscribe({
      next: (data) => {
        this.estadisticas = data;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // ══════════════════════════════════════
  // DISPONIBILIDAD HOY
  // ══════════════════════════════════════

  resumenDia: any[] = [];

  cargarResumenDia(): void {
    this.http.get<any[]>(`${API}/admin/resumen-dia`).subscribe({
      next: (data) => {
        this.resumenDia = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  getIconoEstadoProf(estado: string): string {
    if (estado === 'activo') return '✅';
    if (estado === 'licencia') return '🔴';
    if (estado === 'inasistencia') return '⚠️';
    return '⚪';
  }

  // ══════════════════════════════════════
  // ACTIVIDAD RECIENTE
  // ══════════════════════════════════════

  actividadReciente: any[] = [];

  cargarActividadReciente(): void {
    this.http.get<any[]>(`${API}/admin/auditoria`).subscribe({
      next: (data) => {
        this.actividadReciente = (data ?? []).slice(0,5).map(a => ({
          mensaje: a.accion + (a.detalle ? ': ' + a.detalle : ''),
          tiempo:  this.tiempoRelativo(a.fecha),
          tipo:    this.tipoAuditoria(a.accion)
        }));
        this.cdr.detectChanges();
      },
      error: () => { this.actividadReciente = []; }
    });
  }

  private tiempoRelativo(fechaStr: string): string {
    if (!fechaStr) return '';
    const diff = Date.now() - new Date(fechaStr).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 1)  return 'Hace un momento';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24)  return `Hace ${h} h`;
    return `Hace ${Math.floor(h/24)} días`;
  }

  private tipoAuditoria(accion: string): string {
    if (!accion) return 'info';
    const a = accion.toLowerCase();
    if (a.includes('cancel')) return 'cancelacion';
    if (a.includes('complet')) return 'completada';
    return 'info';
  }

  // ══════════════════════════════════════
  // PRÓXIMAS CITAS
  // ══════════════════════════════════════

  proximasCitas: any[] = [];

  cargarProximasCitas(): void {
    this.http.get<any[]>(`${API}/admin/proximas-citas`).subscribe({
      next: (data) => {
        this.proximasCitas = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  marcarInasistencia(cita: any): void {
    if (!confirm(`¿Marcar inasistencia del estudiante ${cita.estudiante}?`)) return;
    this.http.patch(`${API}/admin/citas/${cita.id}/cancelar`, { motivo: 'inasistencia' }).subscribe({
      next: () => {
        this.proximasCitas = this.proximasCitas.filter(c => c.id !== cita.id);
        const citaH = this.citasHorario.find(c => c.id === cita.id);
        if (citaH) citaH.estado = 'inasistencia';
        this.mensajeExito = 'Inasistencia registrada.';
        setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'Error al registrar inasistencia.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  cancelarCitaAdmin(cita: any): void {
    if (!confirm(`¿Cancelar la cita de ${cita.estudiante}?`)) return;
    this.http.patch(`${API}/admin/citas/${cita.id}/cancelar`, { motivo: 'Cancelada por administrador' }).subscribe({
      next: () => {
        this.proximasCitas = this.proximasCitas.filter(c => c.id !== cita.id);
        // Se actualiza el estado en el mismo lugar (no se elimina), para que el panel
        // de Horario siga mostrando la cita con su estado real en vez de hacerla desaparecer.
        const citaH = this.citasHorario.find(c => c.id === cita.id);
        if (citaH) citaH.estado = 'cancelada';
        this.mensajeExito = 'Cita cancelada. El estudiante fue notificado.';
        setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'Error al cancelar cita.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  // ══════════════════════════════════════
  // GRÁFICOS
  // ══════════════════════════════════════

  @ViewChild('chartEspecialidad') chartEspecialidadRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartSemana') chartSemanaRef!: ElementRef<HTMLCanvasElement>;
  private chartEspecialidad?: Chart;
  private chartSemana?: Chart;

  readonly coloresGrafico = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#8b5cf6', '#64748b'];

  graficoEspecialidad: any[] = [];
  graficoSemana:       any[] = [];
  filtroGraficoMes          = '';
  filtroGraficoAnio         = new Date().getFullYear();
  filtroGraficoCarrera      = '';

  readonly meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  get aniosDisponiblesGrafico(): number[] {
    const actual = new Date().getFullYear();
    const anios: number[] = [];
    for (let a = actual + 1; a >= actual - 3; a--) anios.push(a);
    return anios;
  }

  ngAfterViewInit(): void {
    this.crearGraficos();
  }

  ngOnDestroy(): void {
    this.chartEspecialidad?.destroy();
    this.chartSemana?.destroy();
  }

private crearGraficos(): void {
    this.chartEspecialidad?.destroy();
    this.chartSemana?.destroy();

    if (this.chartEspecialidadRef) {
      this.chartEspecialidad = new Chart(this.chartEspecialidadRef.nativeElement, {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: this.coloresGrafico, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    }
    if (this.chartSemanaRef) {
      this.chartSemana = new Chart(this.chartSemanaRef.nativeElement, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.1)', fill: true, tension: 0.3, pointRadius: 3 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    this.actualizarGraficoEspecialidad();
    this.actualizarGraficoSemana();
}

  private actualizarGraficoEspecialidad(): void {
    if (!this.chartEspecialidad) return;
    this.chartEspecialidad.data.labels = this.graficoEspecialidad.map(d => d.especialidad);
    this.chartEspecialidad.data.datasets[0].data = this.graficoEspecialidad.map(d => d.cantidad);
    this.chartEspecialidad.update();
  }

  private actualizarGraficoSemana(): void {
    if (!this.chartSemana) return;
    this.chartSemana.data.labels = this.graficoSemana.map(d => d.dia);
    this.chartSemana.data.datasets[0].data = this.graficoSemana.map(d => d.cantidad);
    this.chartSemana.update();
  }

  cargarGraficoEspecialidad(): void {
    let url = `${API}/admin/graficos/especialidad?anio=${this.filtroGraficoAnio}`;
    if (this.filtroGraficoMes)     url += `&mes=${this.filtroGraficoMes}`;
    if (this.filtroGraficoCarrera) url += `&carrera=${encodeURIComponent(this.filtroGraficoCarrera)}`;
    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.graficoEspecialidad = data ?? [];
        this.actualizarGraficoEspecialidad();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  cargarGraficoSemana(): void {
    this.http.get<any[]>(`${API}/admin/graficos/semana`).subscribe({
      next: (data) => {
        this.graficoSemana = data ?? [];
        this.actualizarGraficoSemana();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  exportarEspecialidadExcel(): void {
    this.exportarComoExcel(this.graficoEspecialidad.map(d => ({
      Especialidad: d.especialidad, Cantidad: d.cantidad, Porcentaje: d.porcentaje + '%'
    })), 'citas_por_especialidad');
  }

  exportarSemanaExcel(): void {
    this.exportarComoExcel(this.graficoSemana.map(d => ({
      Día: d.dia, Fecha: d.fecha, Cantidad: d.cantidad
    })), 'citas_por_semana');
  }

  // ══════════════════════════════════════
  // EXPORTACIÓN CGR
  // ══════════════════════════════════════

  exportarCGR2025(): void { window.open(`${API}/admin/exportar/cgr?anio=2025`, '_blank'); }
  exportarCGR2026(): void { window.open(`${API}/admin/exportar/cgr?anio=2026&fecha_fin=2026-05-31`, '_blank'); }

  // Selector de año dinámico para CGR (reemplaza los botones fijos 2025/2026)
  cgrAnio     = new Date().getFullYear();
  cgrFechaFin = '';

  get cgrAniosDisponibles(): number[] {
    const actual = new Date().getFullYear();
    const anios: number[] = [];
    for (let a = actual + 1; a >= actual - 3; a--) anios.push(a);
    return anios;
  }

  exportarCGR(): void {
    let url = `${API}/admin/exportar/cgr?anio=${this.cgrAnio}`;
    if (this.cgrFechaFin) url += `&fecha_fin=${this.cgrFechaFin}`;
    window.open(url, '_blank');
  }
  exportarListadoAlumnos(): void { window.open(`${API}/admin/exportar/alumnos`, '_blank'); }

  // ══════════════════════════════════════
  // HORARIO
  // ══════════════════════════════════════

  semanaActual:    any[]         = [];
  diaSeleccionado: string | null = null;
  filtroProfesionalId            = '';
  filtroEspecialidad             = '';
  semanaLabel                    = '';
  modalCitaAbierto               = false;

  get horasGrilla(): string[] {
    const prof = this.profesionales.find(p => String(p.id) === String(this.filtroProfesionalId));
    const duracion = prof?.duracion_min || 60;
    const inicioStr = prof?.horario_inicio || '08:00';
    const finStr    = prof?.horario_fin    || '18:00';
    const [hIni, mIni] = inicioStr.split(':').map(Number);
    const [hFin, mFin] = finStr.split(':').map(Number);
    const horas: string[] = [];
    let minutos = hIni * 60 + mIni;
    const finMin = hFin * 60 + mFin;
    while (minutos < finMin) {
      const h = Math.floor(minutos / 60).toString().padStart(2,'0');
      const m = (minutos % 60).toString().padStart(2,'0');
      horas.push(`${h}:${m}`);
      minutos += duracion;
    }
    return horas;
  }

  // Profesional actualmente seleccionado en el filtro de Horario
  get profesionalActual(): any {
    return this.profesionales.find(p => String(p.id) === String(this.filtroProfesionalId)) ?? null;
  }

  // Si el profesional no está activo (licencia/inasistencia), su agenda entera se muestra bloqueada
  get profesionalActualBloqueado(): boolean {
    const p = this.profesionalActual;
    return !!p && p.estado && p.estado !== 'activo';
  }

  private citasHorario: any[] = [];

  busquedaEstudiante          = '';
  resultadosEstudiante: any[] = [];
  estudianteSeleccionado: any = null;
  buscandoEstudiante          = false;

  get profesionalesFiltrados(): any[] {
    return this.filtroEspecialidad
      ? this.profesionales.filter(p => p.especialidad === this.filtroEspecialidad)
      : this.profesionales;
  }

  filtrarProfesionales(): void { this.filtroProfesionalId = ''; this.diaSeleccionado = null; }

  cargarHorarioProfesional(): void {
    if (!this.filtroProfesionalId) return;
    this.http.get<any[]>(`${API}/profesional/${this.filtroProfesionalId}/citas`).subscribe({
      next: (data) => {
        this.citasHorario = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => { this.citasHorario = []; }
    });
  }

  // ══════════════════════════════════════
  // CALENDARIO DE INICIO (solo visual — mes completo, sin seleccion de dia)
  // ══════════════════════════════════════

  calMesVisible  = new Date().getMonth();
  calAnioVisible = new Date().getFullYear();
  calDiasMes: any[] = [];

  get calNombreMesVisible(): string {
    return `${this.meses[this.calMesVisible]} ${this.calAnioVisible}`;
  }

  generarCalendarioInicio(): void {
    const primerDia = new Date(this.calAnioVisible, this.calMesVisible, 1);
    const ultimoDia = new Date(this.calAnioVisible, this.calMesVisible + 1, 0);
    const hoy       = this.toDateStr(new Date());
    const offset    = (primerDia.getDay() + 6) % 7;
    const celdas: any[] = [];
    for (let i = 0; i < offset; i++) celdas.push(null);
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fechaStr = `${this.calAnioVisible}-${String(this.calMesVisible+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
      celdas.push({ num: dia, esHoy: fechaStr === hoy });
    }
    this.calDiasMes = celdas;
  }

  calMesAnterior(): void {
    this.calMesVisible--;
    if (this.calMesVisible < 0) { this.calMesVisible = 11; this.calAnioVisible--; }
    this.generarCalendarioInicio();
  }

  calMesSiguiente(): void {
    this.calMesVisible++;
    if (this.calMesVisible > 11) { this.calMesVisible = 0; this.calAnioVisible++; }
    this.generarCalendarioInicio();
  }

  generarSemanaActual(): void {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    this.buildSemana(lunes);
  }

  private buildSemana(lunes: Date): void {
    const nombres = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    const hoyStr  = this.toDateStr(new Date());
    this.semanaActual = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes); d.setDate(lunes.getDate() + i);
      const f = this.toDateStr(d);
      return { nombre: nombres[i], num: d.getDate(), fecha: f, esHoy: f === hoyStr };
    });
    const mesesN = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const [anio, mes] = this.semanaActual[0].fecha.split('-').map(Number);
    this.semanaLabel  = `${mesesN[mes-1]} ${anio}`;
  }

  private toDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  semanaAnterior(): void {
    const lunes = new Date(this.semanaActual[0].fecha); lunes.setDate(lunes.getDate() - 7);
    this.buildSemana(lunes); if (this.filtroProfesionalId) this.cargarHorarioProfesional();
  }

  semanaSiguiente(): void {
    const lunes = new Date(this.semanaActual[0].fecha); lunes.setDate(lunes.getDate() + 7);
    this.buildSemana(lunes); if (this.filtroProfesionalId) this.cargarHorarioProfesional();
  }

  irAHoy(): void { this.generarSemanaActual(); if (this.filtroProfesionalId) this.cargarHorarioProfesional(); }

// ¿La hora indicada cae dentro del horario de almuerzo del profesional actual?
  private esHoraDeAlmuerzo(hora: string): boolean {
    const prof = this.profesionalActual;
    if (!prof || !prof.hora_almuerzo_inicio || !prof.hora_almuerzo_fin) return false;
    const h = hora.substring(0, 5);
    return h >= prof.hora_almuerzo_inicio && h < prof.hora_almuerzo_fin;
  }

  getBloqueEstado(fecha: string, hora: string): string {
    if (this.profesionalActualBloqueado) return 'bloqueado';
    if (this.esHoraDeAlmuerzo(hora)) return 'bloqueado';
    const cita = this.citasHorario.find(c => {
      if (c.fecha !== fecha) return false;
      if (c.estado === 'cancelada' || c.estado === 'inasistencia') return false;
      return this.convertirA24h(c.hora) === hora.substring(0,5);
    });
    if (!cita) return 'disponible';
    if (cita.urgente) return 'urgente';
    return 'ocupado';
  }

  getBloqueInfo(fecha: string, hora: string): string {
    if (this.esHoraDeAlmuerzo(hora)) return 'Colación';
    const cita = this.citasHorario.find(c => {
      if (c.fecha !== fecha) return false;
      if (c.estado === 'cancelada' || c.estado === 'inasistencia') return false;
      return this.convertirA24h(c.hora) === hora.substring(0,5);
    });
    return cita ? cita.estudiante : '';
  }

  get citasDiaSeleccionado(): any[] {
    if (!this.diaSeleccionado) return [];
    return this.citasHorario.filter(c => c.fecha === this.diaSeleccionado);
  }

  clickBloque(fecha: string, hora: string): void {
    const estado = this.getBloqueEstado(fecha, hora);
    if (estado === 'bloqueado') return;
    this.diaSeleccionado = fecha;
    if (estado === 'disponible') {
      this.abrirModalNuevaCitaConFechaHora(fecha, hora);
    }
  }

  abrirModalNuevaCita(): void { this.abrirModalNuevaCitaConFechaHora(this.diaSeleccionado ?? '', ''); }

  abrirModalNuevaCitaConFechaHora(fecha: string, hora: string): void {
    if (this.profesionalActualBloqueado) return;
    this.nuevaCita = { fecha, hora, estudiante_id: null, profesional_id: Number(this.filtroProfesionalId), observaciones: '', urgente: false };
    this.busquedaEstudiante     = '';
    this.resultadosEstudiante   = [];
    this.estudianteSeleccionado = null;
    this.modalCitaAbierto       = true;
  }

  cerrarModalCita(): void {
    this.modalCitaAbierto = false;
    this.busquedaEstudiante = '';
    this.resultadosEstudiante = [];
    this.estudianteSeleccionado = null;
  }

  nuevaCita: any = { fecha: '', hora: '', estudiante_id: null, profesional_id: null, observaciones: '', urgente: false };

  buscarEstudiante(): void {
    const q = this.busquedaEstudiante.trim();
    if (q.length < 2) { this.resultadosEstudiante = []; return; }
    this.buscandoEstudiante = true;
    this.http.get<any[]>(`${API}/admin/estudiantes?q=${encodeURIComponent(q)}`).subscribe({
      next: (data) => {
        this.resultadosEstudiante = data ?? [];
        this.buscandoEstudiante = false;
        this.cdr.detectChanges();
      },
      error: () => { this.resultadosEstudiante = []; this.buscandoEstudiante = false; this.cdr.detectChanges(); }
    });
  }

  seleccionarEstudiante(est: any): void {
    this.estudianteSeleccionado  = est;
    this.nuevaCita.estudiante_id = est.id;
    this.busquedaEstudiante      = est.nombre + ' — ' + est.rut;
    this.resultadosEstudiante    = [];
  }

  crearCitaDesdeHorario(): void {
    if (!this.nuevaCita.estudiante_id) {
      this.mensajeError = 'Debes seleccionar un estudiante.';
      setTimeout(() => this.mensajeError = '', 3000); return;
    }
    const endpoint = this.nuevaCita.urgente ? `${API}/admin/citas/urgente` : `${API}/citas`;
    this.http.post<any>(endpoint, {
      estudiante_id: this.nuevaCita.estudiante_id, profesional_id: this.nuevaCita.profesional_id,
      fecha: this.nuevaCita.fecha, hora: this.nuevaCita.hora,
      observaciones: this.nuevaCita.observaciones, urgente: this.nuevaCita.urgente
    }).subscribe({
      next: () => {
        this.cerrarModalCita(); this.cargarHorarioProfesional();
        this.mensajeExito = 'Cita creada correctamente.';
        setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: (err) => { this.mensajeError = err?.error?.detail || 'No se pudo crear la cita.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  imprimirAgenda(): void {
    const grilla = document.querySelector('.horario-card') as HTMLElement;
    if (!grilla) { window.print(); return; }
    const contenido = grilla.innerHTML;
    const ventana = window.open('', '_blank');
    if (ventana) {
      ventana.document.write(`<html><head><title>Agenda</title>
        <style>body{font-family:sans-serif;font-size:11px;} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccc;padding:4px;}</style>
        </head><body>${contenido}</body></html>`);
      ventana.document.close();
      ventana.print();
    }
  }
 // ══════════════════════════════════════
  // SOLICITUDES DE HORARIO (colación y jornada)
  // ══════════════════════════════════════

  solicitudesHorarioAdmin: any[] = [];

  cargarSolicitudesHorarioAdmin(): void {
    this.http.get<any[]>(`${API}/admin/solicitudes-horario?estado=pendiente`).subscribe({
      next: (data) => {
        this.solicitudesHorarioAdmin = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  aprobarSolicitudHorario(s: any): void {
    this.http.patch(`${API}/admin/solicitudes-horario/${s.id}/aprobar`, {}).subscribe({
      next: () => {
        this.solicitudesHorarioAdmin = this.solicitudesHorarioAdmin.filter(x => x.id !== s.id);
        this.cargarProfesionales();
        if (this.filtroProfesionalId) this.cargarHorarioProfesional();
        this.mensajeExito = `Solicitud de ${s.profesional_nombre} aprobada.`;
        setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.mensajeError = err?.error?.detail || 'No se pudo aprobar la solicitud.';
        setTimeout(() => this.mensajeError = '', 3000);
      }
    });
  }

  rechazarSolicitudHorario(s: any): void {
    const motivo = prompt('Motivo del rechazo (opcional):') || '';
    this.http.patch(`${API}/admin/solicitudes-horario/${s.id}/rechazar`, { motivo }).subscribe({
      next: () => {
        this.solicitudesHorarioAdmin = this.solicitudesHorarioAdmin.filter(x => x.id !== s.id);
        this.mensajeExito = `Solicitud de ${s.profesional_nombre} rechazada.`;
        setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.mensajeError = err?.error?.detail || 'No se pudo rechazar la solicitud.';
        setTimeout(() => this.mensajeError = '', 3000);
      }
    });
  }
  // ══════════════════════════════════════
  // PROFESIONALES
  // ══════════════════════════════════════

  profesionales:          any[] = [];
  busquedaProfesional           = '';
  pagProf                       = 1;
  modalProfAbierto              = false;
  modalAccionesAbierto          = false;
  profSeleccionado: any         = null;
  modoEdicion                   = false;
  mostrarConfirmacionProf       = false;
  profNuevoDatos: any           = { nombre:'', especialidad:'', especialidadNueva:'', correo:'', rut:'', estado:'activo', password:'prof123' };
  rutValido                     = true;
  correoValido                  = true;
  duracionNumero                = 45;
  duracionUnidad                = 'minutos';

  get duracionEnMinutos(): number {
    return this.duracionUnidad === 'horas' ? this.duracionNumero * 60 : this.duracionNumero;
  }

  // Especialidades dinámicas desde el backend
  get especialidades(): string[] {
    const fromProfs = this.profesionales.map(p => p.especialidad).filter(Boolean);
    const base = ['Medicina General','Psicología','Kinesiología','Odontología','Nutrición','Oftalmología','Psicopedagogía'];
    return Array.from(new Set([...base, ...fromProfs]));
  }

  get profesionalesActivos(): number { return this.profesionales.filter(p => p.estado === 'activo').length; }
  get profesionalesConIncidencia(): number { return this.profesionales.filter(p => ['enfermo','inasistencia','licencia'].includes(p.estado)).length; }

  cargarProfesionales(): void {
    this.http.get<any[]>(`${API}/admin/profesionales`).subscribe({
      next: (data) => {
        this.profesionales = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  get profesionalesFiltradosBusqueda(): any[] {
    const q = this.busquedaProfesional.toLowerCase();
    return !q ? this.profesionales : this.profesionales.filter(p =>
      p.nombre.toLowerCase().includes(q) || p.especialidad.toLowerCase().includes(q)
    );
  }

  get profesionalesPaginados(): any[] {
    return this.profesionalesFiltradosBusqueda.slice((this.pagProf-1)*6, this.pagProf*6);
  }

  getPaginasProf(): number[] {
    const total = Math.ceil(this.profesionalesFiltradosBusqueda.length / 6);
    return Array.from({ length: total }, (_, i) => i+1);
  }

  abrirModalAgregar(): void {
    this.profNuevoDatos = { nombre:'', especialidad:'', especialidadNueva:'', correo:'', rut:'', estado:'activo', password:'prof123' };
    this.duracionNumero = 45; this.duracionUnidad = 'minutos';
    this.mostrarConfirmacionProf = false; this.rutValido = true; this.correoValido = true;
    this.modalProfAbierto = true; this.modoEdicion = false;
  }

  validarRut(rut: string): boolean {
    const rutLimpio = rut.replace(/\./g,'').replace(/-/g,'');
    if (rutLimpio.length < 2) return false;
    const cuerpo = rutLimpio.slice(0,-1); const dv = rutLimpio.slice(-1).toUpperCase();
    let suma = 0, multi = 2;
    for (let i = cuerpo.length-1; i >= 0; i--) { suma += parseInt(cuerpo[i]) * multi; multi = multi === 7 ? 2 : multi+1; }
    const dvEsperado = 11 - (suma % 11);
    const dvCalc = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : String(dvEsperado);
    return dv === dvCalc;
  }

  onRutChange(): void { this.rutValido = !this.profNuevoDatos.rut || this.validarRut(this.profNuevoDatos.rut); }
  onCorreoChange(): void { this.correoValido = !this.profNuevoDatos.correo || /^[a-zA-Z0-9._%+\-]+@utem\.cl$/.test(this.profNuevoDatos.correo); }

  continuarCrearProf(): void {
    if (!this.profNuevoDatos.nombre.trim()) { this.mensajeError = 'El nombre es obligatorio.'; setTimeout(() => this.mensajeError = '', 3000); return; }
    if (!this.profNuevoDatos.especialidad)  { this.mensajeError = 'Selecciona una especialidad.'; setTimeout(() => this.mensajeError = '', 3000); return; }
    if (!this.profNuevoDatos.correo.trim()) { this.mensajeError = 'El correo es obligatorio.'; setTimeout(() => this.mensajeError = '', 3000); return; }
    if (!this.correoValido) { this.mensajeError = 'El correo debe ser @utem.cl.'; setTimeout(() => this.mensajeError = '', 3000); return; }
    if (this.profNuevoDatos.rut && !this.rutValido) { this.mensajeError = 'El RUT ingresado no es válido.'; setTimeout(() => this.mensajeError = '', 3000); return; }
    this.mostrarConfirmacionProf = true;
  }

  volverFormProf(): void { this.mostrarConfirmacionProf = false; }

  confirmarCrearProf(): void {
    const especialidadFinal = this.profNuevoDatos.especialidad === 'otra' ? this.profNuevoDatos.especialidadNueva : this.profNuevoDatos.especialidad;
    this.http.post(`${API}/admin/profesionales`, {
      nombre: this.profNuevoDatos.nombre, especialidad: especialidadFinal,
      correo: this.profNuevoDatos.correo, rut: this.profNuevoDatos.rut,
      duracion_min: this.duracionEnMinutos, estado: 'activo', password: 'prof123'
    }).subscribe({
      next: () => {
        this.cerrarModal(); this.cargarProfesionales();
        this.mensajeExito = 'Profesional creado. Contraseña temporal: prof123';
        setTimeout(() => this.mensajeExito = '', 5000);
        this.cdr.detectChanges();
      },
      error: (err) => { this.mensajeError = err?.error?.detail || 'No se pudo crear el profesional.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  abrirModalAcciones(p: any): void {
    this.profSeleccionado = { ...p, nuevoEstado: p.estado, motivoCambio: '' };
    this.duracionNumero   = p.duracion_min <= 60 ? p.duracion_min : Math.round(p.duracion_min/60);
    this.duracionUnidad   = p.duracion_min > 60 ? 'horas' : 'minutos';
    this.modalAccionesAbierto = true;
  }

  cerrarModalAcciones(): void { this.modalAccionesAbierto = false; this.profSeleccionado = null; }

  get estadoCambioRequiereMotivo(): boolean {
    return this.profSeleccionado && ['licencia','inasistencia'].includes(this.profSeleccionado.nuevoEstado);
  }

  guardarEstadoProfesional(): void {
    if (!this.profSeleccionado) return;
    const cancelarCitas = ['licencia','inasistencia'].includes(this.profSeleccionado.nuevoEstado)
      ? confirm('¿Cancelar las citas de hoy y notificar estudiantes?') : false;
    this.http.patch(`${API}/admin/profesionales/${this.profSeleccionado.id}/estado`, {
      estado: this.profSeleccionado.nuevoEstado, motivo: this.profSeleccionado.motivoCambio || '',
      cancelar_citas: cancelarCitas
    }).subscribe({
      next: () => {
        this.cerrarModalAcciones(); this.cargarProfesionales();
        this.mensajeExito = 'Estado actualizado.'; setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'No se pudo actualizar el estado.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  guardarDuracionProfesional(): void {
    if (!this.profSeleccionado) return;
    this.http.patch(`${API}/admin/profesionales/${this.profSeleccionado.id}`, { duracion_min: this.duracionEnMinutos }).subscribe({
      next: () => {
        this.cargarProfesionales();
        this.mensajeExito = `Duración actualizada a ${this.duracionEnMinutos} min.`; setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'No se pudo actualizar la duración.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  eliminarProfesionalDesdeModal(): void {
    if (!this.profSeleccionado) return;
    if (!confirm(`¿Eliminar a ${this.profSeleccionado.nombre}?`)) return;
    if (!confirm('Se cancelarán TODAS sus citas pendientes y se notificará a los estudiantes. ¿Confirmar?')) return;
    this.http.delete(`${API}/admin/profesionales/${this.profSeleccionado.id}`).subscribe({
      next: () => {
        this.cerrarModalAcciones(); this.cargarProfesionales();
        this.mensajeExito = 'Profesional eliminado.'; setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'No se pudo eliminar.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  cerrarModal(): void { this.modalProfAbierto = false; this.mostrarConfirmacionProf = false; }
  abrirModalEditar(p: any): void { this.abrirModalAcciones(p); }
  guardarProfesional(): void {}
  eliminarProfesional(p: any): void { this.abrirModalAcciones(p); }

  // ══════════════════════════════════════
  // HISTORIAL
  // ══════════════════════════════════════

  historialAdmin:      any[] = [];
  pagHist                    = 1;
  histFiltroEstudiante       = '';
  histFiltroDesde            = '';
  histFiltroHasta            = '';
  histFiltroEspecialidad     = '';
  histFiltroEstado           = '';
  histFiltroCarrera          = '';
  estadisticasEstudiante: any = null;

  // Modal de detalle de cita (botón del ojo en la tabla de historial)
  modalDetalleCitaAbierto = false;
  citaDetalle: any = null;

  verDetalleCita(h: any): void {
    this.citaDetalle = h;
    this.modalDetalleCitaAbierto = true;
  }

  cerrarModalDetalleCita(): void {
    this.modalDetalleCitaAbierto = false;
    this.citaDetalle = null;
  }

  cargarHistorial(): void {
    let url = `${API}/admin/historial?`;
    if (this.histFiltroEstudiante)   url += `estudiante=${encodeURIComponent(this.histFiltroEstudiante)}&`;
    if (this.histFiltroDesde)        url += `fecha_inicio=${this.histFiltroDesde}&`;
    if (this.histFiltroHasta)        url += `fecha_fin=${this.histFiltroHasta}&`;
    if (this.histFiltroEspecialidad) url += `especialidad=${encodeURIComponent(this.histFiltroEspecialidad)}&`;
    if (this.histFiltroEstado)       url += `estado=${this.histFiltroEstado}&`;
    if (this.histFiltroCarrera)      url += `carrera=${encodeURIComponent(this.histFiltroCarrera)}&`;
    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.historialAdmin = data ?? []; this.pagHist = 1;
        if (this.histFiltroEstudiante.trim()) this.calcularEstadisticasEstudiante(this.historialAdmin);
        else this.estadisticasEstudiante = null;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  calcularEstadisticasEstudiante(citas: any[]): void {
    if (!citas.length) { this.estadisticasEstudiante = null; return; }
    this.estadisticasEstudiante = {
      nombre: citas[0]?.estudiante ?? this.histFiltroEstudiante,
      total: citas.length,
      completadas:   citas.filter(c => c.estado === 'completada').length,
      canceladas:    citas.filter(c => c.estado === 'cancelada').length,
      inasistencias: citas.filter(c => c.estado === 'inasistencia').length
    };
  }

  get historialPaginado(): any[] { return this.historialAdmin.slice((this.pagHist-1)*8, this.pagHist*8); }

  getPaginasHist(): number[] {
    const total = Math.ceil(this.historialAdmin.length / 8);
    return Array.from({ length: total }, (_, i) => i+1);
  }

  limpiarFiltrosHistorial(): void {
    this.histFiltroEstudiante = ''; this.histFiltroDesde = ''; this.histFiltroHasta = '';
    this.histFiltroEspecialidad = ''; this.histFiltroEstado = ''; this.histFiltroCarrera = '';
    this.estadisticasEstudiante = null; this.cargarHistorial();
  }

  descargarPdf(citaId: number): void { window.open(`${API}/citas/${citaId}/pdf`, '_blank'); }
  exportarHistorialPdf(): void { alert('Exportar PDF: pendiente.'); }

  exportarHistorialExcel(): void {
    this.exportarComoExcel(this.historialAdmin.map(h => ({
      Estudiante: h.estudiante, RUT: h.rut, Carrera: h.carrera,
      Especialidad: h.especialidad, Profesional: h.profesional,
      Fecha: h.fecha, Hora: h.hora, Estado: h.estado
    })), 'historial_citas');
  }

  // ══════════════════════════════════════
  // CONFIGURACIÓN
  // ══════════════════════════════════════

  configCentro: any = {
    nombre_centro: 'SESAES', direccion: 'José Pedro Alessandri 1200, Ñuñoa',
    telefono: '', correo_contacto: '', horario_atencion: 'Lunes a Viernes 08:00–18:00',
    nombre_admin: 'Admin SESAES', foto_admin_url: null
  };

  configPerfil: any = { nombre_admin: '', contrasena_actual: '', contrasena_nueva: '', contrasena_conf: '' };
  guardandoConfig         = false;
  mostrarContrasenaActual = false;
  mostrarContrasenaaNueva  = false;
  mostrarContrasenaConf   = false;

  // Edición de Perfil admin / Información del Centro: campos bloqueados hasta presionar "Editar"
  adminPerfilEnEdicion = false;
  centroEnEdicion      = false;
  fotoAdminCambiada    = false;
  configCentroOriginal: any = {};

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

  habilitarEdicionCentro(): void { this.centroEnEdicion = true; }

  cancelarEdicionCentro(): void {
    this.centroEnEdicion = false;
    this.configCentro.nombre_centro    = this.configCentroOriginal.nombre_centro;
    this.configCentro.telefono         = this.configCentroOriginal.telefono;
    this.configCentro.direccion        = this.configCentroOriginal.direccion;
    this.configCentro.correo_contacto  = this.configCentroOriginal.correo_contacto;
    this.configCentro.horario_atencion = this.configCentroOriginal.horario_atencion;
  }

  get centroModificado(): boolean {
    const o = this.configCentroOriginal;
    return this.configCentro.nombre_centro    !== o.nombre_centro
        || this.configCentro.telefono         !== o.telefono
        || this.configCentro.direccion        !== o.direccion
        || this.configCentro.correo_contacto  !== o.correo_contacto
        || this.configCentro.horario_atencion !== o.horario_atencion;
  }

  cargarConfiguracionCentro(): void {
    this.http.get<any>(`${API}/configuracion-centro`).subscribe({
      next: (data) => {
        this.configCentro = data ?? this.configCentro;
        this.configPerfil.nombre_admin = data?.nombre_admin ?? '';
        this.configCentroOriginal = {
          nombre_centro: this.configCentro.nombre_centro, telefono: this.configCentro.telefono,
          direccion: this.configCentro.direccion, correo_contacto: this.configCentro.correo_contacto,
          horario_atencion: this.configCentro.horario_atencion
        };
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  guardarInfoCentro(): void {
    if (!this.centroModificado) return;
    this.guardandoConfig = true;
    this.http.patch(`${API}/configuracion-centro`, {
      nombre_centro: this.configCentro.nombre_centro, direccion: this.configCentro.direccion,
      telefono: this.configCentro.telefono, correo_contacto: this.configCentro.correo_contacto,
      horario_atencion: this.configCentro.horario_atencion
    }).subscribe({
      next: () => {
        this.guardandoConfig = false;
        this.centroEnEdicion = false;
        this.configCentroOriginal = {
          nombre_centro: this.configCentro.nombre_centro, telefono: this.configCentro.telefono,
          direccion: this.configCentro.direccion, correo_contacto: this.configCentro.correo_contacto,
          horario_atencion: this.configCentro.horario_atencion
        };
        this.mensajeExito = 'Información del centro guardada.'; setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => { this.guardandoConfig = false; this.mensajeError = 'No se pudo guardar.'; setTimeout(() => this.mensajeError = '', 3000); this.cdr.detectChanges(); }
    });
  }

  guardarPerfilAdmin(): void {
    if (!this.perfilAdminModificado) return;
    const payloadCentro: any = { nombre_admin: this.configPerfil.nombre_admin };
    if (this.configCentro.foto_admin_url) payloadCentro.foto_admin_url = this.configCentro.foto_admin_url;
    this.http.patch(`${API}/configuracion-centro`, payloadCentro).subscribe({
      next: () => {
        this.configCentro.nombre_admin = this.configPerfil.nombre_admin;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
    if (this.configPerfil.contrasena_nueva) {
      if (this.configPerfil.contrasena_nueva !== this.configPerfil.contrasena_conf) {
        this.mensajeError = 'Las contraseñas nuevas no coinciden.'; setTimeout(() => this.mensajeError = '', 3000); return;
      }
      this.http.patch(`${API}/configuracion-centro/cambiar-password`, {
        contrasena_actual: this.configPerfil.contrasena_actual, contrasena_nueva: this.configPerfil.contrasena_nueva
      }).subscribe({
        next: () => {
  this.mensajeExito = 'Perfil y contraseña actualizados.';
  this.configPerfil.contrasena_actual = ''; this.configPerfil.contrasena_nueva = ''; this.configPerfil.contrasena_conf = '';
  this.adminPerfilEnEdicion = false;
  this.fotoAdminCambiada = false;
  setTimeout(() => this.mensajeExito = '', 3000);
  this.cdr.detectChanges();
},
        error: (err) => { this.mensajeError = err?.error?.detail || 'Contraseña actual incorrecta.'; setTimeout(() => this.mensajeError = '', 3000); this.cdr.detectChanges(); }
      });
  } else {
  this.adminPerfilEnEdicion = false;
  this.fotoAdminCambiada = false;
  this.mensajeExito = 'Perfil actualizado.'; setTimeout(() => this.mensajeExito = '', 3000);
  this.cdr.detectChanges();
}
  }

  onFotoSeleccionada(event: any): void {
    if (!this.adminPerfilEnEdicion) return;
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.configCentro.foto_admin_url = e.target.result;
      this.fotoAdminCambiada = true;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  // ══════════════════════════════════════
  // AUDITORÍA — selección múltiple
  // ══════════════════════════════════════

  auditoria: any[]  = [];
  auditFiltroDesde  = '';
  auditFiltroHasta  = '';
  cargandoAuditoria = false;

  cargarAuditoria(): void {
    this.cargandoAuditoria = true;
    let url = `${API}/admin/auditoria?`;
    if (this.auditFiltroDesde) url += `fecha_inicio=${this.auditFiltroDesde}&`;
    if (this.auditFiltroHasta) url += `fecha_fin=${this.auditFiltroHasta}&`;
    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.auditoria = (data ?? []).map(a => ({ ...a, seleccionada: false }));
        this.cargandoAuditoria = false;
        this.cdr.detectChanges();
      },
      error: () => { this.auditoria = []; this.cargandoAuditoria = false; this.cdr.detectChanges(); }
    });
  }

  eliminarAuditoria(id: number): void {
    this.http.delete(`${API}/admin/auditoria/${id}`).subscribe({
      next: () => {
        this.auditoria = this.auditoria.filter(a => a.id !== id);
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'No se pudo eliminar el registro.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  get auditoriaSeleccionada(): any[] { return this.auditoria.filter(a => a.seleccionada); }
  get hayAuditoriaSeleccionada(): boolean { return this.auditoriaSeleccionada.length > 0; }
  get todaAuditoriaSeleccionada(): boolean {
    return this.auditoria.length > 0 && this.auditoria.every(a => a.seleccionada);
  }

  toggleSeleccionarTodaAuditoria(): void {
    const nuevoValor = !this.todaAuditoriaSeleccionada;
    this.auditoria.forEach(a => a.seleccionada = nuevoValor);
  }

  eliminarAuditoriaSeleccionada(): void {
    const seleccionadas = this.auditoriaSeleccionada;
    if (!seleccionadas.length) return;
    if (!confirm(`¿Eliminar ${seleccionadas.length} registro(s) de auditoría seleccionados? Esta acción no se puede deshacer.`)) return;
    seleccionadas.forEach(a => {
      this.http.delete(`${API}/admin/auditoria/${a.id}`).subscribe({
        next: () => {
          this.auditoria = this.auditoria.filter(x => x.id !== a.id);
          this.cdr.detectChanges();
        },
        error: () => { this.mensajeError = 'No se pudo eliminar uno de los registros.'; setTimeout(() => this.mensajeError = '', 3000); }
      });
    });
  }

  exportarAuditoriaExcel(): void {
    this.exportarComoExcel(this.auditoria.map(a => ({
      'Fecha/Hora': a.fecha, Acción: a.accion, Detalle: a.detalle,
      Entidad: a.entidad, 'ID Entidad': a.entidad_id
    })), 'auditoria');
  }

  exportarAuditoriaPdf(): void { alert('Exportar PDF de auditoría: pendiente.'); }

  // ══════════════════════════════════════
  // UTILIDADES
  // ══════════════════════════════════════

  private exportarComoExcel(datos: any[], nombreArchivo: string): void {
    if (!datos.length) { alert('No hay datos para exportar.'); return; }
    const headers = Object.keys(datos[0]);
    const filas   = datos.map(fila => headers.map(h => fila[h] ?? '').join('\t'));
    const contenido = [headers.join('\t'), ...filas].join('\n');
    const blob = new Blob([contenido], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${nombreArchivo}_${new Date().toISOString().slice(0,10)}.xls`;
    a.click(); URL.revokeObjectURL(url);
  }
}