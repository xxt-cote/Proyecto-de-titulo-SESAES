import { Component, OnInit, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../config';
import { PhotoCropperComponent } from '../shared/photo-cropper/photo-cropper';
import { PhotoViewerComponent } from '../shared/photo-viewer/photo-viewer';
import { obtenerFeriado } from '../shared/feriados-chile';
import { obtenerDiasInternacionales } from '../shared/dias-internacionales';
import { ToastService } from '../shared/toast/toast.service';
import { ProfessionalAyudaComponent } from './ayuda/professional-ayuda';

const API = environment.apiUrl;

@Component({
  selector: 'app-dashboard-profesional',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, PhotoCropperComponent, PhotoViewerComponent, ProfessionalAyudaComponent],
  templateUrl: './dashboard-profesional.html',
  styleUrl: './dashboard-profesional.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardProfesionalComponent implements OnInit {

  seccionActiva = 'inicio';
  sidebarMovilAbierto = false;

toggleSidebarMovil(): void {
  this.sidebarMovilAbierto = !this.sidebarMovilAbierto;
}
  temaOscuro    = false;

  private _mensajeExito = '';
  set mensajeExito(valor: string) { this._mensajeExito = valor; if (valor) this.toast.success(valor); }
  get mensajeExito(): string { return this._mensajeExito; }

  private _mensajeError = '';
  set mensajeError(valor: string) { this._mensajeError = valor; if (valor) this.toast.error(valor); }
  get mensajeError(): string { return this._mensajeError; }

  // prof_db_id: id en tabla profesional (guardado en localStorage al hacer login)
  get profDbId(): number {
    return Number(localStorage.getItem('prof_db_id')) || 0;
  }

  perfil: any = {
    nombre: '', especialidad: '', iniciales: '',
    descripcion: '', correo: '', rut: '',
    estado: 'activo', foto_url: null,
    duracion_min: 45, tema_oscuro: false
  };

  get tituloSeccion(): string {
    const map: Record<string, string> = {
      inicio:            'Bienvenido/a',
      horario:            'Agenda',
      pacientes:          'Pacientes',
      'historial-clinico': 'Historial Clínico',
      solicitudes:        'Solicitudes',
      perfil:             'Configuración',
      ayuda:              'Ayuda'
    };
    return map[this.seccionActiva] ?? 'SESAES';
  }

  // Sub-pestaña dentro de "Mi Horario": agenda semanal o configuración de jornada/colación
  horarioTab: 'agenda' | 'configuracion' = 'agenda';
  cambiarHorarioTab(tab: 'agenda' | 'configuracion'): void {
    this.horarioTab = tab;
    if (tab === 'agenda') this.cargarCitasSemana();
  }

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const temaGuardado = localStorage.getItem('prof_tema_oscuro');
    if (temaGuardado === 'true') this.temaOscuro = true;
    this.cargarDatos();
    this.cargarCitasSinCerrar();
  }

  // ══════════════════════════════════════
  // CITAS SIN CERRAR (fecha ya pasó, siguen "pendiente")
  // ══════════════════════════════════════
  citasSinCerrar: any[] = [];
  cargarCitasSinCerrar(): void {
    this.http.get<any[]>(`${API}/profesional/${this.profDbId}/citas-sin-cerrar`).subscribe({
      next: (data) => { this.citasSinCerrar = data ?? []; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  cargarDatos(): void {
    this.cargarPerfil();
    this.cargarEstadisticasDia();
    this.cargarCitasHoy();
    this.cargarProximasSemana();
    this.cargarNotificaciones();
    this.generarSemanaActual();
    this.generarCalendarioInicio();
    this.cargarSolicitudesHorario();
    this.cargarDiasCerrados();
    this.cargarCitasPendientes();
    this.cargarAtenciones();
    this.cargarPacientesHistorial();
    this.cargarCitasSemana();
  }

  navegarA(seccion: string): void {
  this.seccionActiva     = seccion;
  this.mensajeExito      = '';
  this.mensajeError      = '';
  this.notifPanelAbierto = false;
  this.sidebarMovilAbierto = false;
  if (seccion === 'horario') {
    this.horarioTab = 'agenda';
    this.cargarCitasSemana();
  }
  if (seccion === 'pacientes') this.cargarAtenciones();
  if (seccion === 'historial-clinico') this.cargarPacientesHistorial();
  if (seccion === 'solicitudes') {
    this.cargarCitasPendientes();
    this.cargarSolicitudesHorario();
  }
}
  cerrarSesion(): void { localStorage.clear(); window.location.href = '/login'; }

  toggleTema(): void {
    this.temaOscuro = !this.temaOscuro;
    localStorage.setItem('prof_tema_oscuro', String(this.temaOscuro));
    this.http.patch(`${API}/profesional/${this.profDbId}/perfil`, { tema_oscuro: this.temaOscuro }).subscribe({ error: () => {} });
  }

  // ══════════════════════════════════════
  // HELPERS DE FECHA (español, sin DatePipe)
  // ══════════════════════════════════════

  private hoyStr(): string {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  }

  formatearDiaSeleccionado(fecha: string | null): string {
    if (!fecha) return '';
    const dias  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const d = new Date(anio, mes - 1, dia);
    const nombreDia = dias[d.getDay()];
    return `${nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)} ${dia} de ${meses[mes - 1]}`;
  }

  // ══════════════════════════════════════
  // NOTIFICACIONES
  // ══════════════════════════════════════

  notificaciones: any[] = [];
  notifPanelAbierto     = false;
  notifNoLeidas         = 0;

  cargarNotificaciones(): void {
    this.http.get<any[]>(`${API}/profesional/${this.profDbId}/notificaciones`).subscribe({
      next: (data) => {
        this.notificaciones = data ?? [];
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
    this.http.patch(`${API}/notificaciones/leer-todas/${this.perfil.usuario_id || 0}`, {}).subscribe({
      next: () => {
        this.notificaciones.forEach(n => n.leida = true);
        this.notifNoLeidas = 0;
        this.cdr.detectChanges();
      }
    });
  }
notifSeleccionadas = new Set<number>();

get notifHaySeleccionadas(): boolean {
  return this.notifSeleccionadas.size > 0;
}

get notifTodasSeleccionadas(): boolean {
  return this.notificaciones.length > 0 && this.notifSeleccionadas.size === this.notificaciones.length;
}

toggleSeleccionNotif(n: any): void {
  if (this.notifSeleccionadas.has(n.id)) this.notifSeleccionadas.delete(n.id);
  else this.notifSeleccionadas.add(n.id);
}

toggleSeleccionarTodasNotif(): void {
  if (this.notifTodasSeleccionadas) {
    this.notifSeleccionadas.clear();
  } else {
    this.notificaciones.forEach(n => this.notifSeleccionadas.add(n.id));
  }
}

marcarSeleccionadasLeidas(): void {
  const ids = Array.from(this.notifSeleccionadas);
  ids.forEach(id => {
    this.http.patch(`${API}/notificaciones/${id}/leer`, {}).subscribe({
      next: () => {
        const n = this.notificaciones.find(x => x.id === id);
        if (n && !n.leida) { n.leida = true; this.notifNoLeidas = Math.max(0, this.notifNoLeidas - 1); }
        this.cdr.detectChanges();
      }
    });
  });
  this.notifSeleccionadas.clear();
}

eliminarNotificacion(n: any): void {
  this.http.delete(`${API}/notificaciones/${n.id}`).subscribe({
    next: () => {
      this.notificaciones = this.notificaciones.filter(x => x.id !== n.id);
      this.notifSeleccionadas.delete(n.id);
      if (!n.leida) this.notifNoLeidas = Math.max(0, this.notifNoLeidas - 1);
      this.cdr.detectChanges();
    },
    error: () => {
      this.mensajeError = 'No se pudo eliminar la notificación.';
      setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
    }
  });
}

eliminarSeleccionadas(): void {
  const ids = Array.from(this.notifSeleccionadas);
  ids.forEach(id => {
    this.http.delete(`${API}/notificaciones/${id}`).subscribe({
      next: () => {
        const n = this.notificaciones.find(x => x.id === id);
        this.notificaciones = this.notificaciones.filter(x => x.id !== id);
        if (n && !n.leida) this.notifNoLeidas = Math.max(0, this.notifNoLeidas - 1);
        this.cdr.detectChanges();
      }
    });
  });
  this.notifSeleccionadas.clear();
}
  // ══════════════════════════════════════
  // PERFIL
  // ══════════════════════════════════════

  cargarPerfil(): void {
    this.http.get<any>(`${API}/profesional/${this.profDbId}/perfil`).subscribe({
      next: (data) => {
        this.perfil = data;
        this.perfilOriginalFotoUrl = data.foto_url || null;   // ← agregar esta línea
        this.temaOscuro = data.tema_oscuro || false;
        this.configPerfil.nombre      = data.nombre || '';
        this.configPerfil.descripcion = data.descripcion || '';
        this.charCount = (data.descripcion || '').length;
        this.generarHorasGrilla();
        this.cdr.detectChanges();
      },
      error: (err) => { console.error('[cargarPerfil] Error al cargar el perfil del profesional:', err); }
    });
}

  // ¿Hay cambios sin guardar en el formulario de perfil?
  get perfilModificado(): boolean {
    return this.configPerfil.nombre !== (this.perfil.nombre || '')
        || this.configPerfil.descripcion !== (this.perfil.descripcion || '')
        || this.perfil.foto_url !== this.perfilOriginalFotoUrl;  
}

  // ¿Hay datos suficientes para intentar el cambio de contraseña?
  get passwordModificada(): boolean {
    return !!this.configPerfil.contrasena_actual
        || !!this.configPerfil.contrasena_nueva
        || !!this.configPerfil.contrasena_conf;
  }

  // ══════════════════════════════════════
  // INICIO
  // ══════════════════════════════════════

  estadisticasDia = { total_hoy: 0, completadas: 0, pendientes: 0, inasistencias: 0 };

  get saludoHorario(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  // ── Tarjetas resumen del dashboard ──
  get pacientesActivosCount(): number { return this.pacientesHistorial.length; }

  get solicitudesPendientesTotal(): number {
    return this.citasPendientes.length + this.solicitudesHorario.filter(s => s.estado === 'pendiente').length;
  }

  get atencionesDelMes(): any[] {
    const hoy = new Date();
    const anioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    return this.atenciones.filter(a => (a.fecha || '').startsWith(anioMes));
  }
  get atencionesMesTotal(): number { return this.atencionesDelMes.length; }
  get atencionesMesCompletadas(): number { return this.atencionesDelMes.filter(a => a.estado === 'completada').length; }
  get atencionesMesPct(): number {
    const total = this.atencionesMesTotal;
    return total > 0 ? Math.round((this.atencionesMesCompletadas / total) * 100) : 0;
  }

  // Mezcla las citas pendientes de confirmar con las solicitudes de horario pendientes,
  // para el widget "Solicitudes pendientes" del Inicio (máx. 3 ítems)
  get solicitudesRecientes(): { tipo: string; nombre: string; sub: string }[] {
    const items: { tipo: string; nombre: string; sub: string }[] = [];
    this.citasPendientes.forEach(c => items.push({
      tipo: 'Solicitud de hora', nombre: c.estudiante, sub: `${c.fecha} · ${c.hora}`
    }));
    this.solicitudesHorario.filter(s => s.estado === 'pendiente').forEach(s => items.push({
      tipo: s.tipo === 'colacion' ? 'Solicitud de colación' : 'Solicitud de jornada',
      nombre: `${s.hora_inicio} – ${s.hora_fin}`,
      sub: 'Esperando aprobación del administrador'
    }));
    return items.slice(0, 3);
  }

  get proximaCitaGeneral(): any {
    const hoyPendientes = this.citasHoy.filter(c => c.estado === 'pendiente');
    if (hoyPendientes.length > 0) return hoyPendientes[0];
    return this.proximasSemana[0] || null;
  }

  // ── Agenda de hoy: bloques horarios reales (disponible / ocupado / colación / cerrado) ──
  // Reutiliza la misma lógica de la grilla semanal de "Mi Horario" (getBloqueEstado/Info),
  // por lo que requiere que citasSemana esté cargado (se pide también en cargarDatos()).

  get fechaHoyStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get centroCerradoHoy(): boolean { return this.esDiaCerrado(this.fechaHoyStr); }

  get agendaHoyBloques(): { hora: string; estado: string; cita: any }[] {
    const hoy = this.fechaHoyStr;
    return this.horasGrilla
      .map(hora => ({
        hora,
        estado: this.getBloqueEstado(hoy, hora),
        cita: this.citasHoy.find(c => this.convertirA24h(c.hora) === hora) || null
      }))
      .filter(b => b.estado !== 'cerrado-centro');
  }

  // Citas de hoy cuya hora no calza con ningún bloque de la grilla (sobrecupos)
  get sobrecuposHoy(): any[] {
    const horasValidas = new Set(this.horasGrilla);
    return this.citasHoy.filter(c => !horasValidas.has(this.convertirA24h(c.hora)));
  }

  // Heurística de tipo de atención usando el historial completo de citas del profesional
  // (no solo las de la ficha de un paciente): la primera cita histórica del estudiante
  // se etiqueta "Primera consulta", el resto "Seguimiento".
  tipoAtencionGlobal(cita: any): string {
    if (!cita || !cita.estudiante_id) return 'Consulta';
    const mismoPaciente = this.atenciones.filter(a => a.estudiante_id === cita.estudiante_id);
    if (mismoPaciente.length === 0) return 'Consulta';
    const masAntigua = [...mismoPaciente].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];
    return (masAntigua.fecha === cita.fecha && masAntigua.hora === cita.hora) ? 'Primera consulta' : 'Seguimiento';
  }

  // ── Datos para el nuevo orden del Inicio (agenda+calendario, alertas, pacientes recientes, actividad) ──

  get atencionesMesPendientes(): number { return this.atencionesDelMes.filter(a => a.estado === 'pendiente').length; }
  get atencionesMesCanceladas(): number { return this.atencionesDelMes.filter(a => a.estado === 'cancelada').length; }

  get fichasSinCompletarCount(): number { return this.pacientesHistorial.filter(p => !p.tiene_ficha).length; }
  get registrosPorRevisarCount(): number { return this.pacientesHistorial.filter(p => p.pendiente_revision).length; }

  get pacientesRecientes(): any[] {
    return [...this.pacientesHistorial]
      .sort((a, b) => (a.dias_desde_ultima_visita ?? Infinity) - (b.dias_desde_ultima_visita ?? Infinity))
      .slice(0, 4);
  }

  get actividadSemanalDias(): { label: string; count: number }[] {
    return (this.semanaActual || []).map((dia: any) => ({
      label: dia.nombre,
      count: this.atenciones.filter(a => a.fecha === dia.fecha).length
    }));
  }
  get actividadSemanalMax(): number {
    return Math.max(1, ...this.actividadSemanalDias.map(d => d.count));
  }

  irAFichaPacienteReciente(p: any): void {
    this.seccionActiva = 'historial-clinico';
    this.abrirFichaPaciente(p);
  }

  // Buscador global del topbar → filtra en "Mis Pacientes" por nombre, RUT o carrera
  busquedaGlobal = '';
  buscarGlobal(): void {
    const termino = this.busquedaGlobal.trim();
    if (!termino) return;
    this.filtroBusquedaAt = termino;
    this.busquedaGlobal = '';
    this.navegarA('pacientes');
  }

  irAFichasSinCompletar(): void {
    this.navegarA('historial-clinico');
    this.filtroEstadoHistorial = 'sin_completar';
  }

  irARevisarDocumentacion(): void {
    this.navegarA('historial-clinico');
    this.filtroEstadoHistorial = 'por_revisar';
  }

  // ══ Donut chart de composición del día (reemplaza al "pulso del día") ══
  // Tres getters puros que devuelven los ángulos de corte del conic-gradient,
  // calculados a partir de estadisticasDia. El color de cada tramo se define
  // en el CSS (claro y oscuro), aquí solo se calculan los grados.
  private anguloAcumulado(hastaCampo: 'completadas' | 'pendientes' | 'inasistencias'): number {
    const { total_hoy, completadas, pendientes, inasistencias } = this.estadisticasDia;
    if (!total_hoy) return 0;
    let acumulado = completadas;
    if (hastaCampo === 'pendientes') acumulado += pendientes;
    if (hastaCampo === 'inasistencias') acumulado += pendientes + inasistencias;
    return Math.min((acumulado / total_hoy) * 360, 360);
  }
  get donutC1(): string { return `${this.anguloAcumulado('completadas')}deg`; }
  get donutC2(): string { return `${this.anguloAcumulado('pendientes')}deg`; }
  get donutC3(): string { return `${this.anguloAcumulado('inasistencias')}deg`; }

  citasHoy: any[] = [];

  cargarEstadisticasDia(): void {
    this.http.get<any>(`${API}/profesional/${this.profDbId}/estadisticas-dia`).subscribe({
      next: (data) => {
        this.estadisticasDia = data;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  cargarCitasHoy(): void {
    const fechaStr = this.hoyStr();
    this.http.get<any[]>(`${API}/profesional/${this.profDbId}/citas?fecha=${fechaStr}`).subscribe({
      next: (data) => {
        this.citasHoy = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // Próximas citas de la semana (más allá de hoy) — para el widget de Inicio
  proximasSemana: any[] = [];

  private sumarDias(fechaStr: string, dias: number): string {
    const [anio, mes, dia] = fechaStr.split('-').map(Number);
    const d = new Date(anio, mes - 1, dia);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  cargarProximasSemana(): void {
    const hoy    = this.hoyStr();
    const limite = this.sumarDias(hoy, 6);
    this.http.get<any[]>(`${API}/profesional/${this.profDbId}/citas?estado=pendiente`).subscribe({
      next: (data) => {
        this.proximasSemana = (data ?? [])
          .filter(c => c.fecha > hoy && c.fecha <= limite)
          .sort((a, b) => a.fecha === b.fecha ? a.hora.localeCompare(b.hora) : a.fecha.localeCompare(b.fecha))
          .slice(0, 6);
        this.cdr.detectChanges();
      },
      error: () => {
        this.proximasSemana = [];
        this.cdr.detectChanges();
      }
    });
  }

  // Solo se puede completar/marcar inasistencia si la cita ya llegó a su fecha (no citas futuras)
  puedeGestionarCita(cita: any): boolean {
    return cita.fecha <= this.hoyStr();
  }

  // ══════════════════════════════════════
  // CALENDARIO DE INICIO (solo visual — mes completo, sin seleccion de dia)
  // ══════════════════════════════════════

  readonly NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  calMesVisible  = new Date().getMonth();
  calAnioVisible = new Date().getFullYear();
  calDiasMes: any[] = [];

  get calNombreMesVisible(): string {
    return `${this.NOMBRES_MES[this.calMesVisible]} ${this.calAnioVisible}`;
  }

  generarCalendarioInicio(): void {
    const primerDia = new Date(this.calAnioVisible, this.calMesVisible, 1);
    const ultimoDia = new Date(this.calAnioVisible, this.calMesVisible + 1, 0);
    const hoy       = this.hoyStr();
    const offset    = (primerDia.getDay() + 6) % 7;
    const celdas: any[] = [];
    for (let i = 0; i < offset; i++) celdas.push(null);
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fechaStr = `${this.calAnioVisible}-${String(this.calMesVisible+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
      celdas.push({ num: dia, fecha: fechaStr, esHoy: fechaStr === hoy });
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

  diaSeleccionadoInfo: string | null = null;
  seleccionarDiaInfo(dia: any): void {
    if (!dia) return;
    this.diaSeleccionadoInfo = this.diaSeleccionadoInfo === dia.fecha ? null : dia.fecha;
  }
  infoDelDia(fecha: string | undefined): string[] {
    if (!fecha) return [];
    const info: string[] = [];
    const feriado = obtenerFeriado(fecha);
    if (feriado) info.push(`🇨🇱 Feriado: ${feriado.nombre}`);
    for (const d of obtenerDiasInternacionales(fecha)) info.push(`🌍 ${d.nombre}`);
    return info;
  }

  // ══════════════════════════════════════
  // MODAL AUSENCIA / REPORTAR AUSENCIA
  // ══════════════════════════════════════

  modalAusenciaAbierto = false;
  ausenciaMotivo       = '';
  ausenciaTipo: 'temporal' | 'dia_completo' | 'licencia' = 'temporal';
  ausenciaHoraInicio   = '';
  ausenciaHoraFin      = '';
  ausenciaFechaInicio  = this.hoyStr();
  ausenciaFechaFin     = this.hoyStr();

  abrirModalAusencia(): void {
    this.ausenciaMotivo      = '';
    this.ausenciaTipo        = 'temporal';
    this.ausenciaHoraInicio  = '';
    this.ausenciaHoraFin     = '';
    this.ausenciaFechaInicio = this.hoyStr();
    this.ausenciaFechaFin    = this.hoyStr();
    this.modalAusenciaAbierto = true;
  }

  cerrarModalAusencia(): void { this.modalAusenciaAbierto = false; }
ausenciaTipos: { valor: 'temporal' | 'dia_completo' | 'licencia'; icono: string; label: string; desc: string }[] = [
  { valor: 'temporal',     icono: '⏱️', label: 'Temporal',        desc: 'Sales unas horas y vuelves el mismo día' },
  { valor: 'dia_completo', icono: '📅', label: 'Todo el día',     desc: 'No podrás atender ninguna cita hoy' },
  { valor: 'licencia',     icono: '🏥', label: 'Licencia médica', desc: 'Un rango de días, semanas o hasta un mes' }
];
get ausenciaTipoActual() {
  return this.ausenciaTipos.find(t => t.valor === this.ausenciaTipo);
}


  get ausenciaFormularioValido(): boolean {
    if (this.ausenciaTipo === 'temporal') return !!this.ausenciaHoraInicio && !!this.ausenciaHoraFin;
    if (this.ausenciaTipo === 'licencia')  return !!this.ausenciaFechaInicio && !!this.ausenciaFechaFin;
    return true; // dia_completo no necesita campos extra
  }

  enviandoAusencia = false;

  reportarAusencia(): void {
    if (!this.ausenciaFormularioValido || this.enviandoAusencia) return;
    this.enviandoAusencia = true;
    const body: any = {
      tipo:   this.ausenciaTipo,
      motivo: this.ausenciaMotivo
    };
    if (this.ausenciaTipo === 'temporal') {
      body.fecha        = this.hoyStr();
      body.hora_inicio   = this.ausenciaHoraInicio;
      body.hora_fin      = this.ausenciaHoraFin;
    } else if (this.ausenciaTipo === 'dia_completo') {
      body.fecha = this.hoyStr();
    } else {
      body.fecha_inicio = this.ausenciaFechaInicio;
      body.fecha_fin    = this.ausenciaFechaFin;
    }

    this.http.post(`${API}/profesional/${this.profDbId}/reportar-ausencia`, body).subscribe({
      next: () => {
        this.cerrarModalAusencia();
        this.cargarPerfil();
        this.cargarCitasHoy();
        this.cargarEstadisticasDia();
        if (this.seccionActiva === 'horario' && this.horarioTab === 'agenda') this.cargarCitasSemana();
        this.mensajeExito = 'Ausencia reportada. Se notificó a los estudiantes afectados.';
        this.enviandoAusencia = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.mensajeError = err?.error?.detail || 'No se pudo reportar la ausencia.';
        this.enviandoAusencia = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
      }
    });
  }

  // ══════════════════════════════════════
  // MI AGENDA
  // ══════════════════════════════════════

  semanaActual: any[] = [];
  semanaLabel         = '';
  diaSeleccionado: string | null = null;
  citasSemana: any[]  = [];
  horasGrilla: string[] = [];

  // Genera la grilla de horas según la duración de atención configurada por el profesional
  // (antes estaba fijo a pasos de 60 min, por lo que las citas de 45 min no calzaban con ninguna fila)
  private horaAMinutos(hora: string, fallback: number): number {
    if (!hora) return fallback;
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  // Posición horizontal (%) de una cita dentro de la línea "Pulso de hoy",
  // según la jornada laboral aprobada del profesional (horario_inicio–horario_fin).
  // NO puede ser private: el template la llama directamente con
  // [style.left.%]="horaAPosicionPct(cita.hora)".
  horaAPosicionPct(hora: string): number {
    const inicioMin = this.horaAMinutos(this.perfil.horario_inicio, 8 * 60);
    const finMin    = this.horaAMinutos(this.perfil.horario_fin, 18 * 60);
    const horaMin   = this.horaAMinutos(hora, inicioMin);

    const rango = finMin - inicioMin;
    if (rango <= 0) return 0;

    const pct = ((horaMin - inicioMin) / rango) * 100;
    return Math.min(100, Math.max(0, pct)); // clamp 0–100
  }

  generarHorasGrilla(): void {
    const pasoMin   = this.perfil.duracion_min || 60;
    const inicioMin = this.horaAMinutos(this.perfil.horario_inicio, 8 * 60);
    const finMin    = this.horaAMinutos(this.perfil.horario_fin, 18 * 60);
    const horas: string[] = [];
    let min = inicioMin;
    while (min < finMin) {
      const h = Math.floor(min / 60).toString().padStart(2,'0');
      const m = (min % 60).toString().padStart(2,'0');
      horas.push(`${h}:${m}`);
      min += pasoMin;
    }
    this.horasGrilla = horas;
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
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const [anio, mes] = this.semanaActual[0].fecha.split('-').map(Number);
    this.semanaLabel  = `${meses[mes - 1]} ${anio}`;
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

  semanaAnterior(): void { const l = this.parseDateStrLocal(this.semanaActual[0].fecha); l.setDate(l.getDate() - 7); this.buildSemana(l); this.cargarCitasSemana(); }
  semanaSiguiente(): void { const l = this.parseDateStrLocal(this.semanaActual[0].fecha); l.setDate(l.getDate() + 7); this.buildSemana(l); this.cargarCitasSemana(); }
  irAHoy(): void { this.generarSemanaActual(); this.cargarCitasSemana(); }

  cargarCitasSemana(): void {
    const fechaInicio = this.semanaActual[0]?.fecha;
    const fechaFin    = this.semanaActual[6]?.fecha;
    if (!fechaInicio) return;
    this.http.get<any[]>(`${API}/profesional/${this.profDbId}/citas`).subscribe({
      next: (data) => {
        this.citasSemana = (data ?? []).filter(c => c.fecha >= fechaInicio && c.fecha <= fechaFin);
        this.cdr.detectChanges();
      },
      error: () => {
        this.citasSemana = [];
        this.cdr.detectChanges();
      }
    });
  }

private esHoraDeColacion(hora: string): boolean {
    const inicio = this.perfil.hora_almuerzo_inicio;
    const fin    = this.perfil.hora_almuerzo_fin;
    if (!inicio || !fin) return false;
    const h = hora.substring(0, 5);
    return h >= inicio && h < fin;
  }
convertirA24h(hora: string): string {
    if (!hora) return '';
    if (!hora.includes('AM') && !hora.includes('PM')) return hora.substring(0,5);
    const [time, period] = hora.trim().split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  diasCerrados: any[] = [];
  cargarDiasCerrados(): void {
    this.http.get<any[]>(`${API}/dias-cerrados`).subscribe({
      next: (data) => { this.diasCerrados = data ?? []; this.cdr.detectChanges(); },
      error: () => {}
    });
  }
  esDiaCerrado(fecha: string): boolean { return this.diasCerrados.some(d => d.fecha === fecha); }

  getBloqueEstado(fecha: string, hora: string): string {
    if (this.esDiaCerrado(fecha)) return 'cerrado-centro';
    if (this.esHoraDeColacion(hora)) return 'bloqueado';
    const cita = this.citasSemana.find(c => c.fecha === fecha && this.convertirA24h(c.hora) === hora.substring(0,5));
    if (!cita) return 'libre';
    return cita.urgente ? 'urgente' : 'ocupado';
  }

  getBloqueInfo(fecha: string, hora: string): string {
    if (this.esDiaCerrado(fecha)) return '';
    if (this.esHoraDeColacion(hora)) return 'Colación';
    const cita = this.citasSemana.find(c => c.fecha === fecha && this.convertirA24h(c.hora) === hora.substring(0,5));
    return cita ? cita.estudiante : '';
  }

  get citasDiaSeleccionado(): any[] {
    if (!this.diaSeleccionado) return [];
    return this.citasSemana.filter(c => c.fecha === this.diaSeleccionado);
  }

  clickBloque(fecha: string, hora: string): void { this.diaSeleccionado = fecha; }

  // Desde la Agenda (u otras vistas): te lleva directo al Historial Clínico
  // y abre la ficha completa de ese paciente (con su historial de atenciones:
  // cuántas veces vino, cada cuánto, fecha, hora, motivo y medicamento).
  irAFichaDesdeAgenda(cita: any): void {
    if (!cita.estudiante_id) return;
    this.seccionActiva = 'historial-clinico';
    this.cargarPacientesHistorial();
    this.abrirFichaPaciente({ estudiante_id: cita.estudiante_id, nombre: cita.estudiante });
  }

  // Desde "Mis Pacientes": ir directo al Historial Clínico de ese paciente
  verHistorialPaciente(p: any): void {
    this.seccionActiva = 'historial-clinico';
    this.cargarPacientesHistorial();
    this.abrirFichaPaciente({ estudiante_id: p.estudiante_id, nombre: p.estudiante });
  }

  // ══════════════════════════════════════
  // SOLICITUDES — citas pendientes de confirmar (además de las
  // solicitudes de horario, que se cargan en cargarSolicitudesHorario)
  // ══════════════════════════════════════

  citasPendientes: any[] = [];

  cargarCitasPendientes(): void {
    this.http.get<any[]>(`${API}/profesional/${this.profDbId}/citas?estado=pendiente`).subscribe({
      next: (data) => { this.citasPendientes = data ?? []; this.cdr.detectChanges(); },
      error: () => { this.citasPendientes = []; this.cdr.detectChanges(); }
    });
  }

  // Tras completar/marcar inasistencia desde Solicitudes, refresca esta lista también
  private refrescarCitasPendientesSiCorresponde(): void {
    if (this.seccionActiva === 'solicitudes') this.cargarCitasPendientes();
  }

  // ══════════════════════════════════════
  // MIS ATENCIONES
  // ══════════════════════════════════════

  atenciones: any[]      = [];
  pagAtenciones          = 1;
  filtroEstadoAt         = '';
  filtroBusquedaAt       = '';
  modalCompletarAbierto  = false;
  citaParaCompletar: any = null;
  formCompletar = { medicamento: '', observaciones_atencion: '' };

  cargarAtenciones(): void {
    let url = `${API}/profesional/${this.profDbId}/citas`;
    if (this.filtroEstadoAt) url += `?estado=${this.filtroEstadoAt}`;
    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.atenciones = data ?? [];
        this.pagAtenciones = 1;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }
limpiarFiltrosAtenciones(): void {
  this.filtroBusquedaAt = '';
  this.filtroEstadoAt = '';
  this.cargarAtenciones();
}
  get atencionesFiltradas(): any[] {
    const q = this.filtroBusquedaAt.toLowerCase();
    return !q ? this.atenciones : this.atenciones.filter(a =>
      a.estudiante.toLowerCase().includes(q) ||
      (a.rut || '').toLowerCase().includes(q) ||
      (a.carrera || '').toLowerCase().includes(q)
    );
  }

  get atencionesPaginadas(): any[] { return this.atencionesFiltradas.slice((this.pagAtenciones-1)*8, this.pagAtenciones*8); }

  getPaginasAt(): number[] {
    const total = Math.ceil(this.atencionesFiltradas.length / 8);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  minVal(a: number, b: number): number { return Math.min(a, b); }

  abrirModalCompletar(cita: any): void {
    if (!this.puedeGestionarCita(cita)) return;
    this.citaParaCompletar = cita;
    this.formCompletar = { medicamento: cita.medicamento || '', observaciones_atencion: cita.observaciones_atencion || '' };
    this.modalCompletarAbierto = true;
  }

  cerrarModalCompletar(): void { this.modalCompletarAbierto = false; this.citaParaCompletar = null; }

  confirmarCompletar(): void {
    if (!this.citaParaCompletar) return;
    this.http.patch(`${API}/profesional/${this.profDbId}/citas/${this.citaParaCompletar.id}/completar`, this.formCompletar).subscribe({
      next: () => {
        this.cerrarModalCompletar();
        this.cargarAtenciones();
        this.cargarEstadisticasDia();
        this.cargarCitasHoy();
        this.cargarCitasSinCerrar();
        this.refrescarCitasPendientesSiCorresponde();
        this.mensajeExito = 'Atención completada correctamente.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: () => {
        this.mensajeError = 'No se pudo completar la atención.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
      }
    });
  }

  marcarInasistencia(cita: any): void {
    if (!this.puedeGestionarCita(cita)) return;
    if (!confirm(`¿Marcar inasistencia de ${cita.estudiante}?`)) return;
    this.http.patch(`${API}/profesional/${this.profDbId}/citas/${cita.id}/inasistencia`, {}).subscribe({
      next: () => {
        this.cargarAtenciones();
        this.cargarEstadisticasDia();
        this.cargarCitasHoy();
        this.cargarCitasSinCerrar();
        this.refrescarCitasPendientesSiCorresponde();
        this.mensajeExito = 'Inasistencia registrada.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: () => {
        this.mensajeError = 'No se pudo registrar.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
      }
    });
  }

  // ══════════════════════════════════════
  // PERFIL Y CONFIGURACIÓN
  // ══════════════════════════════════════

  configPerfil = { nombre: '', descripcion: '', contrasena_actual: '', contrasena_nueva: '', contrasena_conf: '' };
  charCount = 0;
  mostrarContrasenaActual = false;
  mostrarContrasenaaNueva  = false;
  mostrarContrasenaConf   = false;

  // Horario de almuerzo
horarioAlmuerzoEnEdicion = false;
almuerzoHoraInicio = '';   // valor del <input type="time">, formato "HH:MM"

habilitarEdicionAlmuerzo(): void {
  this.horarioAlmuerzoEnEdicion = true;
  this.almuerzoHoraInicio = this.perfil.hora_almuerzo_inicio || '';
}

cancelarEdicionAlmuerzo(): void {
  this.horarioAlmuerzoEnEdicion = false;
  this.almuerzoHoraInicio = this.perfil.hora_almuerzo_inicio || '';
}

get almuerzoHoraFinPreview(): string {
  if (!this.almuerzoHoraInicio) return '';
  const [h, m] = this.almuerzoHoraInicio.split(':').map(Number);
  const totalMin = h * 60 + m + 60;
  const finH = Math.floor(totalMin / 60) % 24;
  const finM = totalMin % 60;
  return `${String(finH).padStart(2,'0')}:${String(finM).padStart(2,'0')}`;
}

enviandoAlmuerzo = false;

guardarHorarioAlmuerzo(): void {
  if (!this.almuerzoHoraInicio || this.enviandoAlmuerzo) return; // evita doble envío por doble clic
  this.enviandoAlmuerzo = true;
  this.http.post<any>(`${API}/profesional/${this.profDbId}/solicitar-colacion`, {
    hora_almuerzo_inicio: this.almuerzoHoraInicio
  }).subscribe({
    next: (resp) => {
      this.horarioAlmuerzoEnEdicion = false;
      this.enviandoAlmuerzo = false;
      this.mensajeExito = `Solicitud enviada: colación ${resp.hora_inicio} - ${resp.hora_fin}. Queda pendiente de aprobación del administrador.`;
      this.cargarSolicitudesHorario();
      this.cdr.detectChanges();
      setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 4000);
    },
    error: (err) => {
      this.mensajeError = err?.error?.detail || 'No se pudo enviar la solicitud de colación.';
      this.enviandoAlmuerzo = false;
      this.cdr.detectChanges();
      setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
    }
  });
}
  // Edición de Perfil / Contraseña: campos bloqueados hasta que se presiona "Editar"
  perfilEnEdicion   = false;
  passwordEnEdicion = false;
  private perfilOriginalFotoUrl: string | null = null;
  habilitarEdicionPerfil(): void { this.perfilEnEdicion = true; }

  cancelarEdicionPerfil(): void {
    this.perfilEnEdicion = false;
    this.configPerfil.nombre      = this.perfil.nombre || '';
    this.configPerfil.descripcion = this.perfil.descripcion || '';
    this.charCount = (this.perfil.descripcion || '').length;
  }

  habilitarEdicionPassword(): void { this.passwordEnEdicion = true; }

  cancelarEdicionPassword(): void {
    this.passwordEnEdicion = false;
    this.configPerfil.contrasena_actual = '';
    this.configPerfil.contrasena_nueva  = '';
    this.configPerfil.contrasena_conf   = '';
  }

  onDescripcionChange(): void { this.charCount = (this.configPerfil.descripcion || '').length; }

  imagenParaRecortar: string | null = null;
  verFotoAmpliada = false;

  onFotoSeleccionada(event: any): void {
    if (!this.perfilEnEdicion) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagenParaRecortar = e.target.result;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  onFotoRecortada(dataUrl: string): void {
    this.perfil.foto_url    = dataUrl;
    this.imagenParaRecortar = null;
    this.cdr.detectChanges();
  }

  esFeriado(fecha: string | undefined): boolean {
    return !!fecha && !!obtenerFeriado(fecha);
  }

  nombreFeriado(fecha: string | undefined): string {
    if (!fecha) return '';
    const f = obtenerFeriado(fecha);
    return f ? `Feriado: ${f.nombre}` : '';
  }

  guardarPerfil(): void {
    if (!this.perfilModificado) return;
    this.http.patch(`${API}/profesional/${this.profDbId}/perfil`, {
      nombre: this.configPerfil.nombre, descripcion: this.configPerfil.descripcion, foto_url: this.perfil.foto_url
    }).subscribe({
      next: () => {
    this.perfil.nombre = this.configPerfil.nombre;
    this.perfil.descripcion = this.configPerfil.descripcion;
    this.perfilOriginalFotoUrl = this.perfil.foto_url;   // ← agregar esta línea
    this.perfilEnEdicion = false;
    this.mensajeExito = 'Perfil actualizado correctamente.';
    this.cdr.detectChanges();
    setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 3000);
},
      error: (err) => {
        this.mensajeError = err?.error?.detail || 'No se pudo guardar.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
      }
    });
  }

  cambiarPassword(): void {
    if (!this.passwordModificada) return;
    if (!this.configPerfil.contrasena_actual) { this.mensajeError = 'Ingresa tu contraseña actual.'; setTimeout(() => this.mensajeError = '', 3000); return; }
    if (!this.configPerfil.contrasena_nueva)  { this.mensajeError = 'Ingresa la nueva contraseña.'; setTimeout(() => this.mensajeError = '', 3000); return; }
    if (this.configPerfil.contrasena_nueva !== this.configPerfil.contrasena_conf) { this.mensajeError = 'Las contraseñas no coinciden.'; setTimeout(() => this.mensajeError = '', 3000); return; }
    this.http.patch(`${API}/profesional/${this.profDbId}/cambiar-password`, {
      contrasena_actual: this.configPerfil.contrasena_actual, contrasena_nueva: this.configPerfil.contrasena_nueva
    }).subscribe({
      next: () => {
        this.configPerfil.contrasena_actual = ''; this.configPerfil.contrasena_nueva = ''; this.configPerfil.contrasena_conf = '';
        this.passwordEnEdicion = false;
        this.mensajeExito = 'Contraseña actualizada correctamente.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.mensajeError = err?.error?.detail || 'Contraseña actual incorrecta.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
      }
    });
  }
  // ══════════════════════════════════════
  // MI HORARIO — solicitud de jornada laboral
  // ══════════════════════════════════════

  jornadaHoraInicio = '';
  jornadaHoraFin    = '';
  solicitudesHorario: any[] = [];

  get solicitudJornadaPendiente(): any {
    return this.solicitudesHorario.find(s => s.tipo === 'jornada' && s.estado === 'pendiente');
  }

  get solicitudColacionPendiente(): any {
    return this.solicitudesHorario.find(s => s.tipo === 'colacion' && s.estado === 'pendiente');
  }

  cargarSolicitudesHorario(): void {
    this.http.get<any[]>(`${API}/profesional/${this.profDbId}/solicitudes-horario`).subscribe({
      next: (data) => {
        this.solicitudesHorario = data ?? [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  get jornadaFormularioValido(): boolean {
    return !!this.jornadaHoraInicio && !!this.jornadaHoraFin && this.jornadaHoraInicio < this.jornadaHoraFin;
  }
  solicitudesSeleccionadas = new Set<number>();

get solicitudesHaySeleccionadas(): boolean {
  return this.solicitudesSeleccionadas.size > 0;
}

get solicitudesTodasSeleccionadas(): boolean {
  return this.solicitudesHorario.length > 0 && this.solicitudesSeleccionadas.size === this.solicitudesHorario.length;
}

toggleSeleccionSolicitud(s: any): void {
  if (this.solicitudesSeleccionadas.has(s.id)) this.solicitudesSeleccionadas.delete(s.id);
  else this.solicitudesSeleccionadas.add(s.id);
}

toggleSeleccionarTodasSolicitudes(): void {
  if (this.solicitudesTodasSeleccionadas) {
    this.solicitudesSeleccionadas.clear();
  } else {
    this.solicitudesHorario.forEach(s => this.solicitudesSeleccionadas.add(s.id));
  }
}

eliminarSolicitud(s: any): void {
  this.http.delete(`${API}/solicitudes-horario/${s.id}`).subscribe({
    next: () => {
      this.solicitudesHorario = this.solicitudesHorario.filter(x => x.id !== s.id);
      this.solicitudesSeleccionadas.delete(s.id);
      this.cdr.detectChanges();
    },
    error: () => {
      this.mensajeError = 'No se pudo eliminar la solicitud.';
      setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
    }
  });
}

eliminarSolicitudesSeleccionadas(): void {
  const ids = Array.from(this.solicitudesSeleccionadas);
  ids.forEach(id => {
    this.http.delete(`${API}/solicitudes-horario/${id}`).subscribe({
      next: () => {
        this.solicitudesHorario = this.solicitudesHorario.filter(x => x.id !== id);
        this.cdr.detectChanges();
      }
    });
  });
  this.solicitudesSeleccionadas.clear();
}
  solicitarJornada(): void {
    if (!this.jornadaFormularioValido) return;
    this.http.post<any>(`${API}/profesional/${this.profDbId}/solicitar-jornada`, {
      horario_inicio: this.jornadaHoraInicio,
      horario_fin: this.jornadaHoraFin
    }).subscribe({
      next: (resp) => {
        this.mensajeExito = `Solicitud enviada: jornada ${resp.hora_inicio} - ${resp.hora_fin}. Queda pendiente de aprobación del administrador.`;
        this.jornadaHoraInicio = '';
        this.jornadaHoraFin = '';
        this.cargarSolicitudesHorario();
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.mensajeError = err?.error?.detail || 'No se pudo enviar la solicitud de jornada.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
      }
    });
  }

  // ══════════════════════════════════════
  // HISTORIAL CLÍNICO
  // ══════════════════════════════════════

  pacientesHistorial: any[] = [];
  busquedaPaciente = '';
  filtroAnioHistorial = '';
  filtroCarreraHistorial = '';
  filtroEstadoHistorial: '' | 'completa' | 'sin_completar' | 'por_revisar' = '';
  cargandoPacientesHistorial = false;

  pacienteSeleccionado: any = null;   // { estudiante_id, nombre, ... }
  fichaPreguntas: any[] = [];
  fichaRespuestas: any = {};
  fichaExiste = false;
  fichaEnEdicion = false;
  fichaFechaModificacion: string | null = null;
  fichaCompletadoPor: string | null = null;
  fichaRevisada = true;
  guardandoFicha = false;

  // Datos del estudiante + su historial de citas con este profesional
  // (para la vista "ver todas sus atenciones" al hacer clic en el paciente)
  fichaEstudianteRut = '';
  fichaEstudianteCarrera = '';
  fichaEstudianteCorreo = '';
  fichaEstudianteFotoUrl: string | null = null;
  fichaFotoError = false;
  fichaCitas: any[] = [];
  fichaTotalAtenciones = 0;
  fichaUltimaVisita: string | null = null;
  fichaDiasDesdeUltimaVisita: number | null = null;
  fichaTab: 'timeline' | 'resumen' | 'ficha' | 'citas' = 'timeline';

  gestionarPlantillaAbierto = false;
  plantillaPreguntasEdit: any[] = [];
  guardandoPlantilla = false;

  get aniosHistorialDisponibles(): number[] {
    const actual = new Date().getFullYear();
    return [actual, actual - 1, actual - 2, actual - 3];
  }

  get pacientesHistorialFiltrados(): any[] {
    const q = this.busquedaPaciente.trim().toLowerCase();
    let lista = this.pacientesHistorial;
    if (q) {
      lista = lista.filter(p =>
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.rut || '').toLowerCase().includes(q) ||
        (p.correo || '').toLowerCase().includes(q)
      );
    }
    if (this.filtroEstadoHistorial === 'completa')      lista = lista.filter(p => p.tiene_ficha);
    if (this.filtroEstadoHistorial === 'sin_completar') lista = lista.filter(p => !p.tiene_ficha);
    if (this.filtroEstadoHistorial === 'por_revisar')   lista = lista.filter(p => p.pendiente_revision);
    return lista;
  }

  get carrerasHistorialDisponibles(): string[] {
    const set = new Set<string>();
    this.pacientesHistorial.forEach(p => { if (p.carrera) set.add(p.carrera); });
    return Array.from(set).sort();
  }

  // ── Tarjetas resumen de Historial Clínico (datos reales, sin cifras inventadas) ──
  get consultasTotalesHistorial(): number {
    return this.pacientesHistorial.reduce((sum, p) => sum + (p.total_atenciones || 0), 0);
  }

  get fichasCompletadasPctHistorial(): number {
    const total = this.pacientesHistorial.length;
    if (total === 0) return 0;
    const completas = this.pacientesHistorial.filter(p => p.tiene_ficha).length;
    return Math.round((completas / total) * 100);
  }

  get pacientesConFichaCount(): number {
    return this.pacientesHistorial.filter(p => p.tiene_ficha).length;
  }

  cargarPacientesHistorial(): void {
    this.cargandoPacientesHistorial = true;
    let params = new HttpParams();
    if (this.filtroAnioHistorial)   params = params.set('anio', this.filtroAnioHistorial);
    if (this.filtroCarreraHistorial) params = params.set('carrera', this.filtroCarreraHistorial);
    this.http.get<any[]>(`${API}/historial-clinico/${this.profDbId}/pacientes`, { params }).subscribe({
      next: (data) => { this.pacientesHistorial = data; this.cargandoPacientesHistorial = false; this.cdr.detectChanges(); },
      error: () => { this.pacientesHistorial = []; this.cargandoPacientesHistorial = false; this.cdr.detectChanges(); }
    });
  }

  limpiarFiltrosHistorial(): void {
    this.busquedaPaciente = '';
    this.filtroAnioHistorial = '';
    this.filtroCarreraHistorial = '';
    this.filtroEstadoHistorial = '';
    this.cargarPacientesHistorial();
  }

  abrirFichaPaciente(paciente: any): void {
    this.pacienteSeleccionado = paciente;
    this.fichaEnEdicion = false;
    this.fichaTab = 'resumen';
    this.fichaFotoError = false;
    this.http.get<any>(`${API}/historial-clinico/${this.profDbId}/${paciente.estudiante_id}`).subscribe({
      next: (data) => {
        this.fichaPreguntas   = data.preguntas;
        this.fichaRespuestas  = { ...data.respuestas };
        this.fichaExiste      = data.existe;
        this.fichaFechaModificacion = data.fecha_modificacion;
        this.fichaCompletadoPor     = data.completado_por;
        this.fichaRevisada          = data.revisado_por_profesional ?? true;
        this.fichaEnEdicion   = !data.existe; // primera vez → entra directo en modo edición

        this.fichaEstudianteRut     = data.estudiante_rut || '';
        this.fichaEstudianteCarrera = data.estudiante_carrera || '';
        this.fichaEstudianteCorreo  = data.estudiante_correo || '';
        this.fichaEstudianteFotoUrl = data.estudiante_foto_url || null;
        this.fichaCitas             = data.citas || [];
        this.fichaTotalAtenciones   = data.total_atenciones || 0;
        this.fichaUltimaVisita      = data.ultima_visita;
        this.fichaDiasDesdeUltimaVisita = data.dias_desde_ultima_visita;

        this.cdr.detectChanges();
      },
      error: () => {
        this.mensajeError = 'No se pudo cargar la ficha del paciente.';
        this.pacienteSeleccionado = null;
        this.cdr.detectChanges();
      }
    });
  }

  cerrarFichaPaciente(): void {
    this.pacienteSeleccionado = null;
    this.fichaPreguntas  = [];
    this.fichaRespuestas = {};
    this.fichaCitas = [];
    this.fichaTab = 'resumen';
  }

  // ── Datos derivados para la vista de ficha estilo "Historial clínico" ──

  get fichaCitasCompletadas(): any[] {
    return this.fichaCitas.filter(c => c.estado === 'completada');
  }

  get fichaUltimaAtencion(): any {
    return this.fichaCitasCompletadas[0] || null; // fichaCitas viene ordenado desc por fecha/hora
  }

  get fichaProximaCita(): any {
    const hoy = new Date().toISOString().slice(0, 10);
    const futuras = this.fichaCitas.filter(c => c.estado === 'pendiente' && c.fecha >= hoy);
    if (futuras.length === 0) return null;
    return futuras.reduce((min, c) => ((c.fecha + c.hora) < (min.fecha + min.hora) ? c : min));
  }

  get fichaCitaPendienteActual(): any {
    return this.fichaCitas.find(c => c.estado === 'pendiente') || null;
  }

  // Heurística: la cita más antigua de este paciente con este profesional es "Primera consulta"
  tipoAtencionCita(cita: any): string {
    if (this.fichaCitas.length === 0) return 'Consulta';
    const masAntigua = [...this.fichaCitas].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))[0];
    return masAntigua === cita ? 'Primera consulta' : 'Seguimiento psicológico';
  }

  // Color del punto en la línea de tiempo, según el tipo de atención
  colorTipoAtencion(cita: any): string {
    const tipo = this.tipoAtencionCita(cita);
    if (tipo === 'Primera consulta') return 'morado';
    if (tipo === 'Seguimiento psicológico') return 'azul';
    return 'verde';
  }

  // Atenciones completadas del paciente, agrupadas por año (para la línea de tiempo)
  get fichaCitasCompletadasPorAnio(): { anio: string; atenciones: any[] }[] {
    const grupos: Record<string, any[]> = {};
    this.fichaCitasCompletadas.forEach(c => {
      const anio = (c.fecha || '').slice(0, 4) || 'Sin fecha';
      if (!grupos[anio]) grupos[anio] = [];
      grupos[anio].push(c);
    });
    return Object.keys(grupos)
      .sort((a, b) => b.localeCompare(a))
      .map(anio => ({ anio, atenciones: grupos[anio] }));
  }

  // % de preguntas de la ficha de antecedentes que ya tienen respuesta guardada
  get fichaCompletitudPct(): number {
    const total = this.fichaPreguntas.length;
    if (total === 0) return 0;
    const respondidas = this.fichaPreguntas.filter(p => {
      const v = this.fichaRespuestas[p.id];
      return v !== undefined && v !== null && String(v).trim() !== '';
    }).length;
    return Math.round((respondidas / total) * 100);
  }

  registrarNuevaAtencionDesdeFicha(): void {
    const pendiente = this.fichaCitaPendienteActual;
    if (pendiente && this.puedeGestionarCita(pendiente)) {
      this.abrirModalCompletar(pendiente);
    } else {
      this.mensajeError = 'No hay una cita pendiente lista para registrar. El estudiante debe agendar una hora primero.';
    }
  }

  imprimirHistorial(): void {
    window.print();
  }

  habilitarEdicionFicha(): void { this.fichaEnEdicion = true; }

  cancelarEdicionFicha(): void {
    if (!this.fichaExiste) { this.cerrarFichaPaciente(); return; }
    this.abrirFichaPaciente(this.pacienteSeleccionado);
  }

  guardarFicha(): void {
    if (this.guardandoFicha) return;
    this.guardandoFicha = true;
    this.http.put(`${API}/historial-clinico/${this.profDbId}/${this.pacienteSeleccionado.estudiante_id}`, {
      respuestas: this.fichaRespuestas
    }).subscribe({
      next: () => {
        this.fichaExiste = true;
        this.fichaEnEdicion = false;
        this.fichaRevisada = true;   // el profesional acaba de revisar/confirmar
        this.guardandoFicha = false;
        this.mensajeExito = 'Ficha guardada correctamente.';
        this.cargarPacientesHistorial();
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: () => {
        this.mensajeError = 'No se pudo guardar la ficha.';
        this.guardandoFicha = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
      }
    });
  }

  // ── Gestionar preguntas de la plantilla (por especialidad) ──

  abrirGestionPlantilla(): void {
    this.http.get<any>(`${API}/historial-clinico/plantilla/${this.profDbId}`).subscribe({
      next: (data) => {
        this.plantillaPreguntasEdit = data.preguntas.map((p: any) => ({ ...p }));
        this.gestionarPlantillaAbierto = true;
        this.cdr.detectChanges();
      },
      error: () => { this.mensajeError = 'No se pudo cargar la plantilla de preguntas.'; this.cdr.detectChanges(); }
    });
  }

  agregarPreguntaPlantilla(): void {
    this.plantillaPreguntasEdit.push({ id: null, etiqueta: '', tipo: 'texto', orden: this.plantillaPreguntasEdit.length });
  }

  eliminarPreguntaPlantilla(index: number): void {
    this.plantillaPreguntasEdit.splice(index, 1);
  }

  guardarPlantilla(): void {
    const preguntasValidas = this.plantillaPreguntasEdit.filter(p => p.etiqueta.trim());
    if (this.guardandoPlantilla) return;
    this.guardandoPlantilla = true;
    this.http.put(`${API}/historial-clinico/plantilla/${this.profDbId}`, { preguntas: preguntasValidas }).subscribe({
      next: () => {
        this.gestionarPlantillaAbierto = false;
        this.guardandoPlantilla = false;
        this.mensajeExito = 'Preguntas actualizadas correctamente.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: () => {
        this.mensajeError = 'No se pudo guardar la plantilla.';
        this.guardandoPlantilla = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeError = ''; this.cdr.detectChanges(); }, 3000);
      }
    });
  }
}