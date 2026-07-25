import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:8080';

@Component({
  selector: 'app-dashboard-estudiante',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-estudiante.html',
  styleUrl: './dashboard-estudiante.css',
  encapsulation: ViewEncapsulation.None
})
export class DashboardEstudianteComponent implements OnInit {

  seccionActiva  = 'agendar';
  pasoAgendar    = 1;
  busqueda       = '';
  filtroArea     = '';
  horaSeleccionada   = '';
  observaciones      = '';
  filtroProfesional  = '';
  filtroEspecialidad = '';
  filtroFecha        = '';
  profesionalSeleccionado: any = null;
  cargando       = false;
  mensajeExito   = '';
  mensajeError   = '';

  // Paginación de profesionales
  pagProf       = 0;
  profPorPagina = 6;

  get estudianteId(): number {
    return Number(localStorage.getItem('usuario_id')) || 1;
  }
  get estudianteNombre(): string {
    return this.estudianteData?.nombre || 'Estudiante';
  }
  get estudianteIniciales(): string {
    const nombre = this.estudianteNombre;
    const partes = nombre.split(' ');
    return partes.length >= 2
      ? partes[0][0] + partes[1][0]
      : nombre.substring(0, 2).toUpperCase();
  }

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarProfesionales();
    this.cargarDatosEstudiante();
    this.cargarNotificaciones();
    this.cargarInfoCentro();
  }

  // ══════════════════════════════════════
  // INFORMACIÓN DEL CENTRO
  // ══════════════════════════════════════

  infoCentro: any = {
    nombre_centro:    'SESAES',
    direccion:        'José Pedro Alessandri 1200, Ñuñoa',
    telefono:         '',
    correo_contacto:  '',
    horario_atencion: 'Lunes a Viernes 08:00–18:00'
  };

  cargarInfoCentro(): void {
    this.http.get<any>(`${API}/configuracion-centro`).subscribe({
      next: (data) => { this.infoCentro = data ?? this.infoCentro; },
      error: () => {}
    });
  }

  // ══════════════════════════════════════
  // NOTIFICACIONES
  // ══════════════════════════════════════

  notificaciones: any[] = [];
  notifPanelAbierto     = false;
  notifNoLeidas         = 0;

  cargarNotificaciones(): void {
    this.http.get<any[]>(`${API}/notificaciones/${this.estudianteId}`).subscribe({
      next: (data) => {
        this.notificaciones = data ?? [];
        this.notifNoLeidas  = this.notificaciones.filter(n => !n.leida).length;
      },
      error: () => {}
    });
  }

  toggleNotificaciones(): void { this.notifPanelAbierto = !this.notifPanelAbierto; }

  marcarNotifLeida(n: any): void {
    if (n.leida) return;
    this.http.patch(`${API}/notificaciones/${n.id}/leer`, {}).subscribe({
      next: () => { n.leida = true; this.notifNoLeidas = Math.max(0, this.notifNoLeidas - 1); }
    });
  }

  eliminarNotificacion(n: any, event: Event): void {
    event.stopPropagation();
    this.http.delete(`${API}/notificaciones/${n.id}`).subscribe({
      next: () => {
        if (!n.leida) this.notifNoLeidas = Math.max(0, this.notifNoLeidas - 1);
        this.notificaciones = this.notificaciones.filter(x => x.id !== n.id);
      }
    });
  }

  eliminarTodasNotificaciones(): void {
    this.http.delete(`${API}/notificaciones/eliminar-todas/${this.estudianteId}`).subscribe({
      next: () => { this.notificaciones = []; this.notifNoLeidas = 0; }
    });
  }

  reagendarDesdeCancelacion(n: any): void {
    this.notifPanelAbierto = false;
    this.seccionActiva     = 'agendar';
    this.pasoAgendar       = 1;
    this.marcarNotifLeida(n);
  }

  // ══════════════════════════════════════
  // PROFESIONALES — con paginación
  // ══════════════════════════════════════

  cargarProfesionales(): void {
    this.http.get<any[]>(`${API}/profesionales`).subscribe({
      next: (data) => {
        if (data?.length) {
          this.profesionales = data.map(p => ({
            ...p,
            iniciales: p.iniciales ?? this.calcularIniciales(p.nombre)
          }));
        }
      },
      error: () => {}
    });
  }

  private calcularIniciales(nombre: string): string {
    const partes = nombre.split(' ');
    return partes.length >= 2
      ? partes[0][0] + partes[1][0]
      : nombre.substring(0, 2).toUpperCase();
  }

  cargarProximasCitas(): void {
    this.http.get<any[]>(`${API}/citas/estudiante/${this.estudianteId}`).subscribe({
      next: (data) => { this.proximasCitas = data ?? []; },
      error: () => {}
    });
  }

  cargarHistorial(): void {
    this.http.get<any[]>(`${API}/historial/estudiante/${this.estudianteId}`).subscribe({
      next: (data) => { this.historialCompleto = data ?? []; },
      error: () => {}
    });
  }

  navegarA(seccion: string): void {
    this.seccionActiva     = seccion;
    this.mensajeExito      = '';
    this.mensajeError      = '';
    this.notifPanelAbierto = false;
  }

  cerrarSesion(): void {
    localStorage.clear();
    window.location.href = '/login';
  }

  profesionales: any[] = [];

  // Filtrado + paginación de profesionales
  get profesionalesFiltradosTotal(): any[] {
    return this.profesionales.filter(p => {
      const q = this.busqueda.toLowerCase();
      return (p.nombre.toLowerCase().includes(q) || p.especialidad.toLowerCase().includes(q))
        && (this.filtroArea === '' || p.especialidad === this.filtroArea);
    });
  }

  profesionalesFiltrados(): any[] {
    const todos = this.profesionalesFiltradosTotal;
    return todos.slice(this.pagProf * this.profPorPagina, (this.pagProf + 1) * this.profPorPagina);
  }

  get hayPaginaAnterior(): boolean { return this.pagProf > 0; }
  get hayPaginaSiguiente(): boolean {
    return (this.pagProf + 1) * this.profPorPagina < this.profesionalesFiltradosTotal.length;
  }

  paginaAnteriorProf(): void { if (this.hayPaginaAnterior) this.pagProf--; }
  paginaSiguienteProf(): void { if (this.hayPaginaSiguiente) this.pagProf++; }

  // Especialidades dinámicas desde backend
  get especialidadesDisponibles(): string[] {
    return Array.from(new Set(this.profesionales.map(p => p.especialidad).filter(Boolean)));
  }

  // ══════════════════════════════════════
  // CALENDARIO MENSUAL
  // ══════════════════════════════════════

  mesVisible    = new Date().getMonth();
  anioVisible   = new Date().getFullYear();
  diasMes: any[] = [];
  fechaSeleccionada: string | null = null;
  horasDisponibles: string[] = [];
  mensajeDisponibilidad: string | null = null;
  calendarioAbierto = false;

  private _cargandoDisponibilidad = false;
  private _ultimaFechaPedida: string | null = null;

  readonly NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  get nombreMesVisible(): string {
    return `${this.NOMBRES_MES[this.mesVisible]} ${this.anioVisible}`;
  }

  private hoyStr(): string {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}-${String(h.getDate()).padStart(2,'0')}`;
  }

  seleccionarProfesional(p: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.profesionalSeleccionado = p;
    this.horaSeleccionada = ''; this.fechaSeleccionada = null;
    this.horasDisponibles = []; this.mensajeDisponibilidad = null;
    this.calendarioAbierto = false; this._ultimaFechaPedida = null;
    this.pasoAgendar = 2;
    const hoy = new Date();
    this.mesVisible  = hoy.getMonth();
    this.anioVisible = hoy.getFullYear();
    this.generarCalendario();
  }

  toggleCalendario(): void { this.calendarioAbierto = !this.calendarioAbierto; }

  generarCalendario(): void {
    const primerDia = new Date(this.anioVisible, this.mesVisible, 1);
    const ultimoDia = new Date(this.anioVisible, this.mesVisible + 1, 0);
    const hoyStr    = this.hoyStr();
    const offset    = (primerDia.getDay() + 6) % 7;
    const celdas: any[] = [];
    for (let i = 0; i < offset; i++) celdas.push(null);
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fecha     = new Date(this.anioVisible, this.mesVisible, dia);
      const fechaStr  = `${this.anioVisible}-${String(this.mesVisible+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
      const diaSemana = fecha.getDay();
      const esFinde   = diaSemana === 0 || diaSemana === 6;
      const esPasado  = fechaStr < hoyStr;
      celdas.push({ num: dia, fecha: fechaStr, esFinde, esPasado, esHoy: fechaStr === hoyStr, deshabilitado: esFinde || esPasado });
    }
    this.diasMes = celdas;
  }

  mesAnterior(): void {
    this.mesVisible--;
    if (this.mesVisible < 0) { this.mesVisible = 11; this.anioVisible--; }
    this.generarCalendario();
  }

  mesSiguiente(): void {
    this.mesVisible++;
    if (this.mesVisible > 11) { this.mesVisible = 0; this.anioVisible++; }
    this.generarCalendario();
  }

  seleccionarDia(dia: any): void {
    if (!dia || dia.deshabilitado) return;
    if (this.fechaSeleccionada === dia.fecha) { this.calendarioAbierto = false; return; }
    this.fechaSeleccionada = dia.fecha;
    this.horaSeleccionada  = '';
    this.calendarioAbierto = false;
    this.cargarDisponibilidad();
  }

  cargarDisponibilidad(): void {
    if (!this.profesionalSeleccionado || !this.fechaSeleccionada) return;
    if (this._ultimaFechaPedida === this.fechaSeleccionada && this._cargandoDisponibilidad) return;
    const profesionalId = this.profesionalSeleccionado.profesional_id ?? this.profesionalSeleccionado.id;
    if (!profesionalId) { this.mensajeDisponibilidad = 'No se pudo identificar al profesional.'; return; }
    this._ultimaFechaPedida      = this.fechaSeleccionada;
    this._cargandoDisponibilidad = true;
    this.cargando                = true;
    this.horasDisponibles        = [];
    this.mensajeDisponibilidad   = null;
    this.http.get<any>(`${API}/disponibilidad/${profesionalId}?fecha=${this.fechaSeleccionada}`).subscribe({
      next: (data) => {
        this.horasDisponibles      = data?.horas   ?? [];
        this.mensajeDisponibilidad = data?.mensaje ?? null;
        if (this.horasDisponibles.length > 0) this.mensajeDisponibilidad = null;
        this.cargando = false; this._cargandoDisponibilidad = false;
      },
      error: (err) => {
        this.mensajeDisponibilidad   = err?.error?.detail ?? 'No se pudo cargar la disponibilidad.';
        this.cargando = false; this._cargandoDisponibilidad = false;
      }
    });
  }

  seleccionarHora(hora: string): void { this.horaSeleccionada = hora; }
  getHoraDisplay(): string { return this.horaSeleccionada || ''; }

  getFechaDisplay(): string {
    if (!this.fechaSeleccionada) return '';
    const [anio, mes, dia] = this.fechaSeleccionada.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    const nombresDia = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    return `${nombresDia[fecha.getDay()]} ${dia} de ${this.NOMBRES_MES[mes-1]}, ${anio}`;
  }

  confirmarCita(): void {
    this.mensajeError = '';
    const duplicada = this.proximasCitas.find(
      c => c.especialidad === this.profesionalSeleccionado?.especialidad && c.estado === 'pendiente'
    );
    if (duplicada) {
      this.mensajeError = 'Ya tienes una cita pendiente en esta especialidad.';
      return;
    }
    const profesionalId = this.profesionalSeleccionado.profesional_id ?? this.profesionalSeleccionado.id;
    this.http.post<any>(`${API}/citas`, {
      estudiante_id: this.estudianteId, profesional_id: profesionalId,
      fecha: this.fechaSeleccionada || '', hora: this.getHoraDisplay(),
      observaciones: this.observaciones || null
    }).subscribe({
      next: (resp) => {
        this.proximasCitas.push({
          id: resp.id, iniciales: resp.iniciales, especialidad: resp.especialidad,
          profesional: resp.profesional, fecha: this.getFechaDisplay(),
          hora: resp.hora, urgente: false, aviso: resp.aviso, estado: resp.estado
        });
        this.resetAgendar();
        this.mensajeExito  = '✓ ¡Tu hora fue agendada correctamente!';
        this.seccionActiva = 'citas';
      },
      error: (err) => { this.mensajeError = err?.error?.detail || 'No se pudo agendar la cita.'; }
    });
  }

  private resetAgendar(): void {
    this.pasoAgendar = 1; this.profesionalSeleccionado = null;
    this.horaSeleccionada = ''; this.fechaSeleccionada = null;
    this.horasDisponibles = []; this.observaciones = '';
    this.calendarioAbierto = false; this._ultimaFechaPedida = null;
  }

  // ══════════════════════════════════════
  // MIS CITAS
  // ══════════════════════════════════════

  proximasCitas: any[] = [];

  private diffHorasParaCancelar(cita: any): number | null {
    if (!cita.fecha_raw || !cita.hora) return null;
    const horaMatch = cita.hora.match(/(\d{1,2}):(\d{2})/);
    if (!horaMatch) return null;
    const fechaHora = new Date(`${cita.fecha_raw}T${horaMatch[1].padStart(2,'0')}:${horaMatch[2]}:00`);
    return (fechaHora.getTime() - Date.now()) / (1000 * 60 * 60);
  }

  puedeCancelar(cita: any): boolean {
    const diff = this.diffHorasParaCancelar(cita);
    if (diff === null) return true;
    return diff > 5;
  }

  avisoCancelacion(cita: any): string {
    const diff = this.diffHorasParaCancelar(cita);
    if (diff === null) return '';
    if (diff <= 0) return 'Esta cita ya pasó';
    const horas = Math.floor(diff); const minutos = Math.round((diff - horas) * 60);
    if (horas === 0) return `Faltan ${minutos} min, no se puede cancelar`;
    if (minutos === 0) return `Faltan ${horas}h, no se puede cancelar`;
    return `Faltan ${horas}h ${minutos}min, no se puede cancelar`;
  }

  cancelarCita(index: number, cita: any): void {
    if (!confirm('¿Estás seguro de que deseas cancelar esta cita?')) return;
    this.http.delete(`${API}/citas/${cita.id}`).subscribe({
      next: () => { this.proximasCitas.splice(index, 1); this.cargarHistorial(); },
      error: (err) => { alert(err?.error?.detail || 'No se pudo cancelar la cita.'); }
    });
  }

  reagendarCita(cita: any): void {
    const prof = this.profesionales.find(p => p.nombre === cita.profesional);
    if (prof) { this.seccionActiva = 'agendar'; this.seleccionarProfesional(prof); }
    else { this.seccionActiva = 'agendar'; this.pasoAgendar = 1; }
  }

  descargarPdf(citaId: number): void { window.open(`${API}/citas/${citaId}/pdf`, '_blank'); }

  // ══════════════════════════════════════
  // HISTORIAL
  // ══════════════════════════════════════

  historialCompleto: any[] = [];

  historialResumen() { return this.historialCompleto.slice(0, 3); }

  historialFiltrado() {
    return this.historialCompleto.filter(h => {
      const matchProf  = !this.filtroProfesional  || h.profesional.toLowerCase().includes(this.filtroProfesional.toLowerCase());
      const matchEsp   = !this.filtroEspecialidad || h.especialidad === this.filtroEspecialidad;
      const matchFecha = !this.filtroFecha         || h.fechaRaw === this.filtroFecha;
      return matchProf && matchEsp && matchFecha;
    });
  }

  limpiarFiltros(): void { this.filtroProfesional = ''; this.filtroEspecialidad = ''; this.filtroFecha = ''; }

  get totalCitas()       { return this.historialCompleto.length; }
  get citasCompletadas() { return this.historialCompleto.filter(h => h.estado === 'completada').length; }
  get citasCanceladas()  { return this.historialCompleto.filter(h => h.estado === 'cancelada').length; }

  // ══════════════════════════════════════
  // CONFIGURACIÓN
  // ══════════════════════════════════════

  estudianteData: any  = null;
  celularOriginal      = '';
  celularEditable      = '';
  celularEnEdicion     = false;
  fotoPerfilUrl: string | null = null;
  fotoPerfilCambiada   = false;
  temaOscuro           = false;

  get hayCambiosPendientes(): boolean {
    return this.celularEditable !== this.celularOriginal || this.fotoPerfilCambiada;
  }

  cargarDatosEstudiante(): void {
    const id = Number(localStorage.getItem('usuario_id')) || 1;
    this.http.get<any>(`${API}/estudiante/${id}`).subscribe({
      next: (data) => {
        this.estudianteData  = data;
        if (data.id) localStorage.setItem('usuario_id', String(data.id));
        this.celularOriginal = this.extraerDigitosCelular(data.telefono);
        this.celularEditable = this.celularOriginal;
        this.fotoPerfilUrl   = data.foto_url || null;
        this.temaOscuro      = data.tema_oscuro || false;
        document.body.classList.toggle('tema-oscuro', this.temaOscuro);
        this.cargarProximasCitas();
        this.cargarHistorial();
      },
      error: () => { this.cargarProximasCitas(); this.cargarHistorial(); }
    });
  }

  private extraerDigitosCelular(telefono: string | null | undefined): string {
    return (telefono || '').replace(/^\+?56/, '').replace(/\D/g, '').slice(0, 9);
  }

  private formatearCelularCompleto(digitos: string): string {
    return digitos ? `+56 ${digitos}` : '';
  }

  habilitarEdicionCelular(): void { this.celularEnEdicion = true; }

  onCelularChange(valor: string): void {
    this.celularEditable = (valor || '').replace(/\D/g, '').slice(0, 9);
  }

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Por favor selecciona un archivo de imagen válido.'); return; }
    const reader = new FileReader();
    reader.onload = () => { this.fotoPerfilUrl = reader.result as string; this.fotoPerfilCambiada = true; };
    reader.readAsDataURL(file);
    input.value = '';
  }

  toggleTema(oscuro: boolean): void {
    this.temaOscuro = oscuro;
    document.body.classList.toggle('tema-oscuro', oscuro);
    this.http.patch<any>(`${API}/estudiante/${this.estudianteId}`, { tema_oscuro: oscuro }).subscribe({ error: () => {} });
  }

  // Toggle desde el ícono sol/luna del topbar
  toggleTemaRapido(): void {
    this.toggleTema(!this.temaOscuro);
  }

  descartarCambios(): void {
    this.celularEditable    = this.celularOriginal;
    this.celularEnEdicion   = false;
    this.fotoPerfilUrl      = this.estudianteData?.foto_url || null;
    this.fotoPerfilCambiada = false;
  }

  guardarCambios(): void {
    const payload: any = {};
    if (this.celularEditable !== this.celularOriginal) payload.telefono = this.formatearCelularCompleto(this.celularEditable);
    if (this.fotoPerfilCambiada) payload.foto_url = this.fotoPerfilUrl;
    this.http.patch<any>(`${API}/estudiante/${this.estudianteId}`, payload).subscribe({
      next: (data) => {
        this.estudianteData = data;
        this.celularOriginal = this.extraerDigitosCelular(data.telefono);
        this.celularEditable = this.celularOriginal;
        this.fotoPerfilCambiada = false; this.celularEnEdicion = false;
        this.mensajeExito = '✓ Cambios guardados correctamente.';
        setTimeout(() => this.mensajeExito = '', 3000);
      },
      error: () => { this.mensajeError = 'No se pudieron guardar los cambios.'; setTimeout(() => this.mensajeError = '', 3000); }
    });
  }

  abrirComoLlegar(): void {
    window.open('https://www.google.com/maps/dir/?api=1&destination=Jos%C3%A9+Pedro+Alessandri+1200,+%C3%91u%C3%B1oa,+Chile', '_blank');
  }
}