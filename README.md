# Finova

Gestor de finanzas personales y alertas (propuesta 3 del curso). Aplicación web
responsive para registrar cuentas, ingresos y gastos, controlar presupuestos
mensuales, recibir alertas automáticas y estimar el Impuesto a la Renta.

- Backend: Python 3.13, Django 5.2, Django REST Framework 3.16, Pandas 3 y NumPy 2.
- Frontend: React 19, Vite 7, Tailwind CSS 4, React Router 7 y Recharts.
- Persistencia: SQLite.
- Autenticación: sesiones de Django con cookie `HttpOnly` y CSRF.

## Funcionalidades

| Pantalla | Ruta | Qué permite |
| --- | --- | --- |
| Resumen | `/app` | Saldo total, ingresos y gastos del mes con su variación, evolución del saldo, distribución de gastos, alertas activas y últimos movimientos |
| Movimientos | `/app/movimientos` | Registrar, editar y eliminar ingresos y gastos; transferencias y depósitos; filtros por tipo, categoría, cuenta y texto; exportar a Excel |
| Presupuestos | `/app/presupuestos` | Límites mensuales por categoría, proyección a fin de mes, análisis con sugerencia de rebalanceo y copia del mes anterior |
| Metas | `/app/metas` | Metas de ahorro con monto y fecha objetivo, aportes y retiros, progreso frente a lo esperado, ahorro mensual necesario y fecha estimada |
| Cuentas | `/app/cuentas` | Crear, editar, archivar y eliminar cuentas; actualizar saldo; patrimonio total |
| Impuestos | `/app/impuestos` | Estimación del Impuesto a la Renta de quinta categoría por año, con detalle por tramos |
| Alertas | `/app/alertas` | Alertas automáticas de presupuesto, ritmo de gasto, gastos inusuales, balance mensual y metas atrasadas o alcanzadas |
| Configuración | `/app/configuracion` | Perfil y moneda, cambio de contraseña, cierre de sesión en todos los dispositivos, preferencias y descarga del historial completo en Excel |

El período seleccionado viaja en la URL (`?mes=AAAA-MM`) y por defecto es el mes
actual en hora de Lima.

La exportación genera un Excel (`.xlsx`) con las hojas Movimientos (tabla con
filtros, montos en la moneda del usuario y totales), Resumen (tarjetas y gráfico de
gastos por categoría; con el historial completo, también la evolución mensual) y
Presupuestos (semáforo de uso).

## Cómo cumple la propuesta

| Requisito | Dónde está |
| --- | --- |
| POO para modelar las cuentas | `backend/core/models.py`: `FinanceAccount.open/deposit/withdraw/transfer_to/adjust_balance/close` y `FinanceTransaction.edit/cancel`, con excepciones de dominio en `core/exceptions.py` |
| Paradigma funcional (`filter`, `lambda`) para filtrar por categoría | `backend/core/transaction_filters.py` (predicados con `lambda`, `filter`, `reduce`) y las reglas puras de `backend/core/alerts.py` |
| Pandas para limpiar los datos | `backend/core/analytics.py`: `clean_transactions` arma y limpia un `DataFrame` |
| NumPy para el balance mensual | `backend/core/analytics.py` (`monthly_net`, `balance_evolution`) y la regla de gasto inusual (media + 2σ) en `backend/core/alerts.py` |
| Gráfico de líneas con la evolución del saldo | Pantalla Resumen (`frontend/src/features/dashboard/BalanceChart.jsx`) con datos de `analytics.dashboard_charts` |
| `unittest` para que los impuestos sean exactos | `backend/core/test_taxes.py` sobre `backend/core/taxes.py` |

Las pruebas de lógica pura (impuestos, filtros, análisis, alertas, presupuestos,
períodos, categorías, Excel y metas) usan `unittest.TestCase` y corren sin Django:

```powershell
cd backend
.\.venv\Scripts\python.exe -m unittest core.test_taxes core.test_transaction_filters core.test_analytics core.test_alerts core.test_budgets core.test_periods core.test_categories core.test_xlsx_export goals.test_planning
```

## Documentación

- [Pruebas](docs/PRUEBAS.md): inventario, casos con valores esperados y resultados.

## Requisitos

- Python 3.11 o superior (probado con 3.13). Pandas 3 y NumPy 2.3 no soportan versiones anteriores.
- Node.js 20.19 o superior.

## Backend

Desde la raíz del proyecto, en PowerShell:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000 --noreload
```

La API queda disponible en `http://127.0.0.1:8000/api/health/`.

### Datos de demostración

Crea (o reinicia con `--reset`) un usuario con 3 cuentas, unos 190 movimientos de
los últimos 6 meses, presupuestos del mes actual, 2 metas de ahorro y alertas:

```powershell
python manage.py seed_demo --email demo@finova.local --password "Demo#2026" --reset
```

Si se omite `--password` para un usuario nuevo, se genera una contraseña al azar y
se muestra una sola vez en la consola.

Sin `--reset` el comando no toca un usuario que ya tenga datos. Solo modifica al
usuario indicado.

### Variables de entorno del backend

Todas son opcionales en desarrollo. En producción son obligatorias las relacionadas
con seguridad y dominio.

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | clave local insegura | Clave secreta; con `DJANGO_DEBUG=false` es obligatorio definir una propia |
| `DJANGO_DEBUG` | `true` | Desactivar en producción |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Hosts permitidos |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | localhost:5173-5175 | Orígenes confiables para CSRF |
| `DJANGO_CORS_ALLOWED_ORIGINS` | vacío | Orígenes CORS en producción |
| `DJANGO_COOKIE_SECURE` | `false` | `true` cuando se sirve por HTTPS |
| `DJANGO_SECURE_SSL_REDIRECT` | `false` | Redirigir HTTP a HTTPS |
| `DJANGO_SECURE_HSTS_SECONDS` | `0` | HSTS, solo con HTTPS verificado |
| `DJANGO_NUM_PROXIES` | `0` | Proxies delante de Django (p. ej. `1` detrás de nginx) |
| `FINOVA_THROTTLE_LOGIN_RATE` | `10/min` | Intentos de inicio de sesión por IP |
| `FINOVA_THROTTLE_REGISTER_RATE` | `10/hour` | Registros por IP |
| `FINOVA_THROTTLE_PASSWORD_RESET_RATE` | `5/hour` | Solicitudes de recuperación |
| `FINOVA_THROTTLE_VERIFY_RESEND_RATE` | `5/hour` | Reenvíos del enlace de verificación |
| `FINOVA_THROTTLE_PASSWORD_CHANGE_RATE` | `10/hour` | Cambios de contraseña |
| `FINOVA_FRONTEND_URL` | `http://localhost:5173` | Base de los enlaces de correo |
| `FINOVA_EMAIL_DELIVERY_ENABLED` | `false` | Activar envío real de correos |
| `DJANGO_EMAIL_BACKEND` | consola | Usar `django.core.mail.backends.smtp.EmailBackend` |
| `DJANGO_EMAIL_HOST` | vacío | Servidor SMTP |
| `DJANGO_EMAIL_PORT` | `587` | Puerto SMTP |
| `DJANGO_EMAIL_HOST_USER` | vacío | Usuario SMTP |
| `DJANGO_EMAIL_HOST_PASSWORD` | vacío | Contraseña SMTP |
| `DJANGO_EMAIL_USE_TLS` | `true` | TLS del SMTP |
| `DJANGO_DEFAULT_FROM_EMAIL` | `Finova <no-reply@finova.local>` | Remitente |

La recuperación de contraseña y la verificación de correo solo envían correos reales
cuando `FINOVA_EMAIL_DELIVERY_ENABLED=true`, existe `DJANGO_EMAIL_HOST` y el backend
es SMTP. En caso contrario, la API responde de forma explícita que el envío no está
configurado.

## Frontend

En otra terminal, desde la raíz del proyecto:

```powershell
cd frontend
npm install
npm run dev
```

Abre la URL que muestra Vite (normalmente `http://localhost:5173`). Las llamadas a
`/api` se reenvían al backend en `http://127.0.0.1:8000`.

Para compilar la versión de producción:

```powershell
cd frontend
npm run build
```

## API

Base: `/api/v1/`. Todo excepto `health/` y parte de `auth/` requiere sesión. Las
peticiones que modifican datos envían el token CSRF en el encabezado `X-CSRFToken`.

| Recurso | Endpoints |
| --- | --- |
| Autenticación | `auth/csrf/`, `register/`, `login/`, `logout/`, `logout-all/`, `session/`, `me/` (GET/PATCH), `password-change/`, `password-reset/`, `password-reset/confirm/`, `verify-email/`, `verify-email/resend/` |
| Resumen | `dashboard/resumen/?mes=` |
| Movimientos | `transacciones/` (GET con filtros y paginación, POST), `transacciones/<id>/` (PATCH, DELETE), `transacciones/transferir/`, `transacciones/depositar/`, `transacciones/exportar/?formato=xlsx\|csv&todo=1` (Excel por defecto) |
| Metas | `metas/` (GET, POST), `metas/<id>/` (GET, PATCH, DELETE), `metas/<id>/aportes/` (POST), `metas/<id>/aportes/<id>/` (DELETE) |
| Presupuestos | `presupuestos/` (GET, POST), `presupuestos/<id>/` (PATCH, DELETE), `presupuestos/copiar/`, `presupuestos/rebalancear/` |
| Cuentas | `cuentas/` (GET, POST), `cuentas/<id>/` (PATCH, DELETE), `cuentas/<id>/saldo/` |
| Alertas | `alertas/?estado=&tipo=`, `alertas/<id>/accion/`, `alertas/silenciar-todo/` |
| Otros | `periodos/`, `categorias/`, `impuestos/renta/?anio=&ingreso_anual=&deducciones_adicionales=` |

Errores: las reglas de negocio responden `400 {"detail": "..."}` y las validaciones
`400 {"campo": ["..."]}`, en español.

## Pruebas

Backend (443 pruebas):

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py test
```

Frontend (180 pruebas con Vitest sobre formato, validaciones, períodos, presupuestos,
impuestos, movimientos, metas, la API y componentes) y ESLint con las reglas de
SonarJS y accesibilidad que usa SonarCloud:

```powershell
cd frontend
npm test
npm run lint
npm run build
```

La compilación verifica imports, sintaxis y generación de Tailwind. Las pantallas se
revisaron con Playwright en 360 px (móvil), 768 px (tablet) y 1440 px (escritorio)
sin scroll horizontal.

## Estructura

```text
backend/
  config/            Configuración Django y URLs
  accounts/          Usuario, autenticación, tokens, límites de intentos
  core/
    models.py        Cuentas, movimientos, presupuestos y alertas (POO)
    views.py         Endpoints de finanzas
    finance.py       Consultas y serialización
    analytics.py     Pandas + NumPy: evolución del saldo y distribución de gastos
    transaction_filters.py  Filtros funcionales
    alerts.py        Reglas de alertas (puras) y alert_service.py (sincronización)
    budgets.py       Proyección y estado de presupuestos
    taxes.py         Impuesto a la Renta
    xlsx_export.py   Libro de Excel de la exportación (openpyxl)
    management/commands/seed_demo.py
  goals/             Metas de ahorro: modelos, API y planning.py (progreso y fecha estimada con NumPy)
frontend/src/
  App.jsx            Rutas
  layouts/           Header, menú lateral, barra inferior, selector de período
  features/          Una carpeta por pantalla: dashboard, transactions, budgets,
                     goals, accounts, alerts, settings, taxes
  components/ui/     Modal, formularios, confirmaciones, avisos, estados vacíos
  context/           Sesión, período, preferencias y recarga de datos
  lib/api/           Cliente de la API por recurso
  pages/             Login, registro, recuperación, verificación, legales
```

## Solución de problemas

### El frontend muestra "No pudimos conectar con el servidor"

Comprueba que Django esté escuchando en el puerto `8000`:

```powershell
curl.exe http://127.0.0.1:8000/api/health/
curl.exe http://localhost:5173/api/health/
```

Si quedaron procesos colgados de intentos anteriores en Windows:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*proyecto_lenguaje*manage.py*runserver*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Después vuelve a iniciar el backend. Usa `Ctrl+C` para detener los servidores y
`--noreload` en desarrollo para evitar procesos hijos huérfanos. Con `--noreload`
hay que reiniciar el servidor después de cambiar código o aplicar migraciones.

### Vite arranca en otro puerto

Si aparece `Port 5173 is in use, trying another one...`, hay otra instancia de Vite
abierta:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*vite*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

El proxy funciona en el puerto alternativo (`5174`, `5175`, etc.). Esos puertos ya
están incluidos en los orígenes CSRF de desarrollo por defecto.

### Error CSRF al iniciar sesión o registrarse

Confirma que estés entrando desde `http://localhost:5173` o
`http://127.0.0.1:5173` y que `DJANGO_CSRF_TRUSTED_ORIGINS` incluya el origen exacto
que usa el navegador. El frontend obtiene el token CSRF automáticamente.

### "Demasiados intentos"

El login, el registro y la recuperación tienen límite de intentos por IP. Espera el
tiempo indicado o ajusta las variables `FINOVA_THROTTLE_*` en desarrollo.
