import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-estudiantes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-estudiantes.html'
})
export class AdminEstudiantesComponent {
  @Input() estudiantesAdmin: any[] = [];
  @Input() estudiantesTotal = 0;
  @Input() estudiantesPagina = 1;
  @Input() estudiantesPorPagina = 20;
  @Input() estudiantesCargando = false;

  @Input() estudiantesFiltroQ = '';
  @Output() estudiantesFiltroQChange = new EventEmitter<string>();

  @Input() estudiantesFiltroCarrera = '';
  @Output() estudiantesFiltroCarreraChange = new EventEmitter<string>();

  @Input() modalPerfilEstudianteAbierto = false;
  @Input() perfilEstudianteCargando = false;
  @Input() fichaEstudianteSeleccionado: any = null;

  @Output() buscar = new EventEmitter<void>();
  @Output() limpiar = new EventEmitter<void>();
  @Output() cambiarPagina = new EventEmitter<number>();
  @Output() verPerfil = new EventEmitter<any>();
  @Output() cerrarPerfil = new EventEmitter<void>();

  getPaginasEstudiantes(): number[] {
    const total = Math.ceil(this.estudiantesTotal / this.estudiantesPorPagina);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  minVal(a: number, b: number): number {
    return Math.min(a, b);
  }
}