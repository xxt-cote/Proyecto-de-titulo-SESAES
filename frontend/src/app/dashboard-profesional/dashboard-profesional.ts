import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
import { evaluarPassword, type PasswordChecklist } from '../shared/password-validation';
import { coincideBusqueda } from '../shared/text-normalization';
import { AuthService } from '../auth.service';
import { inicialesDe } from '../dashboard-admin/citas/admin-citas.utils';
import { CompletarAtencionComponent, type DocumentoEmitido, type PacienteAtencion } from './completar-atencion/completar-atencion';
import { DocumentosCitaComponent } from '../shared/documentos-cita/documentos-cita';
import { CuestionarioOpcionalComponent } from './cuestionario-opcional/cuestionario-opcional';

const API = environment.apiUrl;

@Component({
  selector: 'app-dashboard-profesional',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, PhotoCropperComponent, PhotoViewerComponent, ProfessionalAyudaComponent, CompletarAtencionComponent, DocumentosCitaComponent, CuestionarioOpcionalComponent],
  templateUrl: './dashboard-profesional.html',
  styleUrl: './dashboard-profesional.css'
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

  // Profesional.id se resuelve desde la identidad Usuario de la sesión.
  // Nunca se persiste en localStorage: evita mezclar identidades entre pestañas.
  private profesionalId = 0;

  get profDbId(): number {
    return this.profesionalId;
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
    private toast: ToastService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    const temaGuardado = localStorage.getItem('prof_tema_oscuro');
    if (temaGuardado === 'true') this.temaOscuro = true;

    this.resolverIdentidadProfesional();
  }

  private resolverIdentidadProfesional(): void {
    const usuarioId = this.auth.getUsuarioId();

    if (
      this.auth.getRol() !== 'profesional' ||
      usuarioId === null
    ) {
      this.mensajeError = 'No se pudo validar la sesión profesional.';
      this.auth.logout();
      void this.router.navigate(['/login']);
      return;
    }

    this.http.get<{ id: number }>(
      `${API}/profesional/buscar-por-usuario/${usuarioId}`
    ).subscribe({
      next: (profesional) => {
        const profesionalId = Number(profesional?.id);

        if (
          !Number.isInteger(profesionalId) ||
          profesionalId <= 0
        ) {
          this.mensajeError = 'La cuenta profesional no tiene un perfil válido asociado.';
          return;
        }

        this.profesionalId = profesionalId;
        this.cargarDatos();
        this.cargarCitasSinCerrar();
        this.cdr.detectChanges();
      },
      error: () => {
        this.mensajeError = 'Tu cuenta de profesional no está vinculada correctamente. Contacta al administrador.';
        this.cdr.detectChanges();
      }
    });
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
    this.cargarDocumentosHoy();
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
  if (seccion === 'historial-clinico' && this.pacienteSeleccionado) {
    if (!this.confirmarSalidaFicha()) return;
    this.cerrarFichaPaciente();
  }
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
  cerrarSesion(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

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

  get passwordChecklist(): PasswordChecklist {
    return evaluarPassword(this.configPerfil.contrasena_nueva);
  }

  get passwordCumpleReglas(): boolean {
    return this.passwordChecklist.valida;
  }

  // ══════════════════════════════════════
  // INICIO
  // ══════════════════════════════════════

  estadisticasDia = { total_hoy: 0, completadas: 0, pendientes: 0, inasistencias: 0 };

  // ── Tarjetas resumen del dashboard ──
  get pacientesActivosCount(): number { return this.pacientesHistorial.length; }

  get solicitudesPendientesTotal(): number {
    return this.citasPendientes.length + this.solicitudesHorario.filter(s => s.estado === 'pendiente').length;
  }

  // ── Agenda de hoy: bloques horarios reales (disponible / ocupado / colación / cerrado) ──
  // Reutiliza la misma lógica de la grilla semanal de "Mi Horario" (getBloqueEstado/Info),
  // por lo que requiere que citasSemana esté cargado (se pide también en cargarDatos()).

  get fechaHoyStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get centroCerradoHoy(): boolean { return this.esDiaCerrado(this.fechaHoyStr); }

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


  get fichasSinCompletarCount(): number { return this.pacientesHistorial.filter(p => !p.tiene_ficha).length; }

  get pacientesRecientes(): any[] {
    return [...this.pacientesHistorial]
      .sort((a, b) => (a.dias_desde_ultima_visita ?? Infinity) - (b.dias_desde_ultima_visita ?? Infinity))
      .slice(0, 4);
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

  citasHoy: any[] = [];
  citaEnAtencion: any = null;   // cita con la que se inició la atención actual
  documentosHoy = { total: 0, recetas: 0, justificativos: 0 };   // documentos emitidos hoy (Inicio)

  cargarEstadisticasDia(): void {
    this.http.get<any>(`${API}/profesional/${this.profDbId}/estadisticas-dia`).subscribe({
      next: (data) => {
        this.estadisticasDia = data;
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  cargarDocumentosHoy(): void {
    this.http.get<{ total: number; recetas: number; justificativos: number }>(`${API}/documentos/profesional/${this.profDbId}/hoy`).subscribe({
      next: (d) => { this.documentosHoy = d; this.cdr.detectChanges(); },
      error: () => {}
    });
  }

  /** Citas de hoy ordenadas por hora (agenda del Inicio). */
  get agendaHoyCitas(): any[] {
    return [...this.citasHoy].sort((a, b) => this.convertirA24h(a.hora).localeCompare(this.convertirA24h(b.hora)));
  }

  /** La próxima cita pendiente de hoy que este profesional puede completar. */
  get proximaAtencionPendiente(): any {
    return this.agendaHoyCitas.find(c => c.estado === 'pendiente' && this.puedeGestionarCita(c)) || null;
  }

  get fechaHoyLarga(): string {
    return new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ── Inicio: avance del día ──
  get atencionesHoyTotal(): number { return this.citasHoy.filter(c => c.estado !== 'cancelada').length; }
  get atencionesHoyRealizadas(): number { return this.citasHoy.filter(c => c.estado === 'completada').length; }
  get avanceHoyPct(): number {
    const total = this.atencionesHoyTotal;
    return total ? Math.round((this.atencionesHoyRealizadas / total) * 100) : 0;
  }

  /** La primera cita pendiente de hoy está "En espera"; las siguientes, "Programadas". */
  esEnEspera(c: any): boolean { return c.estado === 'pendiente' && this.proximaAtencionPendiente?.id === c.id; }

  claseEstadoAgenda(c: any): string {
    if (c.estado === 'pendiente') return this.esEnEspera(c) ? 'espera' : 'programada';
    return c.estado;
  }

  etiquetaEstadoAgenda(c: any): string {
    switch (this.claseEstadoAgenda(c)) {
      case 'completada':   return 'Completada';
      case 'espera':       return 'En espera';
      case 'inasistencia': return 'Inasistencia';
      case 'cancelada':    return 'Cancelada';
      default:             return 'Programada';
    }
  }

  iniciales(nombre: string | null | undefined): string { return inicialesDe(nombre); }

  textoUltimaAtencion(p: any): string {
    const d = p?.dias_desde_ultima_visita;
    if (d === null || d === undefined) return 'Sin visitas';
    if (d === 0) return 'Hoy';
    if (d === 1) return 'Ayer';
    return `Hace ${d} días`;
  }

  private haceDias(fecha: string): string {
    const dias = Math.round((new Date(this.hoyStr() + 'T00:00:00').getTime() - new Date(fecha + 'T00:00:00').getTime()) / 86400000);
    if (dias <= 0) return 'Hoy';
    return dias === 1 ? 'Ayer' : `Hace ${dias} días`;
  }

  /** Lo que conviene revisar hoy, con datos reales: citas sin cerrar, fichas incompletas y solicitudes. */
  get pendientesPorRevisar(): { icono: string; titulo: string; detalle: string; etiqueta: string; tono: string; accion: () => void }[] {
    const lista: { icono: string; titulo: string; detalle: string; etiqueta: string; tono: string; accion: () => void }[] = [];
    for (const c of this.citasSinCerrar.slice(0, 2)) {
      lista.push({ icono: 'pending_actions', titulo: 'Cita sin cerrar', detalle: `${c.estudiante} · ${c.carrera || '—'}`,
                   etiqueta: this.haceDias(c.fecha), tono: 'rojo', accion: () => this.iniciarAtencion(c) });
    }
    for (const p of this.pacientesHistorial.filter(x => !x.tiene_ficha).slice(0, 2)) {
      lista.push({ icono: 'description', titulo: 'Ficha clínica incompleta', detalle: `${p.nombre} · ${p.carrera || '—'}`,
                   etiqueta: this.textoUltimaAtencion(p), tono: 'naranjo', accion: () => this.irAFichaPacienteReciente(p) });
    }
    const n = this.solicitudesPendientesTotal;
    if (n > 0) {
      lista.push({ icono: 'inbox', titulo: `${n} solicitud${n === 1 ? '' : 'es'} pendiente${n === 1 ? '' : 's'}`,
                   detalle: 'Revisa y gestiona nuevas solicitudes', etiqueta: 'Pendiente', tono: '', accion: () => this.navegarA('solicitudes') });
    }
    return lista.slice(0, 4);
  }

  // El recordatorio se puede cerrar y no vuelve a aparecer en este navegador.
  recuerdaVisible = (() => { try { return localStorage.getItem('prof_recuerda_cerrado') !== '1'; } catch { return true; } })();
  cerrarRecuerda(): void {
    this.recuerdaVisible = false;
    try { localStorage.setItem('prof_recuerda_cerrado', '1'); } catch { /* sin almacenamiento: solo se oculta ahora */ }
  }

  // ── Flujo de atención: Inicio → historial del paciente → "Registrar atención" ──
  /** Abre el historial del paciente con el contexto de la cita; desde ahí se registra la atención. */
  iniciarAtencion(cita: any): void {
    if (!cita?.estudiante_id) return;
    const fichaAbierta = this.pacienteSeleccionado;
    this.navegarA('historial-clinico');
    if (fichaAbierta && this.pacienteSeleccionado === fichaAbierta) return;   // decidió quedarse con cambios sin guardar
    this.citaEnAtencion = cita;
    this.abrirFichaPaciente({ estudiante_id: cita.estudiante_id, nombre: cita.estudiante });
  }

  /** Vuelve al buscador de pacientes (pide confirmación solo si hay antecedentes sin guardar). */
  volverAPacientes(): void {
    if (!this.confirmarSalidaFicha()) return;
    this.cerrarFichaPaciente();
  }

  get fichaTieneCambios(): boolean {
    return this.fichaEnEdicion && JSON.stringify(this.fichaRespuestas) !== this.fichaRespuestasInicial;
  }

  private confirmarSalidaFicha(): boolean {
    return !this.fichaTieneCambios || window.confirm('Tienes cambios sin guardar en los antecedentes. ¿Salir sin guardar?');
  }

  get puedeRegistrarAtencion(): boolean {
    const pendiente = this.fichaCitaPendienteActual;
    return !!pendiente && this.puedeGestionarCita(pendiente);
  }

  get motivoSinAtencion(): string {
    const pendiente = this.fichaCitaPendienteActual;
    if (!pendiente) return 'No hay una cita pendiente con este estudiante. Podrás registrar la atención cuando tenga una hora agendada.';
    if (!this.puedeGestionarCita(pendiente)) return `La cita es el ${pendiente.fecha.split('-').reverse().join('/')}; podrás registrar la atención desde ese día.`;
    return '';
  }

  /** La cita con la que se inició la atención, mientras siga pendiente y sea de este paciente. */
  get citaContextoAtencion(): any {
    const c = this.citaEnAtencion;
    if (!c || !this.pacienteSeleccionado || c.estudiante_id !== this.pacienteSeleccionado.estudiante_id) return null;
    return this.fichaCitas.find(x => x.id === c.id && x.estado === 'pendiente') || (this.fichaCitas.length === 0 ? c : null);
  }

  etiquetaCitaContexto(c: any): string {
    return `Atención ${c.fecha === this.hoyStr() ? 'de hoy' : 'del ' + c.fecha.split('-').reverse().join('/')} · ${c.hora}`;
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
    if (feriado) info.push(`Feriado: ${feriado.nombre}`);
    for (const d of obtenerDiasInternacionales(fecha)) info.push(d.nombre);
    return info;
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
    return this.atenciones.filter(a =>
      coincideBusqueda(
        this.filtroBusquedaAt,
        a.estudiante,
        a.rut,
        a.carrera,
      )
    );
  }

  get atencionesPaginadas(): any[] { return this.atencionesFiltradas.slice((this.pagAtenciones-1)*8, this.pagAtenciones*8); }

  getPaginasAt(): number[] {
    const total = Math.ceil(this.atencionesFiltradas.length / 8);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  minVal(a: number, b: number): number { return Math.min(a, b); }

  // La pantalla "Completar atención" vive en su propio componente
  // (completar-atencion/): aquí solo se abre, se cierra y se refrescan las listas.
  abrirModalCompletar(cita: any): void {
    if (!this.puedeGestionarCita(cita)) return;
    this.citaParaCompletar = cita;
    this.modalCompletarAbierto = true;
  }

  cerrarModalCompletar(): void { this.modalCompletarAbierto = false; this.citaParaCompletar = null; }

  /** Datos del paciente para la pantalla: desde la cita (listas) o desde la ficha abierta. */
  get pacienteParaCompletar(): PacienteAtencion {
    const c = this.citaParaCompletar;
    if (c?.estudiante) return { nombre: c.estudiante, rut: c.rut, carrera: c.carrera };
    return {
      nombre: this.pacienteSeleccionado?.nombre || '—',
      rut: this.fichaEstudianteRut,
      carrera: this.fichaEstudianteCarrera
    };
  }

  onAtencionCompletada(documentos: DocumentoEmitido[]): void {
    this.cerrarModalCompletar();
    this.cargarAtenciones();
    this.cargarEstadisticasDia();
    this.cargarDocumentosHoy();
    this.cargarCitasHoy();
    this.cargarCitasSinCerrar();
    this.refrescarCitasPendientesSiCorresponde();
    this.mensajeExito = documentos.length
      ? `Atención completada. Se emitió${documentos.length > 1 ? 'ron' : ''} ${documentos.map(d => d.nombre_tipo.toLowerCase()).join(' y ')} y se envió al estudiante.`
      : 'Atención completada correctamente.';
    this.cdr.detectChanges();
    setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 4000);
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
    if (!this.passwordCumpleReglas) { this.mensajeError = 'La nueva contraseña no cumple todos los requisitos de seguridad.'; setTimeout(() => this.mensajeError = '', 3000); return; }
    if (this.configPerfil.contrasena_nueva === this.configPerfil.contrasena_actual) { this.mensajeError = 'La nueva contraseña debe ser diferente a la contraseña actual.'; setTimeout(() => this.mensajeError = '', 3000); return; }
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
  fichaRespuestasInicial = '';   // para saber si hay antecedentes sin guardar
  fichaCuestionarioSolicitado = false;   // ¿este estudiante recibirá el cuestionario previo?
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
    let lista = this.pacientesHistorial;
    if (this.busquedaPaciente.trim()) {
      lista = lista.filter(p =>
        coincideBusqueda(
          this.busquedaPaciente,
          p.nombre,
          p.rut,
          p.correo,
        )
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
        this.fichaRespuestasInicial = JSON.stringify(this.fichaRespuestas);
        this.fichaExiste      = data.existe;
        this.fichaCuestionarioSolicitado = data.cuestionario_solicitado ?? false;
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
    this.citaEnAtencion = null;
    this.fichaPreguntas  = [];
    this.fichaRespuestas = {};
    this.fichaCitas = [];
    this.fichaTab = 'resumen';
  }

  // ── Datos derivados para la vista de ficha estilo "Historial clínico" ──

  /** Vuelve a cargar la ficha abierta (tras anular un documento o decidir el cuestionario) sin cambiar de pestaña. */
  recargarFicha(): void {
    if (!this.pacienteSeleccionado) return;
    const pestana = this.fichaTab;
    this.abrirFichaPaciente(this.pacienteSeleccionado);
    this.fichaTab = pestana;   // abrirFichaPaciente la reinicia
  }

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
    const enAtencion = this.citaEnAtencion
      ? this.fichaCitas.find(c => c.id === this.citaEnAtencion.id && c.estado === 'pendiente')
      : null;
    return enAtencion || this.fichaCitas.find(c => c.estado === 'pendiente') || null;
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