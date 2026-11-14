# Finova

Aplicación web responsive de gestión de finanzas personales. En esta primera etapa
el repositorio contiene **únicamente el módulo de autenticación**: registro, inicio
de sesión, cierre de sesión, recuperación de contraseña y verificación de correo.

- Backend: Python 3.13.13, Django 5.2 y Django REST Framework 3.16.
- Frontend: React 19, Vite 7, Tailwind CSS 4 y React Router 7.
- Persistencia: SQLite (configuración actual del proyecto, sin mezclar MySQL).
- Autenticación: sesiones de Django con cookie `HttpOnly`, CSRF y hash PBKDF2.

## Estado del módulo

Implementado y probado:

- Registro con nombre, correo único, moneda principal y contraseña segura.
- Inicio de sesión por correo con opción "Recordar mi sesión".
- Cierre de sesión y consulta del usuario autenticado.
- Rutas privadas protegidas en backend (`IsAuthenticated`) y frontend.
- Recuperación de contraseña con respuesta genérica para evitar enumeración de cuentas.
- Verificación de correo con token, disponible cuando se configure SMTP real.
- Formularios responsive de Login y Registro.

Pendiente de credenciales externas (no se simula ningún acceso):

- Google OAuth y Apple OAuth.
- WebAuthn / Face ID / huella.
- Envío real de correos mientras no exista configuración SMTP.
- TLS/HTTPS: depende del despliegue; en desarrollo local se usa HTTP.

## Requisitos

- Python 3.13.13.
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

### Variables de entorno del backend

Todas son opcionales en desarrollo. En producción son obligatorias las relacionadas
con seguridad y dominio.

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | clave local insegura | Clave secreta de Django |
| `DJANGO_DEBUG` | `true` | Desactivar en producción |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Hosts permitidos |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | localhost:5173-5175 | Orígenes confiables para CSRF |
| `DJANGO_CORS_ALLOWED_ORIGINS` | vacío | Orígenes CORS en producción |
| `DJANGO_COOKIE_SECURE` | `false` | `true` cuando se sirve por HTTPS |
| `DJANGO_SECURE_SSL_REDIRECT` | `false` | Redirigir HTTP a HTTPS |
| `DJANGO_SECURE_HSTS_SECONDS` | `0` | HSTS, solo con HTTPS verificado |
| `FINOVA_FRONTEND_URL` | `http://localhost:5173` | Base de enlaces de correo |
| `FINOVA_EMAIL_DELIVERY_ENABLED` | `false` | Activar envío real de correos |
| `DJANGO_EMAIL_BACKEND` | consola | Usar `django.core.mail.backends.smtp.EmailBackend` |
| `DJANGO_EMAIL_HOST` | vacío | Servidor SMTP |
| `DJANGO_EMAIL_PORT` | `587` | Puerto SMTP |
| `DJANGO_EMAIL_HOST_USER` | vacío | Usuario SMTP |
| `DJANGO_EMAIL_HOST_PASSWORD` | vacío | Contraseña SMTP |
| `DJANGO_EMAIL_USE_TLS` | `true` | TLS del SMTP |
| `DJANGO_DEFAULT_FROM_EMAIL` | `Finova <no-reply@finova.local>` | Remitente |

La recuperación de contraseña y la verificación de correo solo reportan envío real
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

## Endpoints de autenticación

Base: `/api/v1/auth/`

| Método | Endpoint | Acceso | Descripción |
| --- | --- | --- | --- |
| `GET` | `csrf/` | Público | Obtiene y establece la cookie CSRF |
| `POST` | `register/` | Público | Registra y autentica un usuario |
| `POST` | `login/` | Público | Inicia sesión; acepta `remember_me` |
| `POST` | `logout/` | Autenticado | Cierra la sesión |
| `GET` | `session/` | Público | Estado de sesión sin generar error 401 |
| `GET` | `me/` | Autenticado | Datos del usuario autenticado |
| `POST` | `password-reset/` | Público | Inicia recuperación (respuesta genérica) |
| `POST` | `password-reset/confirm/` | Público | Cambia la contraseña con `uid` y `token` |
| `POST` | `verify-email/` | Público | Confirma el correo con `uid` y `token` |

Ejemplo de registro:

```json
{
  "full_name": "Carlos Mendoza",
  "email": "carlos.mendoza@finova.pe",
  "currency": "PEN",
  "password": "Finova#2025",
  "password_confirm": "Finova#2025",
  "accept_terms": true
}
```

Ejemplo de login:

```json
{
  "email": "carlos.mendoza@finova.pe",
  "password": "Finova#2025",
  "remember_me": true
}
```

La sesión se guarda en la cookie `sessionid` con `HttpOnly`. El frontend no almacena
tokens en `localStorage`; envía la cookie CSRF en el encabezado `X-CSRFToken` para
las peticiones que modifican datos.

## Pruebas

Backend (26 pruebas):

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py test accounts -v 1
```

Comprueban registro, correo duplicado, correo inválido, contraseña débil, campos
vacíos, términos no aceptados, moneda inválida, login correcto/incorrecto, cuenta
inexistente, sesión, `me`, cierre de sesión, protección de rutas, recuperación
genérica y verificación de correo.

Frontend:

```powershell
cd frontend
npm run build
```

La compilación verifica imports, sintaxis y generación de Tailwind. Las pantallas
fueron revisadas en anchos de 390 px (móvil), 768 px (tablet) y 1440 px (desktop)
sin scroll horizontal.

## Estructura

```text
backend/
  config/          Configuración Django, URLs y despliegue
  core/            Endpoint de salud existente
  accounts/        Modelo User, serializers, vistas, servicios, tests
frontend/
  src/
    components/    AuthInput, PasswordInput, AuthCard, botones, iconos, guards
    context/       Estado global de autenticación
    lib/           Cliente API, CSRF y validaciones
    pages/         Login, Registro, recuperación, verificación, cuenta, legales
    services/      Llamadas a la API de autenticación
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
`--noreload` en desarrollo para evitar procesos hijos huérfanos.

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
