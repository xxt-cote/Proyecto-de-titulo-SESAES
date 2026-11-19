# Migraciones SESAES

El historial versionado en `versions/` crea y actualiza el esquema.
Desde `backend/`, con `DATABASE_URL` de una base nueva/de prueba:

```powershell
python -m alembic upgrade head
python -m alembic current
python -m alembic revision --autogenerate -m "descripcion del cambio"
```

Revisar cada revisión y probarla antes de aplicarla. No usar autogenerate
contra la base antigua ni estampar bases sin verificar equivalencia.
Consultar la [guía de migraciones del plan de mejoras](../../PLAN_DE_MEJORAS.md#guia-migraciones).
