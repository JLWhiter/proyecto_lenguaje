# proyecto-lenguaje

Monorepo con una API REST en Django y una interfaz en React con Vite.

## Requisitos

- Python 3.10 o superior
- Node.js 20.19 o superior

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

## Frontend

En otra terminal, desde la raíz del proyecto:

```powershell
cd frontend
npm install
npm run dev
```

Abre la URL que muestra Vite (normalmente `http://localhost:5173`). Las llamadas a `/api` se reenvían al backend en `http://127.0.0.1:8000`.

## Solución de problemas

### El frontend muestra "API no disponible"

El proxy de Vite devuelve un error `500` y en la terminal aparece:

```text
[vite] http proxy error: /api/health/
Error: connect ETIMEDOUT 127.0.0.1:8000
```

Esto casi siempre ocurre porque quedaron procesos `runserver` colgados de intentos
anteriores. Uno de ellos sigue ocupando el puerto `8000` pero ya no responde, así que
Vite no puede conectarse. En Windows, los procesos pueden sobrevivir al cerrar la
ventana de la terminal en lugar de detenerse con `Ctrl+C`.

**1. Revisa qué está escuchando en el puerto 8000:**

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen
```

**2. Detén todos los `runserver` del proyecto:**

```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*proyecto_lenguaje*manage.py*runserver*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

**3. Verifica que el puerto quedó libre y levanta el backend de nuevo:**

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen
cd backend
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --noreload
```

**4. Comprueba la conexión:**

```powershell
curl.exe http://127.0.0.1:8000/api/health/
curl.exe http://localhost:5173/api/health/
```

Ambas deben responder `HTTP 200` con:

```json
{"status": "ok", "service": "proyecto-lenguaje-api"}
```

### Vite arranca en otro puerto

Si aparece `Port 5173 is in use, trying another one...`, hay otra instancia de Vite
abierta. Cierra la terminal anterior o detén el proceso:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*vite*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

El proxy funciona igual en el puerto alternativo (`5174`, `5175`, etc.), solo usa la
URL que muestre Vite.

### Buenas prácticas para evitar procesos colgados

- Detén los servidores con `Ctrl+C` en su terminal, no cerrando la ventana.
- Usa `--noreload` en desarrollo para no dejar procesos hijos huérfanos.
- Antes de arrancar, confirma que los puertos `8000` y `5173` estén libres.

## Estructura

```text
backend/   Proyecto Django y aplicación core
frontend/  Aplicación React y configuración Vite
```