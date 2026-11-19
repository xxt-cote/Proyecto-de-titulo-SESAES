# API y ejemplos de integración

## 1. Acceso y contrato

En local, la API se publica en http://localhost:8080.
Con SESAES_ENV=development están disponibles /docs y /openapi.json.
En production esas rutas se deshabilitan; no implica que la API deje de funcionar.

Las operaciones protegidas reciben Authorization: Bearer TOKEN.
El rol, permiso, alcance y pertenencia se comprueban en backend. Un identificador
válido de otra persona no concede acceso a su recurso.

Ver [referencia de rutas](API_REFERENCIA.md), generada desde decoradores del código.
OpenAPI es la referencia para validaciones detalladas y estructuras de respuesta.
Los cuerpos enviados como dict pueden tener validación adicional en el router.

Los ejemplos se ejecutan en PowerShell 7 y solo contra un entorno de pruebas
propio. No reutilizar IDs de una base ajena.

## 2. Obtener un token

```powershell
$api = 'http://localhost:8080'
$correo = Read-Host 'Correo de la cuenta de pruebas'
$password = Read-Host -MaskInput 'Contraseña'
$body = @{ correo=$correo; password=$password } | ConvertTo-Json
$sesion = Invoke-RestMethod -Method Post -Uri "$api/login" -ContentType 'application/json; charset=utf-8' -Body $body
$auth = @{ Authorization="Bearer $($sesion.access_token)" }
Remove-Variable password,body
```

No imprimir ni publicar el token. El ID devuelto es Usuario.id.
Para el profesional, resolver su registro de agenda por:

```text
GET /profesional/buscar-por-usuario/{usuario_id}
```

Profesional.id y Usuario.id no son intercambiables.

## 3. Altas administrativas

### Profesional y especialidad

Con cuenta autorizada y dentro de su alcance:

`POST /admin/profesionales`

```json
{
  "nombre": "Profesional ficticio",
  "correo": "profesional.prueba@utem.cl",
  "password": "ClaveSoloParaEjemplo1!",
  "especialidad": "Nutrición",
  "duracion_min": 60
}
```

La contraseña de arriba es ficticia y no debe utilizarse al instalar.
RUT, tratamiento y otros campos admitidos están en ProfesionalCreate.
La API verifica la política de contraseña, datos y duplicados.

No hay POST /especialidades: cada profesional conserva una especialidad textual.
Las listas normalizan variantes; no constituyen un catálogo institucional oficial.
Crear el profesional no habilita su agenda estudiantil hasta aprobar bloques.

### Estudiante

`POST /admin/estudiantes`

```json
{
  "nombre": "Estudiante ficticio",
  "correo": "estudiante.prueba@utem.cl",
  "password": "ClaveSoloParaEjemplo1!",
  "carrera": "Carrera de prueba"
}
```

Respuesta de alta: HTTP 201. El rol se determina en servidor; el cliente no puede
elegir permisos con este esquema. El correo @utem.cl se exige en el esquema.
RUT es opcional; si se envía se valida mediante la lógica de alta.
Carrera es texto libre. Este endpoint no consulta matrícula académica.

Los ejemplos PowerShell completos, con contraseñas por entrada oculta y IDs
reales de las respuestas, están en [INSTALACION](INSTALACION.md).

## 4. Solicitar y aprobar bloques

Como profesional propietario del ID:

`POST /profesional/{profesional_id}/solicitar-bloques-horario`

```json
{
  "bloques": [
    {
      "dia_semana": 0,
      "hora_inicio": "09:00",
      "hora_fin": "13:00",
      "tipo": "disponible"
    },
    {
      "dia_semana": 0,
      "hora_inicio": "13:00",
      "hora_fin": "14:00",
      "tipo": "colacion"
    },
    {
      "dia_semana": 0,
      "hora_inicio": "14:00",
      "hora_fin": "17:30",
      "tipo": "disponible"
    }
  ]
}
```

0 es lunes y 4 es viernes. El paquete representa la semana completa solicitada.
Debe caber en la jornada institucional y contener al menos un bloque disponible.
Una nueva solicitud reemplaza la anterior pendiente del mismo tipo.

Consultar la solicitud con el token profesional:

```text
GET /profesional/{profesional_id}/solicitudes-horario
```

Aprobar con cuenta administrativa, agenda.gestionar y alcance válido:

```text
PATCH /admin/solicitudes-horario/{solicitud_id}/aprobar
```

No requiere cuerpo. Reemplaza la semana aprobada y deja la solicitud en estado
aprobado. La fecha de resolución es un instante UTC.
El rechazo usa PATCH /admin/solicitudes-horario/{solicitud_id}/rechazar;
su cuerpo y las condiciones se consultan en el contrato activo.

## 5. Disponibilidad y reserva

```text
GET /disponibilidad/{profesional_id}/calendario
GET /disponibilidad/{profesional_id}?fecha=YYYY-MM-DD
```

Usar una fecha y hora devueltas por disponibilidad. Como estudiante propietario:

`POST /citas`

```json
{
  "estudiante_id": 123,
  "profesional_id": 456,
  "fecha": "2026-11-20",
  "hora": "09:00",
  "observaciones": "Consulta de prueba"
}
```

Los números y la fecha son ilustrativos: sustituir por la identidad real y una
fecha disponible dentro de la ventana vigente. No copiar la fecha como prueba
permanente, pues deja de ser futura.

Para una reserva administrativa ordinaria se usa el flujo autorizado del mismo
dominio. Para sobrecupo se agregan:

```json
{
  "sobrecupo": true,
  "sobrecupo_motivo": "Motivo administrativo de prueba"
}
```

Estos campos se incorporan al cuerpo completo de creación. No sustituyen IDs,
fecha ni hora. Requiere agenda.gestionar y agenda.sobrecupo y el alcance admitido.
Una hora libre sigue siendo normal. En un intervalo ocupado el servidor decide
si puede aceptar otra atención; la primera no se desplaza.

sobrecupo_forzado es compatibilidad con clientes anteriores, no una vía para
evitar la política actual. Un alumno no adquiere privilegios enviando ese campo.

## 6. Documentos y validación pública

La emisión forma parte de:

```text
PATCH /profesional/{profesional_id}/citas/{cita_id}/completar
```

El payload y capacidades clínicas se comprueban en el servicio.
Una receta incluye valida_hasta y al menos un medicamento; un justificativo con
reposo necesita reposo_desde y reposo_hasta. Ver RecetaIn y JustificativoIn.

Consulta y descarga autorizadas:

```text
GET /documentos/cita/{cita_id}
GET /documentos/{doc_id}/pdf
POST /documentos/{doc_id}/anular
```

Anular exige motivo y pertenencia al emisor.

Consulta pública, sin Bearer:

```text
GET /documentos/validar/{codigo}
GET /documentos/validar/{codigo}?fecha=YYYY-MM-DD
```

La fecha comprueba una ausencia de justificativo. Para recetas no permite
retroceder el reloj: su vigencia se determina con hoy en Santiago.
La respuesta distingue autenticidad de verificacion_uso. Un HTTP 200 no significa
documento válido: leer valido, estado y la comprobación de período.

## 7. Recuperación

`POST /recuperar-password`

```json
{ "correo": "cuenta.prueba@utem.cl" }
```

La respuesta es uniforme; no acredita existencia de cuenta ni entrega SMTP.
El token del enlace no se devuelve como parte de esa respuesta.

`POST /restablecer-password`

```json
{
  "token": "TOKEN_DEL_ENLACE_PRIVADO",
  "nueva_password": "ClaveSoloParaEjemplo1!"
}
```

El ejemplo no es un token válido. La contraseña debe ser elegida por el usuario.
No guardar ni registrar el enlace completo como dato administrativo.

## 8. Errores que debe gestionar un cliente

| HTTP | Interpretación habitual                                         |
| ---- | --------------------------------------------------------------- |
| 400  | Regla de negocio, datos incoherentes, fecha o token inválido    |
| 401  | Sesión/credenciales inválidas                                   |
| 403  | Cuenta desactivada o permiso insuficiente                       |
| 404  | Recurso inexistente o fuera del alcance ocultado por privacidad |
| 409  | Duplicado o conflicto de agenda                                 |
| 422  | Validación estructural de FastAPI/Pydantic                      |
| 429  | Límite de uso o bloqueo temporal                                |
| 5xx  | Error del servicio; no repetir escrituras ciegamente            |

No convertir todos los errores en contraseña incorrecta ni mostrar un éxito
solo porque terminó una llamada HTTP. No registrar cuerpos con contraseñas,
tokens ni contenido clínico en herramientas de soporte.
