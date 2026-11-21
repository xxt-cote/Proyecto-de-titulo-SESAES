# Diagramas de SESAES

Los bloques Mermaid se pueden visualizar en GitHub y en editores compatibles.
Representan la versión integrada, no una conexión institucional futura.
El ER físico completo está en [MODELO_DATOS](MODELO_DATOS.md).

## 1. Arquitectura y límites de confianza

```mermaid
flowchart LR
    E[Estudiante] --> W[Angular]
    P[Profesional] --> W
    A[Admin y Superadmin] --> W
    V[Persona que valida un documento] --> W
    W -->|HTTP JSON y Bearer cuando corresponde| API[FastAPI]
    API --> SEC[Autenticación, permisos, alcance y pertenencia]
    SEC --> SVC[Servicios de agenda y documentos]
    SVC --> ORM[SQLAlchemy]
    ORM --> DB[(PostgreSQL)]
    MIG[Alembic e init_db] --> DB
    SVC --> PDF[PDF, barras y QR]
    API --> MAIL[SMTP configurado]
    FUT[Fuente académica y SSO futuros] -. Contrato pendiente .-> API
```

El frontend no accede directamente a PostgreSQL. El enlace punteado es una
integración propuesta, no un servicio conectado.

## 2. Login local

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as Angular
    participant API as POST /login
    participant SEC as Bloqueo y seguridad
    participant DB as PostgreSQL
    U->>W: Correo y contraseña SESAES
    W->>API: Solicitud de login
    API->>SEC: Límite por IP y bloqueo de cuenta
    API->>DB: Buscar cuenta
    alt Cuenta bloqueada
        API-->>W: 429 y tiempo de espera
    else Credenciales incorrectas
        API->>SEC: Registrar fallo por correo
        SEC->>DB: Contador y bloqueo si corresponde
        API-->>W: 401 genérico
    else Contraseña válida
        API->>SEC: Limpiar fallos y verificar cuenta activa
        alt Cuenta desactivada
            API-->>W: 403
        else Cuenta activa
            SEC-->>API: JWT firmado con vencimiento
            API-->>W: Token, identidad y rol
            W->>W: Guardar sesión y abrir dashboard por rol
        end
    end
```

Esto no representa SSO ni acredita matrícula.

## 3. Reservar una cita como estudiante

```mermaid
sequenceDiagram
    actor E as Estudiante
    participant W as Angular
    participant API as API de disponibilidad y citas
    participant S as Servicio de agenda
    participant DB as PostgreSQL
    E->>W: Seleccionar profesional
    W->>API: GET /disponibilidad/{id}/calendario
    API->>S: Obtener fechas con disponibilidad
    S->>DB: Leer bloques aprobados, citas y cierres
    API-->>W: Fechas permitidas
    E->>W: Elegir fecha y hora
    W->>API: GET /disponibilidad/{id}?fecha=...
    API-->>W: Horas disponibles
    W->>API: POST /citas con identidad y horario
    API->>S: Validar pertenencia, ventana y día aprobado
    S->>DB: Lock transaccional por profesional y fecha
    S->>DB: Releer conflictos dentro de la transacción
    alt Sigue disponible
        API->>DB: Guardar cita y trazabilidad
        DB-->>API: Commit
        API-->>W: Reserva creada
    else Sin bloque o conflicto
        API-->>W: Error de validación o conflicto
    end
```

Consultar una hora no la bloquea mientras el usuario completa el formulario.
El servidor vuelve a comprobarla al crear.

## 4. Solicitar y aprobar bloques semanales

```mermaid
sequenceDiagram
    actor P as Profesional
    actor A as Admin autorizado
    participant W as Angular
    participant API as Solicitudes de horario
    participant DB as PostgreSQL
    P->>W: Completar semana y colación explícita
    W->>API: POST /profesional/{id}/solicitar-bloques-horario
    API->>API: Validar profesional propio y jornada institucional
    API->>DB: Guardar solicitud y semana pendiente
    API-->>P: Solicitud enviada
    Note over API,DB: La semana vigente permanece mientras espera resolución
    A->>API: Consultar solicitud dentro de su alcance
    alt Aprueba con agenda.gestionar
        A->>API: PATCH /admin/solicitudes-horario/{id}/aprobar
        API->>DB: Reemplazar bloques aprobados de la semana
        API->>DB: Resolver solicitud, notificar y auditar
        API-->>A: Aprobación confirmada
    else Rechaza
        A->>API: PATCH /admin/solicitudes-horario/{id}/rechazar
        API->>DB: Resolver rechazo y conservar semana vigente
    end
```

La aprobación no mueve automáticamente citas existentes. Antes de cambiar la
semana, administración debe revisar las reservas afectadas.

## 5. Alta de profesional y habilitación de agenda

```mermaid
sequenceDiagram
    actor A as Admin autorizado
    participant W as Panel Profesionales
    participant API as API SESAES
    participant DB as PostgreSQL
    actor P as Profesional nuevo
    A->>W: Datos, especialidad y contraseña explícita
    W->>API: POST /admin/profesionales
    API->>API: Verificar permiso, alcance, datos y duplicados
    API->>DB: Crear cuenta y registro Profesional vinculados
    API->>DB: Registrar auditoría y confirmar
    API-->>W: Profesional creado
    A-->>P: Entregar acceso por canal privado
    P->>API: Login local
    P->>API: Solicitar bloques semanales
    Note over A,P: Hasta aprobar bloques no hay disponibilidad estudiantil
```

Usuario.id es la identidad de acceso; Profesional.id identifica la agenda.
No deben intercambiarse aunque en una base de prueba tengan el mismo número.

## 6. Recuperar contraseña

```mermaid
sequenceDiagram
    actor U as Usuario
    participant W as Pantallas públicas
    participant API as API de recuperación
    participant DB as PostgreSQL
    participant M as SMTP
    U->>W: Solicitar enlace con correo
    W->>API: POST /recuperar-password
    API->>API: Límites por IP y cuenta
    opt Cuenta activa y solicitud admitida
        API->>DB: Invalidar anteriores y guardar hash del token nuevo
        API->>M: Enviar enlace privado
        API->>DB: Registrar envío sin incluir token
    end
    API-->>W: Respuesta uniforme
    U->>W: Abrir enlace y elegir contraseña
    W->>API: POST /restablecer-password
    API->>DB: Verificar hash, vencimiento y uso
    API->>DB: Guardar hash de contraseña y consumir enlaces
    API->>DB: Desbloquear cuenta y auditar
    API-->>W: Confirmación de cambio
```

SMTP real debe configurarse; las pruebas automatizadas simulan el envío.

## 7. Documento auténtico y período de uso

```mermaid
flowchart TD
    C[Profesional completa atención] --> D[Instantánea y huella SHA-256]
    D --> P[PDF con folio, barras y QR]
    P --> V[Consulta pública]
    V --> H{Existe, huella válida y no anulado}
    H -->|No| N[No confirmar autenticidad]
    H -->|Sí| T{Tipo de documento}
    T -->|Justificativo| J[Comparar fecha de ausencia con intervalo]
    T -->|Receta| R[Comparar hoy en Santiago con fecha límite]
    J --> F[Informar cobertura]
    R --> G[Informar vigencia actual]
```

Validar no equivale a registrar una entrega de medicamentos ni a comprobar
la matrícula del estudiante.

## 8. ER de lectura rápida

Este extracto usa las claves del esquema físico y permite ubicar las entidades
centrales. Las tablas restantes, columnas, índices y restricciones están en
[MODELO_DATOS](MODELO_DATOS.md), que incluye el ER completo.

```mermaid
erDiagram
    usuario {
        int id PK
        string correo
        string rol
    }
    profesional {
        int id PK
        int usuario_id FK
        string especialidad
    }
    cita {
        int id PK
        int estudiante_id FK
        int profesional_id FK
        string fecha
        string hora
    }
    bloque_horario_semanal {
        int id PK
        int profesional_id FK
        int dia_semana
        string tipo
    }
    documento_clinico {
        int id PK
        int cita_id FK
        string folio
    }
    acceso_administrativo {
        int id PK
        int usuario_id FK
        string perfil
    }
    usuario o|--o{ profesional : usuario_id
    usuario o|--o{ cita : estudiante_id
    profesional o|--o{ cita : profesional_id
    profesional ||--o{ bloque_horario_semanal : profesional_id
    cita ||--o{ documento_clinico : cita_id
    usuario ||--o| acceso_administrativo : usuario_id
```

La relación física no sustituye las reglas de pertenencia. Un admin tampoco
adquiere permiso clínico por aparecer relacionado con el mismo sistema.
