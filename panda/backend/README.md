# Panda Backend (Go + PostgreSQL)

Esta carpeta albergará la API autoritativa de Panda Portal construida en **Go (Golang)** conectada a **PostgreSQL**.

### Arquitectura prevista:
- **Framework / Router:** `chi` o `gin-gonic`
- **Driver de PostgreSQL:** `pgx/v5` con soporte de transacciones ACID y Connection Pooling
- **Seguridad y Auth:** JWT (JSON Web Tokens) + Bcrypt para hash de contraseñas
- **WebSockets:** Partidas en tiempo real y sincronización de saldo instantánea

### Endpoints planificados:
- `POST /api/v1/auth/register` (Registro de usuarios)
- `POST /api/v1/auth/login` (Autenticación y emisión de JWT)
- `GET  /api/v1/user/profile` (Consulta de perfil y saldo)
- `POST /api/v1/wallet/deposit` (Acreditación y registro de recargas)
- `POST /api/v1/games/start` (Cobro de entrada y emisión de ticket de juego)
- `POST /api/v1/games/finish` (Validación de puntuación y acreditación de ganancias)
