# Pruebas de Finova

Este documento resume qué se prueba, cómo ejecutar las pruebas y qué resultados se
obtuvieron. Complementa la sección "Pruebas" del [README](../README.md).

## Resumen de resultados

| Capa | Herramienta | Pruebas | Resultado | Tiempo aprox. |
| --- | --- | ---: | --- | --- |
| Backend: lógica pura (impuestos, filtros, análisis, alertas, presupuestos, períodos, categorías, Excel, metas) | `unittest` | 159 | OK | 0.4 s |
| Backend completo (lógica pura + API, modelos, migraciones, autenticación, exportación, metas) | `manage.py test` (Django, basado en `unittest`) | 443 | OK | 1 min |
| Frontend: lógica sin React (formato, validaciones, períodos, presupuestos, impuestos, movimientos, metas, API, componentes) | Vitest 4 | 180 | OK | 1 s |
| Frontend: reglas de calidad alineadas con SonarCloud | ESLint (`npm run lint`) | — | 0 problemas | 10 s |
| Frontend: compilación de producción | `vite build` | — | OK | 4 s |

Ejecución registrada el 26/11/2026 con Python 3.13, Django 5.2, Pandas 3, NumPy 2,
openpyxl 3.1 y Node.js 24.

## Cómo ejecutarlas

```powershell
# Backend: solo la lógica pura, sin base de datos (unittest)
cd backend
.\.venv\Scripts\python.exe -m unittest core.test_taxes core.test_transaction_filters core.test_analytics core.test_alerts core.test_budgets core.test_periods core.test_categories core.test_xlsx_export goals.test_planning

# Backend completo (crea una base de datos de prueba temporal)
.\.venv\Scripts\python.exe manage.py test

# Frontend
cd ..\frontend
npm test
npm run lint
npm run build
```

## Inventario del backend

| Archivo | Pruebas | Qué verifica |
| --- | ---: | --- |
| `core/test_taxes.py` | 16 | Impuesto a la Renta: deducción de 7 UIT, tope de 3 UIT adicionales, los 5 tramos, redondeo a céntimos, proyección anual |
| `core/test_transaction_filters.py` | 19 | Filtros funcionales (`lambda`, `filter`, `reduce`): categoría, tipo, texto, combinación de criterios, inmutabilidad de la entrada, totales por día, paginación |
| `core/test_analytics.py` | 18 | Pandas/NumPy: limpieza del `DataFrame`, meses en hora de Lima, evolución del saldo, distribución de gastos, porcentajes que suman 100 |
| `core/test_alerts.py` | 40 | Reglas de alertas: umbrales de presupuesto, proyección, gasto inusual (media + 2σ), mes negativo, reconciliación |
| `core/test_budgets.py` | 10 | Estado y proyección de presupuestos, incluido el cambio de año |
| `core/test_periods.py` | 7 | Períodos AAAA-MM, nombres de meses y si un período es pasado, actual o futuro |
| `core/test_categories.py` | 9 | Categorías sin importar tildes, mayúsculas ni espacios |
| `core/test_csv_export.py` | 3 | Exportación CSV y protección contra inyección de fórmulas |
| `core/test_xlsx_export.py` | 21 | Libro de Excel: hojas, encabezados, fechas reales, formato de moneda, totales con fórmulas, textos del usuario siempre como texto |
| `core/test_models.py` | 12 | POO de cuentas: depósitos, retiros, transferencias, cuentas archivadas, restricciones de la base de datos |
| `core/test_api_transactions.py` | 29 | API de movimientos: crear, listar con filtros, editar, eliminar, transferir |
| `core/test_api_accounts.py` | 13 | API de cuentas: crear, ajustar saldo, archivar, eliminar |
| `core/test_api_budgets.py` | 16 | API de presupuestos: gasto calculado, edición, copia de mes, rebalanceo |
| `core/test_api_alerts.py` | 34 | Motor de alertas conectado a la API |
| `core/test_api_categories.py` | 12 | Catálogo de categorías por usuario |
| `core/test_api_export.py` | 17 | API de exportación: Excel por defecto, CSV opcional, historial completo, filtros, nombre de archivo, nunca 406 |
| `core/test_api_validation.py` | 7 | Mensajes de validación de montos en español |
| `core/test_migrations.py` | 2 | Migración de datos antiguos |
| `core/test_seed_demo.py` | 6 | Comando de datos de demostración, contraseña indicada o generada al azar |
| `core/tests.py` | 25 | Autenticación requerida, usuario nuevo sin datos, resumen del dashboard |
| `goals/test_planning.py` | 19 | Metas: progreso, progreso esperado, ahorro mensual necesario, estado y fecha estimada con NumPy |
| `goals/test_alert_rules.py` | 5 | Alertas de meta atrasada y meta alcanzada |
| `goals/test_api.py` | 26 | API de metas: crear, editar, archivar, eliminar, aportes y retiros, validaciones y propiedad |
| `accounts/tests.py` | 77 | Registro, inicio de sesión, límite de intentos, verificación de correo, recuperación y cambio de contraseña |
| **Total** | **443** | |

## Inventario del frontend

| Archivo | Pruebas | Qué verifica |
| --- | ---: | --- |
| `src/lib/format.test.js` | 16 | Montos en soles y otras monedas, porcentajes, ocultar montos, fechas en hora de Lima, iniciales |
| `src/lib/validation.test.js` | 13 | Correo válido, fuerza de la contraseña, primer error de la API |
| `src/lib/period.test.js` | 9 | Mes actual en Lima, desplazamiento de meses, bisiestos, etiquetas |
| `src/lib/api.test.js` | 6 | Mensajes de error de la API, sesión expirada (401), fallos de red y parámetros de consulta |
| `src/lib/api/transactions.test.js` | 8 | Exportación: parámetros, nombre del archivo y lectura de errores |
| `src/lib/download.test.js` | 4 | Nombre de archivo desde `Content-Disposition` |
| `src/components/ui/FilterChips.test.js` | 25 | Lectura de etiquetas con contador ("Todas (5)") sin expresiones regulares, comparada con la versión anterior |
| `src/components/ui/formModel.test.js` | 8 | Valores iniciales, validación de campos y reparto de errores del servidor en formularios |
| `src/features/budgets/budgetModel.test.js` | 33 | Umbrales Normal/Precaución/Crítico/Excedido (iguales al backend), márgenes en céntimos exactos, rebalanceo |
| `src/features/taxes/taxRules.test.js` | 14 | Lectura de montos escritos por el usuario, tramos alcanzados, deducciones |
| `src/features/transactions/transactions.test.js` | 6 | Sugerencia de categoría parecida, fechas de movimientos |
| `src/features/transactions/movementHelpers.test.js` | 8 | Estilo, texto y formulario de un movimiento |
| `src/features/dashboard/dashboardUtils.test.js` | 5 | Fechas relativas, variaciones con su tono y enlaces del resumen a Movimientos |
| `src/features/goals/goalModel.test.js` | 20 | Metas: progreso, estado, montos válidos y textos |
| `src/pages/authFieldErrors.test.js` | 5 | Errores de correo y contraseña en registro y restablecimiento |
| **Total** | **180** | |

## Casos de prueba destacados

### Impuesto a la Renta (`core/test_taxes.py`)

Los valores esperados se calcularon a mano con la escala del art. 53 de la Ley del
Impuesto a la Renta. UIT 2025 = S/ 5,350; UIT 2024 = S/ 5,150.

| Caso | Entrada | Esperado | Resultado |
| --- | --- | --- | --- |
| Ingreso menor a 7 UIT | S/ 30,000 (2025) | Renta neta 0, impuesto S/ 0.00 | OK |
| Solo primer tramo | S/ 60,000 (2025) | Renta neta 22,550 × 8 % = S/ 1,804.00; tasa efectiva 3.01 % | OK |
| Justo en el límite del 1.er tramo | S/ 64,200 (2025) | Renta neta 26,750 = 5 UIT; impuesto S/ 2,140.00; no abre el 2.º tramo | OK |
| Tres tramos | S/ 150,000 (2025) | 2,140.00 + 11,235.00 + 943.50 = S/ 14,318.50 | OK |
| Los cinco tramos | S/ 400,000 (2024) | Impuesto S/ 75,967.50; tasa efectiva 18.99 % | OK |
| Redondeo comercial | S/ 64,200.75 (2025) | 0.75 × 14 % = 0.105 → S/ 0.11 | OK |
| Tope de deducciones adicionales | S/ 100,000 con 20,000 de deducciones | Se aceptan 3 UIT (16,050); impuesto S/ 4,905.00 | OK |
| Proyección anual | S/ 30,000 en 6 meses (2026) | Proyectado S/ 60,000 → impuesto S/ 1,720.00 | OK |
| Valores negativos | Ingreso −1 | `ValueError` | OK |

### Filtros funcionales (`core/test_transaction_filters.py`)

| Caso | Entrada | Esperado | Resultado |
| --- | --- | --- | --- |
| Filtro por categoría | `category="alimentación"` | Devuelve "Supermercado" y "Menú del día" | OK |
| Categoría sin tildes | `"alimentacion"` | Coincide con "Alimentación" | OK |
| Criterios combinados | texto + tipo + categoría | Solo los que cumplen los tres (`all_of`) | OK |
| Inmutabilidad | Lista original | La lista de entrada no cambia | OK |
| Total con `reduce` | Ingresos y gastos | Suma exacta con `Decimal` | OK |

### Limpieza de datos con Pandas (`core/test_analytics.py`)

| Caso | Entrada | Esperado | Resultado |
| --- | --- | --- | --- |
| Filas inválidas | Montos nulos/negativos, fechas inválidas, tipos desconocidos, ids repetidos | Se descartan | OK |
| Categorías vacías | `None`, `"  "` | "Sin categoría" | OK |
| Mes en hora local | Movimiento a las 02:00 UTC del día 1 | Cuenta en el mes anterior (Lima, UTC−5) | OK |
| Porcentajes de gastos | Varias categorías | Suman exactamente 100.0 (método del mayor resto) | OK |
| Evolución del saldo | Saldo actual y movimientos | Saldo de cierre de cada mes reconstruido con `np.cumsum` | OK |

### Gasto inusual con NumPy (`core/test_alerts.py`)

| Caso | Entrada | Esperado | Resultado |
| --- | --- | --- | --- |
| Umbral estadístico | Historial de la categoría | Alerta si el gasto supera media + 2σ | OK |
| Historial insuficiente | Menos de 5 gastos previos | Sin alerta | OK |
| Ventana de historial | Gastos de hace más de 6 meses | No se consideran | OK |

### POO de cuentas (`core/test_models.py`)

| Caso | Entrada | Esperado | Resultado |
| --- | --- | --- | --- |
| Transferencia a la misma cuenta | `cuenta.transfer_to(cuenta, 10)` | Error de dominio | OK |
| Transferencia fallida | Transferir S/ 100.01 con saldo de S/ 100.00 | No deja movimientos a medias (transacción atómica) | OK |
| Cuenta archivada | Depósito | Rechazado | OK |
| Saldo = suma de movimientos | Varias operaciones | El saldo siempre coincide con los movimientos | OK |

### Exportación a Excel (`core/test_xlsx_export.py`, `core/test_api_export.py`)

| Caso | Entrada | Esperado | Resultado |
| --- | --- | --- | --- |
| Formato por defecto | `GET transacciones/exportar/` | Archivo `.xlsx` con hojas Movimientos, Resumen y Presupuestos | OK |
| Moneda del usuario | Usuario en USD | Montos con formato `"$" #,##0.00` | OK |
| Totales | Mes de noviembre | Las fórmulas dan los mismos ingresos, gastos y neto que la app | OK |
| Inyección de fórmulas | Descripción `=HYPERLINK("http://x","y")` o `=1+1` | Queda como texto; las únicas fórmulas son los totales | OK |
| Historial completo | `todo=1` | Todos los meses en una sola petición, `finova-historial-completo.xlsx` | OK |
| Sin error 406 | `Accept: */*`, `application/json`, xlsx | Responde 200 | OK |

### Metas de ahorro (`goals/test_planning.py`, `goals/test_api.py`)

| Caso | Entrada | Esperado | Resultado |
| --- | --- | --- | --- |
| Progreso esperado | Meta creada hace la mitad del plazo | 50 % esperado (lineal entre creación y fecha objetivo) | OK |
| Meta atrasada | Ahorrado más de 10 puntos por debajo de lo esperado | Estado "Atrasada" y alerta de meta atrasada | OK |
| Ahorro mensual necesario | Faltan S/ 1,000 en 3 meses | S/ 333.34 por mes (redondeo hacia arriba al céntimo) | OK |
| Fecha estimada con NumPy | Aportes de los últimos 6 meses | Fecha según el ritmo promedio; sin ritmo, sin fecha | OK |
| Retiro mayor a lo ahorrado | Retirar más de lo que hay en la meta | Error 400 en `amount` | OK |
| Meta de otro usuario | `GET /metas/<id>/` ajena | 404 "Meta no encontrada." | OK |
