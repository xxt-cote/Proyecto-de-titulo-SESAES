import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { obtenerFeriado } from '../../shared/feriados-chile';
import { obtenerDiasInternacionales } from '../../shared/dias-internacionales';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-inicio.html'
})
export class AdminInicioComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() estadisticas = {
    reservas_hoy: 0,
    profesionales_activos: 0,
    horas_disponibles: 0,
    urgentes: 0
  };

  @Input() resumenDia: any[] = [];
  @Input() graficoEspecialidad: any[] = [];
  @Input() graficoSemana: any[] = [];
  @Input() proximasCitas: any[] = [];
  @Input() actividadReciente: any[] = [];

  @Input() filtroGraficoAnio: number | string = new Date().getFullYear();
  @Output() filtroGraficoAnioChange = new EventEmitter<number | string>();

  @Input() filtroGraficoCarrera = '';
  @Output() filtroGraficoCarreraChange = new EventEmitter<string>();

  @Output() recargarGraficoEspecialidad = new EventEmitter<void>();
  @Output() exportarEspecialidad = new EventEmitter<void>();
  @Output() exportarSemana = new EventEmitter<void>();
  @Output() verAgenda = new EventEmitter<void>();
  @Output() marcarInasistenciaCita = new EventEmitter<any>();
  @Output() cancelarCita = new EventEmitter<any>();

  @ViewChild('chartEspecialidad')
  chartEspecialidadRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('chartSemana')
  chartSemanaRef!: ElementRef<HTMLCanvasElement>;

  private chartEspecialidad?: Chart;
  private chartSemana?: Chart;

  readonly coloresGrafico = [
    '#2a78d6',
    '#eb6834',
    '#1baf7a',
    '#eda100',
    '#e87ba4',
    '#8b5cf6',
    '#64748b'
  ];

  private readonly meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  calMesVisible = new Date().getMonth();
  calAnioVisible = new Date().getFullYear();
  calDiasMes: any[] = [];
  diaSeleccionadoInfo: string | null = null;

  get aniosDisponiblesGrafico(): number[] {
    const actual = new Date().getFullYear();
    const anios: number[] = [];
    for (let a = actual + 1; a >= actual - 3; a--) anios.push(a);
    return anios;
  }

  get calNombreMesVisible(): string {
    return `${this.meses[this.calMesVisible]} ${this.calAnioVisible}`;
  }

  ngAfterViewInit(): void {
    this.generarCalendarioInicio();
    this.crearGraficos();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graficoEspecialidad']) {
      this.actualizarGraficoEspecialidad();
    }

    if (changes['graficoSemana']) {
      this.actualizarGraficoSemana();
    }
  }

  ngOnDestroy(): void {
    this.chartEspecialidad?.destroy();
    this.chartSemana?.destroy();
  }

  cargarGraficoEspecialidad(): void {
    this.filtroGraficoAnioChange.emit(this.filtroGraficoAnio);
    this.filtroGraficoCarreraChange.emit(this.filtroGraficoCarrera);
    this.recargarGraficoEspecialidad.emit();
  }

  exportarEspecialidadExcel(): void {
    this.exportarEspecialidad.emit();
  }

  exportarSemanaExcel(): void {
    this.exportarSemana.emit();
  }

  navegarA(seccion: string): void {
    if (seccion === 'horario') {
      this.verAgenda.emit();
    }
  }

  marcarInasistencia(cita: any): void {
    this.marcarInasistenciaCita.emit(cita);
  }

  cancelarCitaAdmin(cita: any): void {
    this.cancelarCita.emit(cita);
  }

  getIconoEstadoProf(estado: string): string {
    if (estado === 'activo') return '✅';
    if (estado === 'licencia') return '🔴';
    if (estado === 'inasistencia') return '⚠️';
    return '⚪';
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';

    const [anio, mes, dia] = fecha.split('-').map(Number);
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const dias = [
      'Domingo', 'Lunes', 'Martes', 'Miércoles',
      'Jueves', 'Viernes', 'Sábado'
    ];

    const fechaLocal = new Date(anio, mes - 1, dia);
    return `${dias[fechaLocal.getDay()]} ${dia} de ${meses[mes - 1]}`;
  }

  generarCalendarioInicio(): void {
    const primerDia = new Date(this.calAnioVisible, this.calMesVisible, 1);
    const ultimoDia = new Date(this.calAnioVisible, this.calMesVisible + 1, 0);
    const offset = (primerDia.getDay() + 6) % 7;
    const hoy = new Date();
    const hoyStr =
      `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    const celdas: any[] = [];

    for (let i = 0; i < offset; i++) {
      celdas.push(null);
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fechaStr =
        `${this.calAnioVisible}-${String(this.calMesVisible + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

      celdas.push({
        num: dia,
        fecha: fechaStr,
        esHoy: fechaStr === hoyStr
      });
    }

    this.calDiasMes = celdas;
  }

  calMesAnterior(): void {
    this.calMesVisible--;

    if (this.calMesVisible < 0) {
      this.calMesVisible = 11;
      this.calAnioVisible--;
    }

    this.diaSeleccionadoInfo = null;
    this.generarCalendarioInicio();
  }

  calMesSiguiente(): void {
    this.calMesVisible++;

    if (this.calMesVisible > 11) {
      this.calMesVisible = 0;
      this.calAnioVisible++;
    }

    this.diaSeleccionadoInfo = null;
    this.generarCalendarioInicio();
  }

  seleccionarDiaInfo(dia: any): void {
    if (!dia) return;

    this.diaSeleccionadoInfo =
      this.diaSeleccionadoInfo === dia.fecha ? null : dia.fecha;
  }

  infoDelDia(fecha: string | undefined): string[] {
    if (!fecha) return [];

    const info: string[] = [];
    const feriado = obtenerFeriado(fecha);

    if (feriado) {
      info.push(`🇨🇱 Feriado: ${feriado.nombre}`);
    }

    for (const dia of obtenerDiasInternacionales(fecha)) {
      info.push(`🌍 ${dia.nombre}`);
    }

    return info;
  }

  esFeriado(fecha: string | undefined): boolean {
    return !!(fecha && obtenerFeriado(fecha));
  }

  nombreFeriado(fecha: string | undefined): string {
    return fecha ? obtenerFeriado(fecha)?.nombre ?? '' : '';
  }

  private crearGraficos(): void {
    this.chartEspecialidad?.destroy();
    this.chartSemana?.destroy();

    if (this.chartEspecialidadRef) {
      this.chartEspecialidad = new Chart(
        this.chartEspecialidadRef.nativeElement,
        {
          type: 'doughnut',
          data: {
            labels: [],
            datasets: [{
              data: [],
              backgroundColor: this.coloresGrafico,
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
          }
        }
      );
    }

    if (this.chartSemanaRef) {
      this.chartSemana = new Chart(
        this.chartSemanaRef.nativeElement,
        {
          type: 'line',
          data: {
            labels: [],
            datasets: [{
              data: [],
              borderColor: '#2a78d6',
              backgroundColor: 'rgba(42,120,214,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            }
          }
        }
      );
    }

    this.actualizarGraficoEspecialidad();
    this.actualizarGraficoSemana();
  }

  private actualizarGraficoEspecialidad(): void {
    if (!this.chartEspecialidad) return;

    this.chartEspecialidad.data.labels =
      this.graficoEspecialidad.map(d => d.especialidad);
    this.chartEspecialidad.data.datasets[0].data =
      this.graficoEspecialidad.map(d => d.cantidad);
    this.chartEspecialidad.update();
  }

  private actualizarGraficoSemana(): void {
    if (!this.chartSemana) return;

    this.chartSemana.data.labels =
      this.graficoSemana.map(d => d.dia);
    this.chartSemana.data.datasets[0].data =
      this.graficoSemana.map(d => d.cantidad);
    this.chartSemana.update();
  }
}