# Integración con la universidad

## Qué existe hoy

SESAES tiene cuentas locales, API administrativa de alta y permisos propios.
No dispone de credenciales institucionales, conexión académica, proveedor SSO ni
API de matrícula entregados por la universidad.

Por tanto, una cuenta con correo @utem.cl y activo=true no demuestra matrícula
vigente. Carrera es texto libre, no una lista oficial. El sistema no desactiva
por egreso o retiro consultando un sistema académico.

La existencia de una base institucional es un supuesto de integración, no una
conexión implementada. No se debe dar acceso directo desde Angular a esa base.

## Separar responsabilidades

| Información                                         | Fuente responsable propuesta                    |
| --------------------------------------------------- | ----------------------------------------------- |
| Identidad, contraseña institucional y autenticación | Proveedor institucional de identidad            |
| Carrera, período, matrícula y estado académico      | Sistema académico oficial                       |
| Agenda, bloques, citas y atenciones                 | SESAES                                          |
| Antecedentes y documentos de salud                  | SESAES, con acceso clínico autorizado           |
| Permisos administrativos de SESAES                  | Superadmin y configuración efectiva del sistema |

Validar la identidad y validar matrícula son operaciones distintas.
Iniciar sesión por SSO no basta si la regla exige estar matriculado en el período.

## Conexión propuesta

1. La universidad entrega contrato técnico, responsable, datos de prueba y
   método de autenticación del servicio.
2. Un adaptador en backend obtiene identidad y estado académico autorizado.
3. Se vincula un identificador institucional estable con Usuario.id. No usar el
   nombre como clave ni asumir que el correo nunca cambia.
4. Se verifica período y matrícula conforme a la regla acordada.
5. SESAES conserva la referencia mínima necesaria; la información académica
   sigue perteneciendo al sistema origen.
6. Se resuelven bajas, cambios de correo, interrupciones y trazabilidad antes
   de activar la integración real.

No copiar tablas académicas completas para simular una integración productiva.

## Contrato mínimo propuesto, todavía no implementado

| Campo             | Propósito                                   |
| ----------------- | ------------------------------------------- |
| id_institucional  | Identificador estable                       |
| nombre            | Presentación                                |
| correo            | Contacto e identificador cuando corresponda |
| carrera           | Dato académico descriptivo                  |
| periodo           | Período al que aplica el estado             |
| matricula_vigente | Decisión académica de la fuente oficial     |
| consultado_en     | Fecha e instante de verificación            |
| fuente y version  | Procedencia y versión del contrato          |

No se recibe ni replica la contraseña institucional. El método SSO concreto
(OIDC, SAML u otro) lo debe definir el proveedor institucional.
Una conexión de lectura a una base también necesita un contrato y permisos;
no se improvisan nombres de tablas reales.

## Comportamiento por acordar

- Qué identifica un período vigente y qué estados permiten entrar.
- Con qué frecuencia se vuelve a verificar la matrícula.
- Cómo se informa una caída del sistema académico sin conceder acceso por defecto.
- Cómo se conserva el historial clínico cuando cambia el estado académico.
- Quién comunica y autoriza altas/bajas de personal.
- Qué acceso clínico conserva cada profesional.
- Cómo se distingue entorno demo de autenticación institucional real.

No convertir una indisponibilidad de red en una baja académica permanente.

## Continuación del desarrollo

La sección 9.6 del [plan de mejoras](../PLAN_DE_MEJORAS.md) conserva la propuesta.
Antes de implementar, acordar un ejemplo de respuesta real, las reglas de acceso
y la responsabilidad de datos. Luego crear pruebas del adaptador sin pacientes
reales, vincular identidades y verificar que no exista una puerta alternativa
de acceso demo en producción.
