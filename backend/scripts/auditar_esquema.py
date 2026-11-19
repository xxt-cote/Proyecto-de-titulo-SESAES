"""Diagnóstico de metadatos exclusivamente de lectura; nunca ejecuta DDL.

Uso desde backend: python -m scripts.auditar_esquema
No consulta filas de usuarios, citas, historiales ni credenciales.
"""
import json
from sqlalchemy import inspect
from app.database import Base, engine
import app.models.init  # noqa: F401 — registro del esquema esperado


def diagnosticar(bind):
    inspector = inspect(bind)
    existentes = set(inspector.get_table_names())
    informe = {"tablas_faltantes": [], "columnas_faltantes": {}, "columnas_a_revisar": {},
               "indices_faltantes": {}, "restricciones_faltantes": {}, "indices_unicos_slot_legacy": []}
    for nombre, tabla in sorted(Base.metadata.tables.items()):
        if nombre not in existentes:
            informe["tablas_faltantes"].append(nombre)
            continue
        columnas = {c['name']: c for c in inspector.get_columns(nombre)}
        for columna in tabla.columns:
            if columna.name not in columnas:
                informe["columnas_faltantes"].setdefault(nombre, []).append(columna.name)
                continue
            real = columnas[columna.name]
            esperado = str(columna.type.compile(dialect=bind.dialect))
            observado = str(real['type'].compile(dialect=bind.dialect))
            diferencias = {}
            if esperado != observado:
                diferencias['tipo'] = {"esperado": esperado, "actual": observado}
            if columna.nullable != real['nullable']:
                diferencias['nullable'] = {"esperado": columna.nullable, "actual": real['nullable']}
            if columna.server_default is not None and real.get('default') is None:
                diferencias['default_faltante'] = str(columna.server_default.arg)
            if diferencias:
                informe["columnas_a_revisar"].setdefault(nombre, {})[columna.name] = diferencias
        indices = inspector.get_indexes(nombre)
        por_nombre = {i['name']: i for i in indices}
        for indice in tabla.indexes:
            if indice.name not in por_nombre:
                informe['indices_faltantes'].setdefault(nombre, []).append(indice.name)
            else:
                actual = por_nombre[indice.name]
                if list(actual['column_names']) != [c.name for c in indice.columns] or bool(actual['unique']) != bool(indice.unique):
                    informe.setdefault('indices_a_revisar', {}).setdefault(nombre, []).append(indice.name)
        unicas = {tuple(c['column_names']) for c in inspector.get_unique_constraints(nombre)}
        unicas |= {tuple(i['column_names']) for i in indices if i['unique']}
        from sqlalchemy import UniqueConstraint, CheckConstraint
        checks = {c['name'] for c in inspector.get_check_constraints(nombre)}
        for constraint in tabla.constraints:
            if isinstance(constraint, UniqueConstraint) and tuple(c.name for c in constraint.columns) not in unicas:
                informe['restricciones_faltantes'].setdefault(nombre, []).append(constraint.name or 'UNIQUE '+str([c.name for c in constraint.columns]))
            if isinstance(constraint, CheckConstraint) and constraint.name not in checks:
                informe['restricciones_faltantes'].setdefault(nombre, []).append(constraint.name)
        if nombre == 'cita':
            for i in indices:
                if i['unique'] and set(i['column_names']) == {'profesional_id', 'fecha', 'hora'}:
                    informe['indices_unicos_slot_legacy'].append(i['name'])
    return informe


if __name__ == '__main__':
    print(json.dumps(diagnosticar(engine), ensure_ascii=False, indent=2))
