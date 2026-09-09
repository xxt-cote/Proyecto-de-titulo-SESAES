-- ══════════════════════════════════════════════════════════════════
-- SESAES — Migración: Agenda por bloques, ausencias por fecha,
-- rechazo de citas por el profesional, acaparamiento.
--
-- Uso: si tu base de datos YA EXISTE (tiene datos), corre este script
-- una vez con psql o tu cliente favorito:
--     psql -U <usuario> -d <basededatos> -f migration_agenda_bloques.sql
--
-- Si en cambio partes de una base VACÍA, no necesitas este archivo:
-- basta con levantar el backend una vez (Base.metadata.create_all ya
-- crea todo, incluidas las tablas nuevas, al iniciar la app).
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- 1) Cita: rechazo por el profesional (reutiliza estado "cancelada" +
--    este flag para diferenciarlo de una cancelación del estudiante/admin)
ALTER TABLE cita
    ADD COLUMN IF NOT EXISTS rechazada_por_profesional BOOLEAN DEFAULT FALSE;

-- 2) SolicitudHorario: nuevo tipo "bloques" (agenda semanal interactiva)
ALTER TABLE solicitud_horario
    ADD COLUMN IF NOT EXISTS bloques_json TEXT;

-- 3) Nueva tabla: agenda semanal APROBADA por bloques (día de semana +
--    rango horario + tipo disponible/colacion) por profesional.
CREATE TABLE IF NOT EXISTS bloque_horario_semanal (
    id              SERIAL PRIMARY KEY,
    profesional_id  INTEGER NOT NULL REFERENCES profesional(id),
    dia_semana      INTEGER NOT NULL,              -- 0=Lunes ... 4=Viernes
    hora_inicio     VARCHAR NOT NULL,               -- "HH:MM" 24h
    hora_fin        VARCHAR NOT NULL,               -- "HH:MM" 24h
    tipo            VARCHAR DEFAULT 'disponible'    -- 'disponible' | 'colacion'
);
CREATE INDEX IF NOT EXISTS ix_bloque_horario_semanal_profesional_id
    ON bloque_horario_semanal (profesional_id);

-- 4) Nueva tabla: ausencia de día completo por fecha exacta (bloquea
--    agendamiento NUEVO en esa fecha, no solo cancela lo existente).
CREATE TABLE IF NOT EXISTS ausencia_profesional (
    id              SERIAL PRIMARY KEY,
    profesional_id  INTEGER NOT NULL REFERENCES profesional(id),
    fecha           VARCHAR NOT NULL,   -- "YYYY-MM-DD"
    motivo          VARCHAR,
    fecha_creacion  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ausencia_profesional_profesional_id
    ON ausencia_profesional (profesional_id);
CREATE INDEX IF NOT EXISTS ix_ausencia_profesional_fecha
    ON ausencia_profesional (fecha);

COMMIT;

-- ══════════════════════════════════════════════════════════════════
-- Notas:
-- - No se migran datos históricos: los profesionales que ya tenían
--   horario_inicio/horario_fin + hora_almuerzo_inicio/hora_almuerzo_fin
--   (jornada simple) SIGUEN funcionando igual que antes — horarios.py
--   usa esos campos como respaldo mientras el profesional no tenga
--   filas en bloque_horario_semanal (ver reglas en app/routers/horarios.py).
-- - No hace falta migrar nada para que un profesional "adopte" bloques:
--   basta con que envíe una solicitud de tipo "bloques" y el admin la
--   apruebe (ver /profesional/{id}/solicitar-bloques-horario).
-- ══════════════════════════════════════════════════════════════════
