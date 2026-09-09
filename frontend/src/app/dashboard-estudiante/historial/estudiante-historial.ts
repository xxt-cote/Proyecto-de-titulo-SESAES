import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { normalizarTexto } from '../../shared/text-normalization';

// ══════════════════════════════════════════════════════════════════
// EstudianteHistorialComponent — Student 5A (extracción presentacional)
//
// Este componente NO hace HTTP. Recibe el historial ya cargado por
// DashboardEstudianteComponent vía @Input y solo se encarga de:
// filtrar localmente para su propia tabla, mostrar los stats y
// avisar al shell (vía @Output) cuando el estudiante quiere reagendar,
// ver el detalle de una atención o descargar un PDF — esas acciones
// siguen resolviéndose en el shell porque son compartidas con Inicio
// y/o implican HTTP.
// ══════════════════════════════════════════════════════════════════
@Component({
  selector: 'app-estudiante-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './estudiante-historial.html',
  styleUrl: './estudiante-historial.css'
})
export class EstudianteHistorialComponent implements OnChanges {

  // -- Datos que el shell ya obtuvo del backend --
  @Input() historial: any[] = [];
  @Input() totalCitas = 0;
  @Input() citasCompletadas = 0;
  @Input() citasCanceladas = 0;
  @Input() especialidadesDisponibles: string[] = [];

  // -- Acciones que el shell debe resolver (HTTP, navegación o modal compartido) --
  @Output() reagendar = new EventEmitter<any>();
  @Output() verDetalle = new EventEmitter<any>();
  @Output() descargarPdf = new EventEmitter<number>();

  // -- Filtros locales de esta sección (no se comparten con ninguna otra) --
  filtroProfesional = '';
  filtroEspecialidad = '';
  filtroFecha = '';

  // Lista efectivamente mostrada en la tabla (todo el historial hasta que
  // se presiona "Filtrar", igual que en el shell original).
  historialMostrado: any[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['historial']) {
      this.historialMostrado = this.historial;
    }
  }

  historialFiltrado(): void {
    this.historialMostrado = this.historial.filter(h => {
      const filtroProf = normalizarTexto(this.filtroProfesional);
      const matchProf  = !filtroProf || normalizarTexto(h.profesional).includes(filtroProf);
      const matchEsp   = !this.filtroEspecialidad || h.especialidad === this.filtroEspecialidad;
      const matchFecha = !this.filtroFecha         || h.fechaRaw === this.filtroFecha;
      return matchProf && matchEsp && matchFecha;
    });
  }

  limpiarFiltros(): void {
    this.filtroProfesional = '';
    this.filtroEspecialidad = '';
    this.filtroFecha = '';
    this.historialMostrado = this.historial;
  }
}
