# Cómo contribuir

## 1. Preparar el entorno

Leer README.md, docs/INSTALACION.md y docs/ARQUITECTURA.md.
Utilizar una base propia de desarrollo y otra desechable para PostgreSQL tests.
No pedir ni copiar un dump con información real para preparar el entorno.

## 2. Trabajar en una rama

Desde un repositorio limpio:

```powershell
git switch main
git pull --ff-only
git switch -c mejora/descripcion-breve
```

Si tiene cambios locales sin guardar, revíselos antes de cambiar de rama.
No usar reset --hard, clean ni force push para ocultar un conflicto.

## 3. Hacer cambios coherentes

- Mantener el backend como autoridad de permisos y validaciones.
- Distinguir Usuario.id de Profesional.id.
- Utilizar las funciones de hora del centro y UTC técnico según el dato.
- Conservar auditoría, ownership y alcance al modificar endpoints.
- Reutilizar el calendario informativo compartido; no duplicarlo por rol.
- No mezclar disponibilidad de reserva con el mini calendario de bienvenida.
- No añadir dependencias o una segunda solución sin justificar su necesidad.
- Mantener textos en español y distinguir estados de citas, solicitudes y documentos.
- Usar datos ficticios en ejemplos y pruebas.

## 4. Si cambia el esquema

Cambiar modelo, crear una revisión Alembic incremental, revisarla a mano y
probar upgrade/downgrade sobre una copia. No modificar una revisión ya aplicada.
No incorporar parches .sql como alternativa al historial.

## 5. Validar

Desde backend:

```powershell
python -m pytest -q
```

Si cambia agenda, esquema o concurrencia, ejecutar además las pruebas PostgreSQL
sobre una base exclusiva, como indica docs/PRUEBAS.md.

Desde frontend:

```powershell
npm ci
npm test -- --watch=false
npm run build
```

Para cambios solo documentales, comprobar enlaces, comandos, rutas y diagramas.
No anunciar la suite completa como ejecutada si solo se revisó Markdown.

## 6. Actualizar documentación

- CHANGELOG.md: cambio funcional o técnico relevante y estado de publicación.
- PLAN_DE_MEJORAS.md: qué se hizo, por qué, cómo, evidencia y pendientes.
- docs/: guía vigente del área cambiada.
- README.md: solo si cambia el acceso, el arranque o el estado general.

Evitar duplicar secciones completas del plan. Conservar aportes del equipo y
marcar decisiones posteriores que reemplazan una anterior.

## 7. Revisar y publicar una rama

```powershell
git status
git diff
git diff --check
git add rutas/revisadas
git commit -m "Descripcion concreta del cambio"
git push -u origin nombre-de-la-rama
```

Sustituir las rutas y la rama por las reales; no copiar literalmente marcadores.
Revisar que no se incluyan .env, claves, tokens, bases, node_modules ni venv.

Abrir un Pull Request hacia main con problema, resultado, validaciones y límites.
Esperar los checks y la revisión del equipo antes de fusionar.
Una prueba local no reemplaza revisar los resultados de Actions.

## 8. Licencia y datos

La licencia propia está pendiente de definición; contribuir no equivale a
autorizar una publicación como MIT. Acordar titularidad y condiciones con el
equipo y la institución antes de distribuir bajo una licencia concreta.
Reportar vulnerabilidades por el canal de SECURITY.md, no con datos sensibles
en un issue.
