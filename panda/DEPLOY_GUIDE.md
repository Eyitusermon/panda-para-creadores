# 🚀 Guía de Despliegue a Producción: Panda Cash

Esta guía detalla los pasos exactos para desplegar el **Backend en Render** y el **Frontend en Vercel**, ambos conectados a la base de datos **Neon PostgreSQL**.

---

## 🐘 1. Base de Datos (Neon PostgreSQL) - ¡Ya lista!
La base de datos ya está en la nube en Neon.
Asegúrate de tener a mano tu variable de conexión `DATABASE_URL` que está en `panda/backend/.env`:
```env
DATABASE_URL="postgresql://neondb_owner:npg_Vz93DUgJKluO@ep-holy-fire-bdsiqtt3-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

---

## 🛠️ 2. Despliegue del Backend en Render (Go)

1. **Inicia sesión en [render.com](https://render.com/)**.
2. Haz clic en **New +** y selecciona **Web Service**.
3. Conecta tu repositorio de GitHub / GitLab.
4. Configura los siguientes campos:
   - **Name**: `panda-cash-backend` (o el nombre que prefieras).
   - **Region**: `Ohio (US East)` (o la más cercana a tu base de datos de Neon `us-east-2`).
   - **Branch**: `main` (o tu rama de producción).
   - **Root Directory**: `panda/backend`
   - **Runtime**: `Go`
   - **Build Command**: `go build -o server main.go`
   - **Start Command**: `./server`
   - **Plan**: `Free` (o el que elijas).
5. En la sección **Environment Variables**, añade:
   - `DATABASE_URL` = *(pega tu connection string de Neon)*
   - `PORT` = `10000` *(Render lo asigna automáticamente, pero es buena práctica declararlo)*
6. En **Advanced** (Opcional):
   - **Health Check Path**: `/api/v1/health`
7. Haz clic en **Create Web Service**.
8. Una vez finalizado el despliegue, Render te dará tu URL pública, por ejemplo:
   `https://panda-cash-backend.onrender.com`

> 💡 **Verificación**: Al abrir `https://panda-cash-backend.onrender.com/api/v1/health` en tu navegador, deberías ver:
> `{"database":"online_neon_api","service":"Panda Cash iGaming API...","status":"online_neon_api"}`

---

## 🌐 3. Despliegue del Frontend en Vercel

1. **Inicia sesión en [vercel.com](https://vercel.com/)**.
2. Haz clic en **Add New...** -> **Project** e importa tu repositorio.
3. En la configuración del proyecto:
   - **Project Name**: `panda-cash` (o el que prefieras).
   - **Root Directory**: Haz clic en *Edit* y selecciona la carpeta: `panda/frontend`
   - **Framework Preset**: Selecciona `Other` (Sitio Estático).
   - **Build and Output Settings**:
     - *Build Command*: Dejar vacío / desactivar toggle (es HTML/JS estático).
     - *Output Directory*: `.` (raíz del frontend).
4. **Vincular el Backend de Render**:
   - En el archivo `panda/frontend/vercel.json`, actualiza la URL de destino con la que te dio Render:
     ```json
     {
       "version": 2,
       "rewrites": [
         {
           "source": "/api/(.*)",
           "destination": "https://TU-BACKEND-RENDER.onrender.com/api/$1"
         }
       ]
     }
     ```
   - *Alternativa directa*: Si prefieres no usar rewrites de Vercel, simplemente abre `panda/frontend/config.js` y coloca la URL de Render en `DEFAULT_RENDER_URL`.
5. Haz clic en **Deploy**.
6. Vercel te entregará tu dominio público (ejemplo: `https://panda-cash.vercel.app`).

---

## 🎮 4. Rutas Limpias Profesionales en Producción (Clean URLs)

El sistema ahora cuenta con **Clean URLs automáticas** sin extensiones `.html` ni sufijos `_directo`:

- **Inicio / Entrada Inteligente**: `https://tu-dominio.vercel.app/` *(redirige a `/dashboard` si ya inició sesión, o a `/portal` si es nuevo)*
- **Portal & Registro VIP**: `https://tu-dominio.vercel.app/portal`
- **Lobby Principal & Juegos**: `https://tu-dominio.vercel.app/dashboard` (o `/lobby`)
- **Recargas TRC-20**: `https://tu-dominio.vercel.app/recargar`
- **Retiros USDT**: `https://tu-dominio.vercel.app/retirar`
- **Mi Perfil**: `https://tu-dominio.vercel.app/perfil`
- **Misiones & Cofres**: `https://tu-dominio.vercel.app/misiones`
- **Términos de Servicio**: `https://tu-dominio.vercel.app/terminos`
- **Juegos Arcade Directos**:
  - `https://tu-dominio.vercel.app/juegos/slots`
  - `https://tu-dominio.vercel.app/juegos/plinko`
  - `https://tu-dominio.vercel.app/juegos/rocket`
  - `https://tu-dominio.vercel.app/juegos/minas`
  - `https://tu-dominio.vercel.app/juegos/llaves`
- **Panel de Administración**: 
  - `https://tu-backend.onrender.com/admin` (servido automáticamente por Render)

---

## 🔒 5. Verificaciones Finales

- [x] **CORS**: `main.go` tiene `Access-Control-Allow-Origin: *` habilitado para todos los endpoints.
- [x] **Neon Serverless API**: El backend se comunica con Neon por HTTPS (puerto 443), compatible con cualquier host cloud sin bloqueos de firewall.
- [x] **Triggers de Recargas**: El trigger `trg_deposito_aprobado_auto_credit` acredita los diamantes en cuanto tu script de monitoreo o el endpoint apruebe la transacción.
- [x] **Retiros con Cola**: La lista de espera de 3 a 7 días y la auditoría manual funcionan de forma 100% persistente en Neon.
