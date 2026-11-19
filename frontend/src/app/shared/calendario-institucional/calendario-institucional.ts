import { calendarioCentro } from '../tiempo-centro';
import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { obtenerFeriado } from '../feriados-chile';
import { obtenerDiasInternacionales } from '../dias-internacionales';

export interface CeldaCalendario {
  num: number;
  /** YYYY-MM-DD */
  fecha: string;
  esHoy: boolean;
  otroMes: boolean;
  feriado: string | null;
  tieneDiasInternacionales: boolean;
}

export const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const aIso = (anio: number, mes0: number, dia: number): string =>
  `${anio}-${String(mes0 + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/**
 * Calendario institucional compartido por los cuatro roles. Solo informativo:
 * feriados de Chile y días internacionales (helpers compartidos ya
 * existentes). NO lee ni duplica la lógica de Agenda (disponibilidad,
 * sobrecupo, bloqueos, jornada, urgencias).
 */
@Component({
  selector: 'app-calendario-institucional',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendario-institucional.html',
  styleUrl: './calendario-institucional.css'
})
export class CalendarioInstitucionalComponent implements OnChanges {
  @Input() titulo = 'Calendario';
  @Input() fechasConCita: readonly string[] = [];
  @Input() mostrarAdyacentes = false;
  ngOnChanges(): void { this.generar(); }
  tieneCita(fecha: string): boolean { return this.fechasConCita.includes(fecha); }

  readonly diasSemana = DIAS_SEMANA;

  anioVisible: number;
  mesVisible: number; // 0-11
  celdas: (CeldaCalendario | null)[] = [];
  diaSeleccionado: string | null = null;

  constructor() {
    const hoy = calendarioCentro();
    this.anioVisible = hoy.getFullYear();
    this.mesVisible = hoy.getMonth();
    this.generar();
  }

  get tituloMes(): string {
    return `${NOMBRES_MES[this.mesVisible]} ${this.anioVisible}`;
  }

  generar(): void {
    const primerDia = new Date(this.anioVisible, this.mesVisible, 1);
    const diasEnMes = new Date(this.anioVisible, this.mesVisible + 1, 0).getDate();
    const desfase = (primerDia.getDay() + 6) % 7; // semana parte en lunes

    const hoy = calendarioCentro();
    const hoyIso = aIso(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    const celdas: (CeldaCalendario | null)[] = this.mostrarAdyacentes ? [] : Array(desfase).fill(null);
    const inicio = this.mostrarAdyacentes ? 1 - desfase : 1;
    const fin = this.mostrarAdyacentes ? Math.ceil((desfase + diasEnMes) / 7) * 7 - desfase : diasEnMes;
    for (let dia = inicio; dia <= fin; dia++) {
      const civil = new Date(this.anioVisible, this.mesVisible, dia);
      const fecha = aIso(civil.getFullYear(), civil.getMonth(), civil.getDate());
      celdas.push({
        num: civil.getDate(), fecha,
        otroMes: civil.getMonth() !== this.mesVisible,
        esHoy: fecha === hoyIso,
        feriado: obtenerFeriado(fecha)?.nombre ?? null,
        tieneDiasInternacionales: obtenerDiasInternacionales(fecha).length > 0
      });
    }

    this.celdas = celdas;
  }

  mesAnterior(): void {
    this.mesVisible--;
    if (this.mesVisible < 0) {
      this.mesVisible = 11;
      this.anioVisible--;
    }
    this.diaSeleccionado = null;
    this.generar();
  }

  mesSiguiente(): void {
    this.mesVisible++;
    if (this.mesVisible > 11) {
      this.mesVisible = 0;
      this.anioVisible++;
    }
    this.diaSeleccionado = null;
    this.generar();
  }

  seleccionar(celda: CeldaCalendario | null): void {
    if (!celda) return;
    this.diaSeleccionado = this.diaSeleccionado === celda.fecha ? null : celda.fecha;
  }

  /** Detalle informativo del día seleccionado. */
  get infoDiaSeleccionado(): string[] {
    if (!this.diaSeleccionado) return [];

    const info: string[] = [];
    const feriado = obtenerFeriado(this.diaSeleccionado);
    if (feriado) info.push(`Feriado: ${feriado.nombre}`);

    for (const dia of obtenerDiasInternacionales(this.diaSeleccionado)) {
      info.push(dia.nombre);
    }
    return info;
  }

  get tituloDiaSeleccionado(): string {
    if (!this.diaSeleccionado) return '';
    const [anio, mes, dia] = this.diaSeleccionado.split('-').map(Number);
    return `${dia} de ${NOMBRES_MES[mes - 1].toLowerCase()} de ${anio}`;
  }
}
