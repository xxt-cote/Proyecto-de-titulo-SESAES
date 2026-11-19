import { Pipe, PipeTransform } from '@angular/core';
import { formatoCentro } from './tiempo-centro';

@Pipe({ name: 'fechaCentro', standalone: true })
export class FechaCentroPipe implements PipeTransform {
  transform(valor: string | Date | number | null | undefined, formato = 'dd/MM/yyyy HH:mm'): string {
    return valor == null ? '' : formatoCentro(valor, formato);
  }
}
