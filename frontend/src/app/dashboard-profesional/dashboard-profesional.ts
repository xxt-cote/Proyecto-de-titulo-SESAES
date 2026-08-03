import { Component, OnInit, ViewEncapsulation, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config';

const API = environment.apiUrl;

@Component({
  selector: 'app-dashboard-profesional',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './dashboard-profesional.html',
  styleUrl: './dashboard-profesional.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardProfesionalComponent implements OnInit {

  seccionActiva = 'inicio';
  temaOscuro    = false;
  mensajeExito  = '';
  mensajeError  = '';

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
      inicio:     'Bienvenido/a',
      agenda:     'Mi Agenda',
      atenciones: 'Mis Atenciones',
      horario:    'Mi Horario',
      perfil:     'Perfil y Configuración'
    };
    return map[this.seccionActiva] ?? 'SESAES';
  }

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const temaGuardado = localStorage.getItem('prof_tema_oscuro');
    if (temaGuardado === 'true') this.temaOscuro = true;
    this.cargarDatos();
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
  }

  navegarA(seccion: string): void {
    this.seccionActiva     = seccion;
    this.mensajeExito      = '';
    this.mensajeError      = '';
    this.notifPanelAbierto = false;
    if (seccion === 'agenda')     this.cargarCitasSemana();
    if (seccion === 'atenciones') this.cargarAtenciones();
    if (seccion === 'horario')    this.cargarSolicitudesHorario();
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
      error: () => {}
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

  get ausenciaFormularioValido(): boolean {
    if (this.ausenciaTipo === 'temporal') return !!this.ausenciaHoraInicio && !!this.ausenciaHoraFin;
    if (this.ausenciaTipo === 'licencia')  return !!this.ausenciaFechaInicio && !!this.ausenciaFechaFin;
    return true; // dia_completo no necesita campos extra
  }

  reportarAusencia(): void {
    if (!this.ausenciaFormularioValido) return;
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
        if (this.seccionActiva === 'agenda') this.cargarCitasSemana();
        this.mensajeExito = 'Ausencia reportada. Se notificó a los estudiantes afectados.';
        this.cdr.detectChanges();
        setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 4000);
      },
      error: (err) => {
        this.mensajeError = err?.error?.detail || 'No se pudo reportar la ausencia.';
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

  semanaAnterior(): void { const l = new Date(this.semanaActual[0].fecha); l.setDate(l.getDate() - 7); this.buildSemana(l); this.cargarCitasSemana(); }
  semanaSiguiente(): void { const l = new Date(this.semanaActual[0].fecha); l.setDate(l.getDate() + 7); this.buildSemana(l); this.cargarCitasSemana(); }
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

  getBloqueEstado(fecha: string, hora: string): string {
    if (this.esHoraDeColacion(hora)) return 'bloqueado';
    const cita = this.citasSemana.find(c => c.fecha === fecha && c.hora?.startsWith(hora.substring(0,5)));
    if (!cita) return 'libre';
    return cita.urgente ? 'urgente' : 'ocupado';
  }

  getBloqueInfo(fecha: string, hora: string): string {
    if (this.esHoraDeColacion(hora)) return 'Colación';
    const cita = this.citasSemana.find(c => c.fecha === fecha && c.hora?.startsWith(hora.substring(0,5)));
    return cita ? cita.estudiante : '';
  }

  get citasDiaSeleccionado(): any[] {
    if (!this.diaSeleccionado) return [];
    return this.citasSemana.filter(c => c.fecha === this.diaSeleccionado);
  }

  clickBloque(fecha: string, hora: string): void { this.diaSeleccionado = fecha; }

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

  get atencionesFiltradas(): any[] {
    const q = this.filtroBusquedaAt.toLowerCase();
    return !q ? this.atenciones : this.atenciones.filter(a => a.estudiante.toLowerCase().includes(q) || (a.rut || '').includes(q));
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

guardarHorarioAlmuerzo(): void {
  if (!this.almuerzoHoraInicio) return;
  this.http.post<any>(`${API}/profesional/${this.profDbId}/solicitar-colacion`, {
    hora_almuerzo_inicio: this.almuerzoHoraInicio
  }).subscribe({
    next: (resp) => {
      this.horarioAlmuerzoEnEdicion = false;
      this.mensajeExito = `Solicitud enviada: colación ${resp.hora_inicio} - ${resp.hora_fin}. Queda pendiente de aprobación del administrador.`;
      this.cargarSolicitudesHorario();
      this.cdr.detectChanges();
      setTimeout(() => { this.mensajeExito = ''; this.cdr.detectChanges(); }, 4000);
    },
    error: (err) => {
      this.mensajeError = err?.error?.detail || 'No se pudo enviar la solicitud de colación.';
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

  onFotoSeleccionada(event: any): void {
    if (!this.perfilEnEdicion) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.perfil.foto_url = e.target.result;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
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
}