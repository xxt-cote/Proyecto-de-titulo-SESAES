import { Component, OnInit, ViewChild, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config';
import { obtenerFeriado } from '../shared/feriados-chile';
import { ToastService } from '../shared/toast/toast.service';
import { AuthService } from '../auth.service';
import { Permission } from '../shared/auth/permission.model';
import { AdminCitasComponent } from './citas/admin-citas';
import { AdminProfesionalesComponent } from './profesionales/admin-profesionales';
import { AdminPerfilComponent } from './perfil/admin-perfil';
import { AdminHistorialComponent } from './historial/admin-historial';
import { AdminReportesComponent } from './reportes/admin-reportes';
import { AdminEstudiantesComponent } from './estudiantes/admin-estudiantes';
import { AdminInicioComponent } from './inicio/admin-inicio';
import { AdminHorarioComponent } from './horario/admin-horario';
import { AdminConfiguracionComponent, ConfigTab } from './configuracion/admin-configuracion';


const API = environment.apiUrl;

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, AdminCitasComponent, AdminProfesionalesComponent, AdminPerfilComponent, AdminHistorialComponent, AdminReportesComponent, AdminEstudiantesComponent, AdminInicioComponent, AdminHorarioComponent, AdminConfiguracionComponent],
  templateUrl: './dashboard-admin.html',
  styleUrl: './dashboard-admin.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardAdminComponent implements OnInit {
// Referencia al hijo para cerrar sus modales tras una operación CRUD exitosa
// (el estado de los modales vive en el hijo; el shell sigue ejecutando el HTTP).
@ViewChild(AdminProfesionalesComponent) adminProfesionalesRef?: AdminProfesionalesComponent;
// Referencia al hijo Mi Perfil: el shell la usa (Fase 3.4D) para restablecer
// el estado de edición del hijo tras un guardado exitoso, ya que ese estado
// (adminPerfilEnEdicion, fotoAdminCambiada, contraseñas) ahora vive allí.
@ViewChild(AdminPerfilComponent) adminPerfilRef?: AdminPerfilComponent;

sidebarMovilAbierta = false;

toggleSidebarMovil(): void {
  this.sidebarMovilAbierta = !this.sidebarMovilAbierta;
}
  seccionActiva = 'inicio';
  temaOscuro    = false;

  // mensajeExito / mensajeError quedan como getters/setters por compatibilidad
  // con el resto del código (decenas de lugares hacen "this.mensajeExito = '...'").
  // Al asignarles un valor, disparan automaticamente un toast -- asi no hubo
  // que reescribir cada uno de esos lugares uno por uno.
  private _mensajeExito = '';
  set mensajeExito(valor: string) { this._mensajeExito = valor; if (valor) this.toast.success(valor); }
  get mensajeExito(): string { return this._mensajeExito; }

  private _mensajeError = '';
  set mensajeError(valor: string) { this._mensajeError = valor; if (valor) this.toast.error(valor); }
  get mensajeError(): string { return this._mensajeError; }

  get tituloSeccion(): string {
    const map: Record<string, string> = {
      inicio: 'Panel Administrativo SESAES', horario: 'Agenda',
      citas: 'Gestión de Citas', profesional: 'Gestión de Profesionales',
      estudiantes: 'Estudiantes', historial: 'Historial de Atenciones',
      reportes: 'Reportes', configuracion: 'Configuración del Sistema',
      miperfil: 'Mi Perfil'
    };
    return map[this.seccionActiva] ?? 'SESAES';
  }

  get subtituloSeccion(): string {
    const map: Record<string, string> = {
      inicio: 'Gestiona profesionales, horarios y reservas de bienestar estudiantil.',
      horario: 'Controla cuándo puede atender cada profesional: disponibilidad, bloqueos y sobrecupos.',
      citas: 'Revisa, prioriza y cancela las citas agendadas en el centro.',
      profesional: 'Administra el personal médico, psicólogos y especialistas del centro de salud.',
      estudiantes: 'Consulta estudiantes por nombre, RUT o carrera y revisa su ficha.',
      historial: 'Consulta las atenciones que ya ocurrieron y exporta reportes para la CGR.',
      reportes: 'Analiza el funcionamiento del servicio: demanda, cancelaciones y prioridades.',
      configuracion: 'Reglas generales del sistema: citas, horarios, usuarios y seguridad.',
      miperfil: 'Tu información personal y credenciales de acceso.'
    };
    return map[this.seccionActiva] ?? '';
  }

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private auth: AuthService
  ) {}

  hasPermission(permission: Permission): boolean {
    return this.auth.hasPermission(permission);
  }

  get puedeExportarCgr(): boolean {
    return this.hasPermission('reportes.cgr.exportar');
  }

  get puedeConfigGeneral(): boolean {
    return this.hasPermission('configuracion.gestionar');
  }

  get puedeConfigCitas(): boolean {
    return this.hasPermission('configuracion.gestionar');
  }

  get puedeConfigHorarios(): boolean {
    return this.hasPermission('agenda.gestionar');
  }

  get puedeConfigUsuarios(): boolean {
    return this.hasPermission('usuarios.gestionar');
  }

  get puedeVerAuditoria(): boolean {
    return this.hasPermission('auditoria.ver');
  }

  get puedeGestionarAuditoria(): boolean {
    return this.hasPermission('auditoria.gestionar');
  }

  puedeAccederSeccion(seccion: string): boolean {
    switch (seccion) {
      case 'inicio':
      case 'miperfil':
        return true;
      case 'horario':
      case 'citas':
        return this.hasPermission('agenda.gestionar');
      case 'profesional':
        return this.hasPermission('profesionales.gestionar');
      case 'estudiantes':
        return this.hasPermission('usuarios.gestionar');
      case 'historial':
      case 'reportes':
        return this.hasPermission('reportes.ver');
      case 'configuracion':
        return (
          this.puedeConfigGeneral ||
          this.puedeConfigHorarios ||
          this.puedeConfigUsuarios ||
          this.puedeVerAuditoria
        );
      default:
        return false;
    }
  }

  puedeAccederTabConfig(tab: ConfigTab): boolean {
    switch (tab) {
      case 'general':
      case 'citas':
        return this.hasPermission('configuracion.gestionar');
      case 'horarios':
        return this.hasPermission('agenda.gestionar');
      case 'usuarios':
        return this.hasPermission('usuarios.gestionar');
      case 'seguridad':
        return this.hasPermission('auditoria.ver');
      default:
        return false;
    }
  }

  private asegurarTabConfigPermitida(): void {
    if (this.puedeAccederTabConfig(this.configTabActiva)) return;

    const primeraPermitida: ConfigTab | undefined = (
      ['general', 'citas', 'horarios', 'usuarios', 'seguridad'] as ConfigTab[]
    ).find(tab => this.puedeAccederTabConfig(tab));

    if (primeraPermitida) this.configTabActiva = primeraPermitida;
  }

  ngOnInit(): void {
    const temaGuardado = localStorage.getItem('admin_tema_oscuro');
    if (temaGuardado === 'true') this.temaOscuro = true;
    this.cargarDatos();
    this.generarSemanaActual();
  }

  cargarDatos(): void {
    if (this.hasPermission('reportes.ver')) {
      this.cargarEstadisticas();
      this.cargarGraficoEspecialidad();
      this.cargarGraficoSemana();
      this.cargarHistorial();
    }

    if (this.hasPermission('agenda.gestionar')) {
      this.cargarProximasCitas();
      this.cargarResumenDia();
      this.cargarSolicitudesHorarioAdmin();
      this.cargarDiasCerrados();
    }

    if (this.hasPermission('profesionales.gestionar')) {
      this.cargarProfesionales();
    }

    if (this.hasPermission('usuarios.gestionar')) {
      this.cargarNotificaciones();
    }

    if (this.hasPermission('auditoria.ver')) {
      this.cargarActividadReciente();
    }

    this.cargarConfiguracionCentro();
  }

  navegarA(seccion: string): void {
  if (!this.puedeAccederSeccion(seccion)) {
    this.toast.error('No tienes permisos para acceder a esta sección.');
    return;
  }

  this.seccionActiva = seccion;
  this.mensajeExito  = '';
  this.mensajeError  = '';
  this.notifPanelAbierto = false;
  this.sidebarMovilAbierta = false;
  this.busquedaGlobal = '';
  this.resultadosBusquedaGlobal = { profesionales: [], estudiantes: [] };

  if (seccion === 'configuracion') {
    this.asegurarTabConfigPermitida();
    if (this.puedeConfigGeneral) this.cargarConfiguracionCentro();
    if (this.puedeConfigCitas) this.cargarConfiguracionCitas();
    if (this.puedeConfigHorarios) this.cargarDiasCerrados();
    if (this.puedeVerAuditoria) this.cargarAuditoria();
  }

  if (seccion === 'estudiantes' && this.hasPermission('usuarios.gestionar')) {
    this.cargarEstudiantes();
  }

  if (seccion === 'reportes' && this.hasPermission('reportes.ver')) {
    this.cargarEstadisticas();
    this.cargarGraficoEspecialidad();
    this.cargarGraficoSemana();
    this.cargarHistorial();
  }

  if (seccion === 'miperfil') this.cargarConfiguracionCentro();
}

  // ══════════════════════════════════════
  // BÚSQUEDA GLOBAL (topbar)
  // ══════════════════════════════════════
  busquedaGlobal = '';
  resultadosBusquedaGlobal: { profesionales: any[]; estudiantes: any[] } = { profesionales: [], estudiantes: [] };
  buscandoGlobal = false;

  get hayResultadosBusquedaGlobal(): boolean {
    return this.resultadosBusquedaGlobal.profesionales.length > 0 || this.resultadosBusquedaGlobal.estudiantes.length > 0;
  }

  buscarGlobal(): void {
    const q = this.busquedaGlobal.trim().toLowerCase();
    if (q.length < 2) { this.resultadosBusquedaGlobal = { profesionales: [], estudiantes: [] }; return; }
    const profs = this.hasPermission('profesionales.gestionar')
      ? this.profesionales.filter(p =>
          p.nombre?.toLowerCase().includes(q) || p.especialidad?.toLowerCase().includes(q)
        ).slice(0, 5)
      : [];

    this.resultadosBusquedaGlobal = { profesionales: profs, estudiantes: [] };

    if (!this.hasPermission('usuarios.gestionar')) {
      this.buscandoGlobal = false;
      return;
    }

    this.buscandoGlobal = true;
    this.http.get<any[]>(`${API}/admin/estudiantes?q=${encodeURIComponent(q)}`).subscribe({
      next: (data) => {
        this.resultadosBusquedaGlobal = { profesionales: profs, estudiantes: (data ?? []).slice(0, 5) };
        this.buscandoGlobal = false;
        this.cdr.detectChanges();
      },
      error: () => { this.buscandoGlobal = false; }
    });
  }

  irAProfesionalDesdeBusqueda(p: any): void {
    if (!this.hasPermission('profesionales.gestionar')) return;
    this.busquedaGlobal = '';
    this.resultadosBusquedaGlobal = { profesionales: [], estudiantes: [] };
    this.navegarA('profesional');
    // La búsqueda local de la tabla ahora vive en AdminProfesionalesComponent;
    // se espera al próximo tick para que el *ngIf del hijo ya lo haya creado.
    setTimeout(() => {
      if (this.adminProfesionalesRef) this.adminProfesionalesRef.busquedaProfesional = p.nombre;
    }, 0);
  }

  irAEstudianteDesdeBusqueda(e: any): void {
    if (!this.hasPermission('usuarios.gestionar')) return;
    this.busquedaGlobal = '';
    this.resultadosBusquedaGlobal = { profesionales: [], estudiantes: [] };
    this.navegarA('estudiantes');
    setTimeout(() => this.verPerfilEstudianteAdmin(e), 0);
  }

  cerrarSesion(): void { this.auth.logout(); this.router.navigate(['/login']); }

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
    const usuarioId = this.auth.getUsuarioId();
    if (usuarioId === null) return;

    this.http.patch(`${API}/notificaciones/leer-todas/${usuarioId}`, {}).subscribe({
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

  marcarSeleccionadasLeidas(): void {
    const seleccionadas = this.notifSeleccionadas.filter(n => !n.leida);
    if (!seleccionadas.length) return;
    seleccionadas.forEach(n => {
      this.http.patch(`${API}/notificaciones/${n.id}/leer`, {}).subscribe({
        next: () => {
          n.leida = true;
          n.seleccionada = false;
          this.notifNoLeidas = Math.max(0, this.notifNoLeidas - 1);
          this.cdr.detectChanges();
        }
      });
    });
  }

  eliminarNotificacion(n: any): void {
    this.http.delete(`${API}/notificaciones/${n.id}`).subscribe({
      next: () => {
        this.notificaciones = this.notificaciones.filter(x => x.id !== n.id);
        this.cdr.detectChanges();
      }
    });
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
        error: (err) => { this.mensajeError = err?.error?.detail || 'No se pudo eliminar una de las notificaciones.'; setTimeout(() => this.mensajeError = '', 3000); }
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


  // ══════════════════════════════════════
  // ACTIVIDAD RECIENTE
  // ══════════════════════════════════════

  actividadReciente: any[] = [];

  cargarActividadReciente(): void {
    if (!this.hasPermission('auditoria.ver')) {
      this.actividadReciente = [];
      return;
    }

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
  // El shell conserva datos/HTTP/exportación porque graficoEspecialidad
  // también alimenta Reportes. La renderización Chart.js vive en Inicio.
  // ══════════════════════════════════════

  graficoEspecialidad: any[] = [];
  graficoSemana: any[] = [];
  filtroGraficoMes = '';
  filtroGraficoAnio = new Date().getFullYear();
  filtroGraficoCarrera = '';

  cargarGraficoEspecialidad(): void {
    let url = `${API}/admin/graficos/especialidad?anio=${this.filtroGraficoAnio}`;
    if (this.filtroGraficoMes) {
      url += `&mes=${this.filtroGraficoMes}`;
    }
    if (this.filtroGraficoCarrera) {
      url += `&carrera=${encodeURIComponent(this.filtroGraficoCarrera)}`;
    }

    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.graficoEspecialidad = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  cargarGraficoSemana(): void {
    this.http.get<any[]>(`${API}/admin/graficos/semana`).subscribe({
      next: (data) => {
        this.graficoSemana = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  exportarEspecialidadExcel(): void {
    this.exportarComoExcel(
      this.graficoEspecialidad.map(d => ({
        Especialidad: d.especialidad,
        Cantidad: d.cantidad,
        Porcentaje: d.porcentaje + '%'
      })),
      'citas_por_especialidad'
    );
  }

  exportarSemanaExcel(): void {
    this.exportarComoExcel(
      this.graficoSemana.map(d => ({
        Día: d.dia,
        Fecha: d.fecha,
        Cantidad: d.cantidad
      })),
      'citas_por_semana'
    );
  }
  // ══════════════════════════════════════
  // EXPORTACIÓN CGR
  // ══════════════════════════════════════

  exportarCGR2025(): void {
    if (!this.puedeExportarCgr) return;
    window.open(`${API}/admin/exportar/cgr?anio=2025`, '_blank');
  }

  exportarCGR2026(): void {
    if (!this.puedeExportarCgr) return;
    window.open(`${API}/admin/exportar/cgr?anio=2026&fecha_fin=2026-05-31`, '_blank');
  }

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
    if (!this.puedeExportarCgr) return;

    let url = `${API}/admin/exportar/cgr?anio=${this.cgrAnio}`;
    if (this.cgrFechaFin) url += `&fecha_fin=${this.cgrFechaFin}`;
    window.open(url, '_blank');
  }
  exportarListadoAlumnos(): void {
    if (!this.puedeExportarCgr) return;
    window.open(`${API}/admin/exportar/alumnos`, '_blank');
  }

  // ══════════════════════════════════════
  // HORARIO
  // ══════════════════════════════════════
  readonly horarioBloqueEstadoFn = (fecha: string, hora: string): string =>
    this.getBloqueEstado(fecha, hora);

  readonly horarioBloqueInfoFn = (fecha: string, hora: string): string =>
    this.getBloqueInfo(fecha, hora);

  readonly horarioFormatearFechaFn = (fecha: string): string =>
    this.formatearFecha(fecha);

  readonly horarioEsFeriadoFn = (fecha: string | undefined): boolean =>
    this.esFeriado(fecha);

  readonly horarioNombreFeriadoFn = (fecha: string | undefined): string =>
    this.nombreFeriado(fecha);

  semanaActual:    any[]         = [];
  diaSeleccionado: string | null = null;
  filtroProfesionalId            = '';
  filtroEspecialidad             = '';
  semanaLabel                    = '';
  modalCitaAbierto               = false;

  // Horario general de atención del centro — la grilla siempre muestra el
  // día completo, sin importar el horario particular de cada profesional.
  // Las horas fuera del horario propio del profesional se muestran en gris
  // (ver getBloqueEstado) pero el admin puede forzar una cita ahí igual,
  // quedando marcada como "sobrecupo".
  private readonly CENTRO_HORA_INICIO = '08:00';
  private readonly CENTRO_HORA_FIN    = '18:00';

  get horasGrilla(): string[] {
    const prof = this.profesionales.find(p => String(p.id) === String(this.filtroProfesionalId));
    const duracion = prof?.duracion_min || 60;
    const [hIni, mIni] = this.CENTRO_HORA_INICIO.split(':').map(Number);
    const [hFin, mFin] = this.CENTRO_HORA_FIN.split(':').map(Number);
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
    this.http.get<any[]>(`${API}/agenda/profesional/${this.filtroProfesionalId}/citas`).subscribe({
      next: (data) => {
        this.citasHorario = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => { this.citasHorario = []; }
    });
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

  // Convierte "YYYY-MM-DD" a Date usando la zona horaria LOCAL, no UTC.
  // new Date("YYYY-MM-DD") se interpreta como medianoche UTC y al convertir
  // a hora de Chile retrocede un día — por eso NUNCA se debe usar así.
  private parseDateStrLocal(fechaStr: string): Date {
    const [anio, mes, dia] = fechaStr.split('-').map(Number);
    return new Date(anio, mes - 1, dia);
  }

  semanaAnterior(): void {
    const lunes = this.parseDateStrLocal(this.semanaActual[0].fecha); lunes.setDate(lunes.getDate() - 7);
    this.buildSemana(lunes); if (this.filtroProfesionalId) this.cargarHorarioProfesional();
  }

  semanaSiguiente(): void {
    const lunes = this.parseDateStrLocal(this.semanaActual[0].fecha); lunes.setDate(lunes.getDate() + 7);
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

  // ¿La hora indicada cae fuera del horario declarado por el profesional?
  // (pero SÍ dentro del horario general del centro, por eso igual aparece
  // en la grilla — solo que en gris, y solo agendable por el admin como sobrecupo)
  private esFueraDeHorarioProfesional(hora: string): boolean {
    const prof = this.profesionalActual;
    if (!prof) return false;
    const inicio = prof.horario_inicio || this.CENTRO_HORA_INICIO;
    const fin    = prof.horario_fin    || this.CENTRO_HORA_FIN;
    const h = hora.substring(0, 5);
    return h < inicio || h >= fin;
  }

  private buscarCitaEnBloque(fecha: string, hora: string): any {
    return this.citasHorario.find(c => {
      if (c.fecha !== fecha) return false;
      if (c.estado === 'cancelada' || c.estado === 'inasistencia') return false;
      return this.convertirA24h(c.hora) === hora.substring(0,5);
    });
  }

  esDiaCerrado(fecha: string): boolean {
    return this.diasCerrados.some(d => d.fecha === fecha);
  }

  getBloqueEstado(fecha: string, hora: string): string {
    if (this.profesionalActualBloqueado) return 'bloqueado';
    if (this.esDiaCerrado(fecha)) return 'cerrado-centro';

    const cita = this.buscarCitaEnBloque(fecha, hora);
    if (cita) {
      if (cita.urgente)   return 'urgente';
      if (cita.sobrecupo) return 'sobrecupo';
      return 'ocupado';
    }

    if (this.esHoraDeAlmuerzo(hora))          return 'colacion';
    if (this.esFueraDeHorarioProfesional(hora)) return 'fuera-horario';
    return 'disponible';
  }

  getBloqueInfo(fecha: string, hora: string): string {
    if (this.esDiaCerrado(fecha)) return '';
    const cita = this.buscarCitaEnBloque(fecha, hora);
    if (cita) return cita.sobrecupo ? `${cita.estudiante} (Sobrecupo)` : cita.estudiante;
    if (this.esHoraDeAlmuerzo(hora)) return 'Colación';
    return '';
  }

  get citasDiaSeleccionado(): any[] {
    if (!this.diaSeleccionado) return [];
    return this.citasHorario.filter(c => c.fecha === this.diaSeleccionado);
  }

  // ══════════════════════════════════════
  // SOBRECUPO — forzar una cita fuera del horario habitual del profesional
  // ══════════════════════════════════════
  sobrecupoConfirmAbierto = false;
  sobrecupoPendiente: { fecha: string; hora: string; motivoTexto: string } | null = null;

  clickBloque(fecha: string, hora: string): void {
    const estado = this.getBloqueEstado(fecha, hora);
    if (estado === 'bloqueado' || estado === 'cerrado-centro') return;

    this.diaSeleccionado = fecha;

    if (estado === 'disponible') {
      this.abrirModalNuevaCitaConFechaHora(fecha, hora, false);
    } else if (estado === 'colacion' || estado === 'fuera-horario') {
      this.sobrecupoPendiente = {
        fecha, hora,
        motivoTexto: estado === 'colacion'
          ? 'la hora de colación de'
          : 'el horario habitual de'
      };
      this.sobrecupoConfirmAbierto = true;
    }
  }

  cancelarSobrecupo(): void {
    this.sobrecupoConfirmAbierto = false;
    this.sobrecupoPendiente = null;
  }

  confirmarSobrecupo(): void {
    if (!this.sobrecupoPendiente) return;
    const { fecha, hora } = this.sobrecupoPendiente;
    this.sobrecupoConfirmAbierto = false;
    this.sobrecupoPendiente = null;
    this.abrirModalNuevaCitaConFechaHora(fecha, hora, true);
  }

  abrirModalNuevaCita(): void { this.abrirModalNuevaCitaConFechaHora(this.diaSeleccionado ?? '', '', false); }

  abrirModalNuevaCitaConFechaHora(fecha: string, hora: string, esSobrecupo: boolean = false): void {
    if (this.profesionalActualBloqueado) return;
    this.nuevaCita = {
      fecha, hora, estudiante_id: null, profesional_id: Number(this.filtroProfesionalId),
      observaciones: '', urgente: false, sobrecupo: esSobrecupo
    };
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

  nuevaCita: any = { fecha: '', hora: '', estudiante_id: null, profesional_id: null, observaciones: '', urgente: false, sobrecupo: false };

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

  creandoCita = false;

  crearCitaDesdeHorario(): void {
    if (this.creandoCita) return; // evita doble envío por doble clic
    if (!this.nuevaCita.estudiante_id) {
      this.mensajeError = 'Debes seleccionar un estudiante.';
      setTimeout(() => this.mensajeError = '', 3000); return;
    }
    this.creandoCita = true;
    const endpoint = this.nuevaCita.urgente ? `${API}/admin/citas/urgente` : `${API}/citas`;
    this.http.post<any>(endpoint, {
      estudiante_id: this.nuevaCita.estudiante_id, profesional_id: this.nuevaCita.profesional_id,
      fecha: this.nuevaCita.fecha, hora: this.nuevaCita.hora,
      observaciones: this.nuevaCita.observaciones, urgente: this.nuevaCita.urgente,
      sobrecupo: this.nuevaCita.sobrecupo || false
    }).subscribe({
      next: () => {
        this.cerrarModalCita(); this.cargarHorarioProfesional();
        this.mensajeExito = 'Cita creada correctamente.';
        setTimeout(() => this.mensajeExito = '', 3000);
        this.creandoCita = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.mensajeError = err?.error?.detail || 'No se pudo crear la cita.';
        setTimeout(() => this.mensajeError = '', 3000);
        this.creandoCita = false;
        // Si alguien más tomó esa hora justo antes, refrescamos la grilla
        // para que la celda ya no aparezca como disponible.
        if (err?.status === 409) {
          this.cerrarModalCita();
          this.cargarHorarioProfesional();
        }
        this.cdr.detectChanges();
      }
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

  // profesionales[] sigue viviendo aquí: es la ÚNICA fuente de verdad,
  // compartida además por Inicio, Horario y Configuración (Fase 3.4A/3.4C).
  profesionales: any[] = [];

  // Especialidades dinámicas desde el backend (usadas también en Horario,
  // Historial y Reportes, no exclusivas de Gestión de Profesionales).
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

  // ══════════════════════════════════════
  // Handlers de los @Output de AdminProfesionalesComponent (Fase 3.4C).
  // El hijo NO ejecuta HTTP: solo emite la intención. El shell sigue siendo
  // quien llama al backend y actualiza profesionales[] (única fuente usada
  // también por Inicio/Horario/Configuración).
  // ══════════════════════════════════════

  onCrearProfesional(payload: any): void {
    this.http.post(`${API}/admin/profesionales`, payload).subscribe({
      next: () => {
        this.adminProfesionalesRef?.cerrarModal();
        this.cargarProfesionales();
        this.mensajeExito = 'Profesional creado. Contraseña temporal: prof123';
        setTimeout(() => this.mensajeExito = '', 5000);
        this.cdr.detectChanges();
      },
      error: (err) => { this.mensajeError = err?.error?.detail || 'No se pudo crear el profesional.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  onCambiarEstadoProfesional(payload: { profesional: any; nuevoEstado: string; motivo: string }): void {
    const cancelarCitas = ['licencia','inasistencia'].includes(payload.nuevoEstado)
      ? confirm('¿Cancelar las citas de hoy y notificar estudiantes?') : false;
    this.http.patch(`${API}/admin/profesionales/${payload.profesional.id}/estado`, {
      estado: payload.nuevoEstado, motivo: payload.motivo || '',
      cancelar_citas: cancelarCitas
    }).subscribe({
      next: () => {
        this.adminProfesionalesRef?.cerrarModalAcciones();
        this.cargarProfesionales();
        this.mensajeExito = 'Estado actualizado.'; setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'No se pudo actualizar el estado.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  onCambiarDuracionProfesional(payload: { profesional: any; duracionMin: number }): void {
    this.http.patch(`${API}/admin/profesionales/${payload.profesional.id}`, { duracion_min: payload.duracionMin }).subscribe({
      next: () => {
        this.cargarProfesionales();
        this.mensajeExito = `Duración actualizada a ${payload.duracionMin} min.`; setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'No se pudo actualizar la duración.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  onEliminarProfesional(p: any): void {
    if (!confirm(`¿Eliminar a ${p.nombre}?`)) return;
    if (!confirm('Se cancelarán TODAS sus citas pendientes y se notificará a los estudiantes. ¿Confirmar?')) return;
    this.http.delete(`${API}/admin/profesionales/${p.id}`).subscribe({
      next: () => {
        this.adminProfesionalesRef?.cerrarModalAcciones();
        this.cargarProfesionales();
        this.mensajeExito = 'Profesional eliminado.'; setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'No se pudo eliminar.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  // Restaura exactamente el feedback de validación que existía antes de la
  // extracción (Corrección previa a aprobación, Fase 3.4C): el hijo solo
  // valida y emite el mensaje; el shell sigue siendo dueño de mensajeError/toast.
  onErrorValidacionProfesional(mensaje: string): void {
    this.mensajeError = mensaje;
    setTimeout(() => this.mensajeError = '', 3000);
  }

  // ══════════════════════════════════════
  // HISTORIAL
  // ══════════════════════════════════════

  // ═══ CITAS ═══
  // El listado, filtros, paginación y carga de datos de esta sección viven
  // ahora en AdminCitasComponent (Fase 3.4B). Lo que permanece aquí son las
  // acciones compartidas con otras secciones del shell (Inicio, Horario,
  // Historial), comunicadas por AdminCitasComponent mediante Outputs.

  marcarPrioridadCita(cita: any, urgente: boolean): void {
    this.http.patch<any>(`${API}/admin/citas/${cita.id}/prioridad`, { urgente }).subscribe({
      next: (res) => {
        cita.urgente = res.urgente;
        this.toast.success(urgente ? 'Cita marcada como urgente' : 'Se quitó la prioridad urgente');
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('No se pudo cambiar la prioridad de la cita')
    });
  }

  // ═══ ESTUDIANTES (listado + ficha con historial) ═══
  estudiantesAdmin:      any[] = [];
  estudiantesTotal             = 0;
  estudiantesPagina            = 1;
  estudiantesPorPagina          = 20;
  estudiantesFiltroQ           = '';
  estudiantesFiltroCarrera     = '';
  estudiantesCargando           = false;

  modalPerfilEstudianteAbierto  = false;
  perfilEstudianteCargando      = false;
  fichaEstudianteSeleccionado: any   = null;

  cargarEstudiantes(): void {
    this.estudiantesCargando = true;
    let url = `${API}/admin/estudiantes/listado?pagina=${this.estudiantesPagina}&por_pagina=${this.estudiantesPorPagina}&`;
    if (this.estudiantesFiltroQ)       url += `q=${encodeURIComponent(this.estudiantesFiltroQ)}&`;
    if (this.estudiantesFiltroCarrera) url += `carrera=${encodeURIComponent(this.estudiantesFiltroCarrera)}&`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.estudiantesAdmin = res?.estudiantes ?? [];
        this.estudiantesTotal = res?.total ?? 0;
        this.estudiantesCargando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.estudiantesCargando = false; }
    });
  }

  buscarEstudiantesAdmin(): void { this.estudiantesPagina = 1; this.cargarEstudiantes(); }

  limpiarFiltrosEstudiantes(): void {
    this.estudiantesFiltroQ = ''; this.estudiantesFiltroCarrera = ''; this.estudiantesPagina = 1;
    this.cargarEstudiantes();
  }


  irAPaginaEstudiantes(pagina: number): void {
    this.estudiantesPagina = pagina;
    this.cargarEstudiantes();
  }

  verPerfilEstudianteAdmin(est: any): void {
    this.modalPerfilEstudianteAbierto = true;
    this.perfilEstudianteCargando = true;
    this.fichaEstudianteSeleccionado = null;
    this.http.get<any>(`${API}/admin/estudiantes/${est.id}/perfil`).subscribe({
      next: (data) => { this.fichaEstudianteSeleccionado = data; this.perfilEstudianteCargando = false; this.cdr.detectChanges(); },
      error: () => { this.perfilEstudianteCargando = false; this.toast.error('No se pudo cargar la ficha del estudiante'); }
    });
  }

  cerrarModalPerfilEstudiante(): void {
    this.modalPerfilEstudianteAbierto = false;
    this.fichaEstudianteSeleccionado = null;
  }

  historialAdmin:      any[] = [];
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
        this.historialAdmin = data ?? [];
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

  // ══════════════════════════════════════
  // CONFIGURACIÓN → tabs (General / Citas / Horarios / Usuarios y roles / Seguridad)
  // ══════════════════════════════════════
  configTabActiva: ConfigTab = 'general';

  cambiarTabConfig(tab: ConfigTab): void {
    if (!this.puedeAccederTabConfig(tab)) {
      this.toast.error('No tienes permisos para acceder a esta opción.');
      return;
    }

    this.configTabActiva = tab;

    if (tab === 'general') this.cargarConfiguracionCentro();
    if (tab === 'citas') this.cargarConfiguracionCitas();
    if (tab === 'horarios') this.cargarDiasCerrados();
    if (tab === 'seguridad') this.cargarAuditoria();
  }

  // Reglas de citas (endpoint ya existente en backend: /admin/configuracion)
  configCitas: any = {
    duracion_turno_min: 20, agendamiento_por_pacientes: true,
    cancelacion_instantanea: false, sobreturnos_habilitados: true, cupos_por_turno: 4
  };
  guardandoConfigCitas = false;

  cargarConfiguracionCitas(): void {
    if (!this.hasPermission('configuracion.gestionar')) return;

    this.http.get<any>(`${API}/admin/configuracion`).subscribe({
      next: (data) => { this.configCitas = data ?? this.configCitas; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  guardarConfiguracionCitas(): void {
    if (!this.hasPermission('configuracion.gestionar')) return;

    this.guardandoConfigCitas = true;
    this.http.patch(`${API}/admin/configuracion`, {
      duracion_turno_min: Number(this.configCitas.duracion_turno_min),
      agendamiento_por_pacientes: this.configCitas.agendamiento_por_pacientes,
      cancelacion_instantanea: this.configCitas.cancelacion_instantanea,
      sobreturnos_habilitados: this.configCitas.sobreturnos_habilitados,
      cupos_por_turno: Number(this.configCitas.cupos_por_turno)
    }).subscribe({
      next: () => {
        this.guardandoConfigCitas = false;
        this.mensajeExito = 'Reglas de citas guardadas.'; setTimeout(() => this.mensajeExito = '', 3000);
        this.cdr.detectChanges();
      },
      error: () => {
        this.guardandoConfigCitas = false;
        this.mensajeError = 'No se pudo guardar la configuración de citas.'; setTimeout(() => this.mensajeError = '', 3000);
        this.cdr.detectChanges();
      }
    });
  }

  // Usuarios y roles (informativo — lista real de profesionales + admin actual)
  get usuariosDelSistema(): any[] {
    const admin = [{ nombre: this.configCentro.nombre_admin || 'Admin SESAES', rol: 'Administrador', estado: 'activo' }];
    const profs = this.profesionales.map(p => ({ nombre: p.nombre, rol: 'Profesional — ' + p.especialidad, estado: p.estado }));
    return [...admin, ...profs];
  }

  guardandoConfig         = false;

  // Edición de Información del Centro: campos bloqueados hasta presionar "Editar"
  centroEnEdicion      = false;
  configCentroOriginal: any = {};

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
    if (!this.puedeConfigGeneral) return;
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

  // ══════════════════════════════════════
  // Handler del @Output de AdminPerfilComponent (Fase 3.4D).
  // El hijo NO ejecuta HTTP: solo emite la intención. El shell sigue siendo
  // quien llama al backend y actualiza configCentro (fuente de verdad
  // compartida también con topbar/Inicio/Configuración → General). Tras un
  // guardado exitoso, el shell usa @ViewChild para pedirle al hijo que
  // restablezca su propio estado de edición (que ahora vive allí).
  // Se preserva intencionalmente el comportamiento previo a la extracción:
  // el PATCH de configuracion-centro se dispara sin esperar la validación
  // de contraseña, que ocurre después.
  // ══════════════════════════════════════
  onGuardarPerfilAdmin(payload: {
    nombre_admin: string;
    foto_admin_url?: string;
    contrasena_actual: string;
    contrasena_nueva: string;
    contrasena_conf: string;
  }): void {
    const payloadCentro: any = { nombre_admin: payload.nombre_admin };
    if (payload.foto_admin_url) payloadCentro.foto_admin_url = payload.foto_admin_url;
    this.http.patch(`${API}/configuracion-centro`, payloadCentro).subscribe({
      next: () => {
        this.configCentro.nombre_admin = payload.nombre_admin;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
    if (payload.contrasena_nueva) {
      if (payload.contrasena_nueva !== payload.contrasena_conf) {
        this.mensajeError = 'Las contraseñas nuevas no coinciden.'; setTimeout(() => this.mensajeError = '', 3000); return;
      }
      this.http.patch(`${API}/configuracion-centro/cambiar-password`, {
        contrasena_actual: payload.contrasena_actual, contrasena_nueva: payload.contrasena_nueva
      }).subscribe({
        next: () => {
          this.mensajeExito = 'Perfil y contraseña actualizados.';
          this.adminPerfilRef?.finalizarEdicion(true);
          setTimeout(() => this.mensajeExito = '', 3000);
          this.cdr.detectChanges();
        },
        error: (err) => { this.mensajeError = err?.error?.detail || 'Contraseña actual incorrecta.'; setTimeout(() => this.mensajeError = '', 3000); this.cdr.detectChanges(); }
      });
    } else {
      this.adminPerfilRef?.finalizarEdicion(false);
      this.mensajeExito = 'Perfil actualizado.'; setTimeout(() => this.mensajeExito = '', 3000);
      this.cdr.detectChanges();
    }
  }

  esFeriado(fecha: string | undefined): boolean {
    return !!fecha && !!obtenerFeriado(fecha);
  }

  nombreFeriado(fecha: string | undefined): string {
    if (!fecha) return '';
    const f = obtenerFeriado(fecha);
    return f ? `Feriado: ${f.nombre}` : '';
  }

  // ══════════════════════════════════════
  // AUDITORÍA — selección múltiple
  // ══════════════════════════════════════

  auditoria: any[]  = [];
  auditFiltroDesde  = '';
  auditFiltroHasta  = '';
  cargandoAuditoria = false;

  // ══════════════════════════════════════
  // DÍAS CERRADOS (centro sin atención)
  // ══════════════════════════════════════
  diasCerrados: any[] = [];
  nuevoDiaCerrado: { fecha: string; motivo: string } = { fecha: '', motivo: '' };
  creandoDiaCerrado = false;
  modalCitasDiaCerradoAbierto = false;
  diaCerradoSeleccionado: any = null;
  citasDiaCerradoSeleccionado: any[] = [];
  cargandoCitasDiaCerrado = false;

  get hoyISO(): string { return new Date().toISOString().split('T')[0]; }

  cargarDiasCerrados(): void {
    this.http.get<any[]>(`${API}/admin/dias-cerrados`).subscribe({
      next: (data) => { this.diasCerrados = data ?? []; this.cdr.detectChanges(); },
      error: () => { this.diasCerrados = []; this.cdr.detectChanges(); }
    });
  }

  crearDiaCerrado(): void {
    if (!this.nuevoDiaCerrado.fecha || !this.nuevoDiaCerrado.motivo || this.creandoDiaCerrado) return;
    this.creandoDiaCerrado = true;
    this.http.post<any>(`${API}/admin/dias-cerrados`, this.nuevoDiaCerrado).subscribe({
      next: (res) => {
        this.creandoDiaCerrado = false;
        this.nuevoDiaCerrado = { fecha: '', motivo: '' };
        this.mensajeExito = `Día cerrado correctamente. ${res.citas_canceladas} cita(s) cancelada(s) y notificada(s).`;
        setTimeout(() => this.mensajeExito = '', 5000);
        this.cargarDiasCerrados();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.creandoDiaCerrado = false;
        this.mensajeError = err?.error?.detail || 'No se pudo cerrar el día.';
        setTimeout(() => this.mensajeError = '', 4000);
        this.cdr.detectChanges();
      }
    });
  }

  verCitasDiaCerrado(dia: any): void {
    this.diaCerradoSeleccionado = dia;
    this.modalCitasDiaCerradoAbierto = true;
    this.cargandoCitasDiaCerrado = true;
    this.citasDiaCerradoSeleccionado = [];
    this.http.get<any[]>(`${API}/admin/dias-cerrados/${dia.id}/citas`).subscribe({
      next: (data) => {
        this.citasDiaCerradoSeleccionado = data ?? [];
        this.cargandoCitasDiaCerrado = false;
        this.cdr.detectChanges();
      },
      error: () => { this.cargandoCitasDiaCerrado = false; this.cdr.detectChanges(); }
    });
  }

  reabrirDiaCerrado(dia: any): void {
    if (!confirm(`¿Reabrir el ${dia.fecha}? Las citas que ya se cancelaron NO se restauran automáticamente.`)) return;
    this.http.delete(`${API}/admin/dias-cerrados/${dia.id}`).subscribe({
      next: () => {
        this.mensajeExito = 'Día reabierto correctamente.';
        setTimeout(() => this.mensajeExito = '', 3000);
        this.cargarDiasCerrados();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.mensajeError = err?.error?.detail || 'No se pudo reabrir el día.';
        setTimeout(() => this.mensajeError = '', 3000);
        this.cdr.detectChanges();
      }
    });
  }

  cargarAuditoria(): void {
    if (!this.hasPermission('auditoria.ver')) {
      this.auditoria = [];
      this.cargandoAuditoria = false;
      return;
    }

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
    if (!this.hasPermission('auditoria.gestionar')) return;

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
    if (!this.hasPermission('auditoria.gestionar')) return;

    const nuevoValor = !this.todaAuditoriaSeleccionada;
    this.auditoria.forEach(a => a.seleccionada = nuevoValor);
  }

  eliminarAuditoriaSeleccionada(): void {
    if (!this.hasPermission('auditoria.gestionar')) return;

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
    if (!this.hasPermission('auditoria.ver')) return;

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