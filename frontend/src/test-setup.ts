/**
 * Preparación global de las pruebas (se carga antes de todos los specs).
 *
 * Desde Node 25 (y en Node 26, que es LTS) el navegador simulado deja de tener
 * `localStorage` si Node se inicia sin `--localstorage-file`: la variable global
 * queda `undefined` y cualquier prueba que haga `localStorage.clear()` falla con
 * "Cannot read properties of undefined". Aquí se instala un almacenamiento en
 * memoria SOLO cuando el real no existe; en Node 22/24 no se toca nada.
 */
class AlmacenEnMemoria {
  private datos = new Map<string, string>();

  get length(): number { return this.datos.size; }
  clear(): void { this.datos.clear(); }
  getItem(clave: string): string | null { return this.datos.has(clave) ? this.datos.get(clave)! : null; }
  key(indice: number): string | null { return Array.from(this.datos.keys())[indice] ?? null; }
  removeItem(clave: string): void { this.datos.delete(clave); }
  setItem(clave: string, valor: string): void { this.datos.set(String(clave), String(valor)); }
}

for (const nombre of ['localStorage', 'sessionStorage'] as const) {
  let funciona = false;
  try {
    funciona = typeof (globalThis as Record<string, any>)[nombre]?.clear === 'function';
  } catch {
    funciona = false;
  }
  if (!funciona) {
    Object.defineProperty(globalThis, nombre, {
      value: new AlmacenEnMemoria() as unknown as Storage,
      configurable: true,
      writable: true,
    });
  }
}
