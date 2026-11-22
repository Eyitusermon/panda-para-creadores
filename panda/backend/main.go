package main

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// Constante de economía del juego
const DiamondRate = 10 // 1 USDT = 10 Diamantes 💎
const VerificationFeeDiamonds = 100 // Costo de verificación (100 💎 = 10 USDT)

// -----------------------------------------------------------------------------
// CLIENTE NEON SERVERLESS HTTP SQL API (Puerto 443 / HTTPS Nativo)
// -----------------------------------------------------------------------------

type NeonClient struct {
	endpoint string
	connStr  string
	client   *http.Client
}

type NeonRequest struct {
	Query  string `json:"query"`
	Params []any  `json:"params"`
}

type NeonResponse struct {
	Rows     []map[string]any `json:"rows"`
	RowCount int              `json:"rowCount"`
	Command  string           `json:"command"`
	Message  string           `json:"message,omitempty"`
}

var neon *NeonClient

func NewNeonClient(connStr string) (*NeonClient, error) {
	u, err := url.Parse(connStr)
	if err != nil {
		return nil, err
	}
	endpoint := fmt.Sprintf("https://%s/sql", u.Host)
	return &NeonClient{
		endpoint: endpoint,
		connStr:  connStr,
		client:   &http.Client{Timeout: 12 * time.Second},
	}, nil
}

func (n *NeonClient) Query(sqlText string, params ...any) ([]map[string]any, error) {
	if params == nil {
		params = []any{}
	}
	reqBody, err := json.Marshal(NeonRequest{Query: sqlText, Params: params})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, n.endpoint, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Neon-Connection-String", n.connStr)

	resp, err := n.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		var errResp map[string]any
		_ = json.Unmarshal(bodyBytes, &errResp)
		if msg, ok := errResp["message"].(string); ok && msg != "" {
			return nil, fmt.Errorf("%s", msg)
		}
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var neonResp NeonResponse
	if err := json.Unmarshal(bodyBytes, &neonResp); err != nil {
		return nil, err
	}

	return neonResp.Rows, nil
}

func (n *NeonClient) QueryRow(sqlText string, params ...any) (map[string]any, error) {
	rows, err := n.Query(sqlText, params...)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("sql: no rows in result set")
	}
	return rows[0], nil
}

func (n *NeonClient) Exec(sqlText string, params ...any) error {
	_, err := n.Query(sqlText, params...)
	return err
}

// -----------------------------------------------------------------------------
// MODELOS Y ALMACÉN DE SESIÓN
// -----------------------------------------------------------------------------

type User struct {
	ID                     string     `json:"id"`
	Username               string     `json:"username"`
	Email                  string     `json:"email"`
	Phone                  string     `json:"phone,omitempty"`
	PasswordHash           string     `json:"-"`
	SecurityQuestion       string     `json:"security_question,omitempty"`
	SecurityAnswerHash     string     `json:"-"`
	
	CuentaVerificada       bool       `json:"cuenta_verificada"`
	FechaVerificacion      *time.Time `json:"fecha_verificacion,omitempty"`
	TxHashVerificacion     string     `json:"tx_hash_verificacion,omitempty"`
	MetodoPagoVerificacion string     `json:"metodo_pago_verificacion,omitempty"`
	PrimerDepositoRealizado bool       `json:"primer_deposito_realizado"`
	TieneRecargaAprobada    bool       `json:"tiene_recarga_aprobada"`

	VIPLevel               string     `json:"vip_level"`
	VIPXP                  int        `json:"vip_xp"`
	BalanceDiamantes       int64      `json:"balance_diamantes"`
	BalanceBonoDiamantes   int64      `json:"balance_bono_diamantes"`
	GirosGratis            int        `json:"giros_gratis"`
	UltimoCofreAbiertoAt   *time.Time `json:"ultimo_cofre_abierto_at,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
}

type DepositRecord struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	Username        string     `json:"username"`
	MontoUSDT       float64    `json:"monto_usdt"`
	MontoDiamantes  int64      `json:"monto_diamantes"`
	TxHashTron      string     `json:"tx_hash_tron"`
	WalletDestino   string     `json:"wallet_destino"`
	Estado          string     `json:"estado"`
	FechaCreacion   time.Time  `json:"fecha_creacion"`
	FechaAprobacion *time.Time `json:"fecha_aprobacion,omitempty"`
}

type UserStore struct {
	mu             sync.RWMutex
	users          map[string]*User
	depositos      map[string]*DepositRecord
	depositsByHash map[string]*DepositRecord
}

var store = &UserStore{
	users:          make(map[string]*User),
	depositos:      make(map[string]*DepositRecord),
	depositsByHash: make(map[string]*DepositRecord),
}

func loadEnv(filepath string) {
	file, err := os.Open(filepath)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			v = strings.Trim(v, "\"'")
			if os.Getenv(k) == "" {
				os.Setenv(k, v)
			}
		}
	}
}

func initDatabase() {
	loadEnv(".env")
	loadEnv("panda/backend/.env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Println("ℹ️ [INFO] DATABASE_URL no encontrada. Operando en modo memoria local.")
		return
	}

	client, err := NewNeonClient(dbURL)
	if err != nil {
		fmt.Printf("⚠️ [NEON ERROR] URL inválida: %v\n", err)
		return
	}

	// Test rápido de conectividad HTTP SQL API
	row, err := client.QueryRow("SELECT current_database() as db, count(*)::int as count FROM users;")
	if err != nil {
		fmt.Printf("⚠️ [NEON ERROR] No se pudo consultar la API de Neon: %v. Operando en fallback.\n", err)
		return
	}

	neon = client
	fmt.Printf("🐘 [NEON HTTP SQL API] ¡Conexión exitosa a la base de datos '%v' en Neon.tech! (Usuarios en Neon: %v)\n", row["db"], row["count"])
}

func normalizeAnswer(ans string) string {
	ans = strings.ToLower(strings.TrimSpace(ans))
	replacer := strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u")
	return replacer.Replace(ans)
}

func hashSecurityAnswer(ans string) string {
	normalized := normalizeAnswer(ans)
	if normalized == "" {
		normalized = "pelusa"
	}
	sum := sha256.Sum256([]byte("panda_sec_salt_" + normalized))
	return hex.EncodeToString(sum[:])
}

func hashPassword(pass string) string {
	sum := sha256.Sum256([]byte("panda_salt_2026_" + pass))
	return hex.EncodeToString(sum[:])
}

func initStore() {
	now := time.Now()
	store.users["pandamaster_99"] = &User{
		ID:                   "usr_demo_001",
		Username:             "PandaMaster_99",
		Email:                "pandamaster@pandabet.com",
		PasswordHash:         hashPassword("123456"),
		CuentaVerificada:     true,
		FechaVerificacion:    &now,
		TxHashVerificacion:   "tron_tx_init_sample_001",
		SecurityQuestion:     "¿Cuál fue el nombre de tu primera mascota?",
		SecurityAnswerHash:   hashSecurityAnswer("pelusa"),
		VIPLevel:             "Panda Bronce",
		VIPXP:                650,
		BalanceDiamantes:     15000,
		BalanceBonoDiamantes: 30000,
		GirosGratis:          150,
		CreatedAt:            time.Now(),
	}
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	enableCORS(w)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// -----------------------------------------------------------------------------
// AUTENTICACIÓN: REGISTRO Y LOGIN
// -----------------------------------------------------------------------------

type RegisterRequest struct {
	Username         string `json:"username"`
	Email            string `json:"email"`
	Phone            string `json:"phone"`
	Password         string `json:"password"`
	PromoCode        string `json:"promo_code"`
	Method           string `json:"method"`
	SecurityQuestion string `json:"security_question,omitempty"`
	SecurityAnswer   string `json:"security_answer,omitempty"`
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formato JSON inválido"})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		req.Username = fmt.Sprintf("Panda_%d", time.Now().Unix()%100000)
	}
	key := strings.ToLower(req.Username)

	// --- 1. MODO NEON SERVERLESS API ---
	if neon != nil {
		passHash := hashPassword(req.Password)
		secQ := req.SecurityQuestion
		if secQ == "" {
			secQ = "¿Cuál fue el nombre de tu primera mascota?"
		}
		secAnsHash := hashSecurityAnswer(req.SecurityAnswer)

		userRow, err := neon.QueryRow(`
			INSERT INTO users (username, email, phone, password_hash, security_question, security_answer_hash, cuenta_verificada, vip_level, vip_xp)
			VALUES ($1, NULLIF(TRIM($2), ''), NULLIF(TRIM($3), ''), $4, $5, $6, FALSE, 'Panda Bronce', 0)
			RETURNING id::text, created_at
		`, req.Username, req.Email, req.Phone, passHash, secQ, secAnsHash)

		if err != nil {
			if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique constraint") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "El usuario o correo ya se encuentra registrado"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error creando usuario en Neon: " + err.Error()})
			return
		}

		newID := fmt.Sprintf("%v", userRow["id"])

		// Crear billetera con SALDO ESTRICTAMENTE EN 0
		_ = neon.Exec(`
			INSERT INTO wallets (user_id, balance_diamantes, balance_bono_diamantes, giros_gratis)
			VALUES ($1::uuid, 0, 0, 0)
		`, newID)

		user := &User{
			ID:                   newID,
			Username:             req.Username,
			Email:                req.Email,
			Phone:                req.Phone,
			CuentaVerificada:     false,
			VIPLevel:             "Panda Bronce",
			VIPXP:                0,
			BalanceDiamantes:     0,
			BalanceBonoDiamantes: 0,
			GirosGratis:          0,
			CreatedAt:            time.Now(),
		}

		store.mu.Lock()
		store.users[key] = user
		store.mu.Unlock()

		writeJSON(w, http.StatusCreated, map[string]any{
			"message": "¡Cuenta creada con éxito en Neon! Bienvenida/o a Panda Cash.",
			"user":    user,
			"token":   fmt.Sprintf("jwt_neon_%s", newID),
		})
		return
	}

	// --- 2. FALLBACK EN MEMORIA ---
	store.mu.Lock()
	defer store.mu.Unlock()

	if _, exists := store.users[key]; exists {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "El nombre de usuario ya se encuentra registrado"})
		return
	}

	newUser := &User{
		ID:                   fmt.Sprintf("usr_%d", time.Now().UnixNano()%1000000),
		Username:             req.Username,
		Email:                req.Email,
		Phone:                req.Phone,
		PasswordHash:         hashPassword(req.Password),
		CuentaVerificada:     false,
		VIPLevel:             "Panda Bronce",
		VIPXP:                0,
		BalanceDiamantes:     0,
		BalanceBonoDiamantes: 0,
		GirosGratis:          0,
		CreatedAt:            time.Now(),
	}

	store.users[key] = newUser

	writeJSON(w, http.StatusCreated, map[string]any{
		"message": "¡Cuenta creada con éxito! Bienvenida/o a Panda Cash.",
		"user":    newUser,
		"token":   fmt.Sprintf("mock_jwt_panda_%s", newUser.ID),
	})
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formato JSON inválido"})
		return
	}

	cleanUser := strings.TrimSpace(req.Username)
	key := strings.ToLower(cleanUser)

	// --- 1. MODO NEON SERVERLESS API ---
	if neon != nil {
		row, err := neon.QueryRow(`
			SELECT u.id::text, u.username, COALESCE(u.email, '') as email, COALESCE(u.phone, '') as phone, u.password_hash,
			       u.cuenta_verificada, u.fecha_verificacion, COALESCE(u.tx_hash_verificacion, '') as tx_hash_verificacion,
			       COALESCE(u.metodo_pago_verificacion, '') as metodo_pago_verificacion,
			       u.vip_level, u.vip_xp, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes,
			       COALESCE(w.balance_bono_diamantes, 0)::bigint as balance_bono_diamantes,
			       COALESCE(w.giros_gratis, 0)::int as giros_gratis, u.ultimo_cofre_abierto_at, u.created_at
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE LOWER(u.username) = $1 OR LOWER(u.email) = $1
		`, key)

		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Credenciales inválidas (usuario no encontrado)"})
			return
		}

		dbPassHash := fmt.Sprintf("%v", row["password_hash"])
		if hashPassword(req.Password) != dbPassHash {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Contraseña incorrecta"})
			return
		}

		user := parseUserFromRow(row)

		writeJSON(w, http.StatusOK, map[string]any{
			"message": "Inicio de sesión exitoso",
			"user":    user,
			"token":   fmt.Sprintf("jwt_neon_%s", user.ID),
		})
		return
	}

	// --- 2. FALLBACK EN MEMORIA ---
	store.mu.RLock()
	user, exists := store.users[key]
	store.mu.RUnlock()

	if !exists {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Credenciales inválidas (usuario no encontrado)"})
		return
	}

	if hashPassword(req.Password) != user.PasswordHash {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Contraseña incorrecta"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Inicio de sesión exitoso",
		"user":    user,
		"token":   fmt.Sprintf("mock_jwt_panda_%s", user.ID),
	})
}

func parseNumber(val any) int64 {
	switch v := val.(type) {
	case float64:
		return int64(v)
	case int64:
		return v
	case int:
		return int64(v)
	case string:
		var n int64
		fmt.Sscanf(v, "%d", &n)
		return n
	default:
		return 0
	}
}

func parseUserFromRow(row map[string]any) *User {
	balance := parseNumber(row["balance_diamantes"])
	bonus := parseNumber(row["balance_bono_diamantes"])
	spins := int(parseNumber(row["giros_gratis"]))
	xp := int(parseNumber(row["vip_xp"]))

	isVerified := false
	if v, ok := row["cuenta_verificada"].(bool); ok {
		isVerified = v
	}

	primerDep := false
	if v, ok := row["primer_deposito_realizado"].(bool); ok {
		primerDep = v
	}

	tieneRecarga := false
	if v, ok := row["tiene_recarga_aprobada"].(bool); ok {
		tieneRecarga = v
	}

	return &User{
		ID:                      fmt.Sprintf("%v", row["id"]),
		Username:                fmt.Sprintf("%v", row["username"]),
		Email:                   fmt.Sprintf("%v", row["email"]),
		Phone:                   fmt.Sprintf("%v", row["phone"]),
		CuentaVerificada:        isVerified,
		PrimerDepositoRealizado: primerDep,
		TieneRecargaAprobada:    tieneRecarga,
		VIPLevel:                fmt.Sprintf("%v", row["vip_level"]),
		VIPXP:                   xp,
		BalanceDiamantes:        balance,
		BalanceBonoDiamantes:    bonus,
		GirosGratis:             spins,
		CreatedAt:               time.Now(),
	}
}

// -----------------------------------------------------------------------------
// PERFIL DE USUARIO
// -----------------------------------------------------------------------------

func handleProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}

	username := r.URL.Query().Get("username")
	if username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Parámetro 'username' requerido"})
		return
	}
	key := strings.ToLower(strings.TrimSpace(username))

	if neon != nil {
		row, err := neon.QueryRow(`
			SELECT u.id::text, u.username, COALESCE(u.email, '') as email, COALESCE(u.phone, '') as phone,
			       u.cuenta_verificada, u.fecha_verificacion, COALESCE(u.tx_hash_verificacion, '') as tx_hash_verificacion,
			       COALESCE(u.metodo_pago_verificacion, '') as metodo_pago_verificacion,
			       u.vip_level, u.vip_xp, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes,
			       COALESCE(w.balance_bono_diamantes, 0)::bigint as balance_bono_diamantes,
			       COALESCE(w.giros_gratis, 0)::int as giros_gratis, u.ultimo_cofre_abierto_at, u.created_at,
			       COALESCE(u.primer_deposito_realizado, false) as primer_deposito_realizado,
			       EXISTS (
			           SELECT 1 FROM depositos d 
			           WHERE (d.user_id = u.id OR LOWER(d.username) = LOWER(u.username))
			             AND d.estado IN ('APROBADA', 'APROBADO', 'COMPLETADO')
			             AND COALESCE(d.tipo, 'RECARGA') = 'RECARGA'
			       ) as tiene_recarga_aprobada
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE LOWER(u.username) = $1
		`, key)
		if err == nil {
			writeJSON(w, http.StatusOK, parseUserFromRow(row))
			return
		}
	}

	store.mu.RLock()
	user, exists := store.users[key]
	store.mu.RUnlock()

	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	writeJSON(w, http.StatusOK, user)
}

// -----------------------------------------------------------------------------
// PAGO Y ACTIVACIÓN DE VERIFICACIÓN (Tasa 10 USDT / 100 💎)
// -----------------------------------------------------------------------------

type PayVerificationRequest struct {
	Username string `json:"username"`
	Metodo   string `json:"metodo"`
	TxHash   string `json:"tx_hash,omitempty"`
}

func handlePayVerification(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req PayVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formato JSON inválido"})
		return
	}

	key := strings.ToLower(strings.TrimSpace(req.Username))

	if neon != nil {
		userRow, err := neon.QueryRow(`SELECT id::text FROM users WHERE LOWER(username) = $1`, key)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado en Neon"})
			return
		}
		userID := fmt.Sprintf("%v", userRow["id"])

		if req.Metodo == "usdt_trc20" {
			req.TxHash = strings.TrimSpace(req.TxHash)
			if len(req.TxHash) < 15 {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "Por favor ingresa un TXID / Hash de transacción de TRON válido.",
				})
				return
			}

			// Obtener dirección oficial activa de recargas
			activeWallet := "TXjR9sK7pLm2N8vW4qZ1yB5xT3cV6hJ9kL"
			dirRow, err := neon.QueryRow(`SELECT direccion_tron FROM direcciones_recarga WHERE activa = TRUE LIMIT 1`)
			if err == nil && dirRow != nil && dirRow["direccion_tron"] != nil {
				activeWallet = fmt.Sprintf("%v", dirRow["direccion_tron"])
			}

			// Insertar en tabla 'depositos' con tipo 'VERIFICACION' y estado 'PENDIENTE'
			// para que el script externo del usuario lo detecte, verifique y apruebe
			err = neon.Exec(`
				INSERT INTO depositos (user_id, username, monto_usdt, monto_diamantes, red_blockchain, tron_wallet_destino, tx_hash_tron, estado, tipo)
				VALUES ($1::uuid, $2, 10.00, 0, 'TRC-20', $3, $4, 'PENDIENTE', 'VERIFICACION')
			`, userID, req.Username, activeWallet, req.TxHash)

			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error registrando pago de verificación: " + err.Error()})
				return
			}

			writeJSON(w, http.StatusOK, map[string]any{
				"success":           true,
				"message":           "Tu pago de verificación de 10 USDT se ha registrado como PENDIENTE. Tu cuenta se verificará automáticamente al confirmarse en la red TRON.",
				"estado":            "PENDIENTE",
				"tipo":              "VERIFICACION",
				"tx_hash":           req.TxHash,
				"cuenta_verificada": false,
			})
			return
		}

		resRow, err := neon.QueryRow(`SELECT pagar_y_activar_verificacion($1::uuid, $2, $3) as res`, userID, req.Metodo, req.TxHash)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, resRow["res"])
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	user, exists := store.users[key]
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	if user.CuentaVerificada {
		writeJSON(w, http.StatusOK, map[string]any{
			"message":           "La cuenta ya se encuentra verificada",
			"cuenta_verificada": true,
		})
		return
	}

	if req.Metodo == "saldo_diamantes" {
		if user.BalanceDiamantes < VerificationFeeDiamonds {
			writeJSON(w, http.StatusPaymentRequired, map[string]string{
				"error": "Saldo insuficiente de diamantes para pagar la verificación (requiere 100 💎).",
			})
			return
		}
		user.BalanceDiamantes -= VerificationFeeDiamonds
	}

	now := time.Now()
	user.CuentaVerificada = true
	user.FechaVerificacion = &now
	user.MetodoPagoVerificacion = req.Metodo
	user.TxHashVerificacion = req.TxHash

	writeJSON(w, http.StatusOK, map[string]any{
		"message":           "¡Cuenta verificada exitosamente! Retiros habilitados.",
		"cuenta_verificada": true,
		"nuevo_balance":     user.BalanceDiamantes,
	})
}

// -----------------------------------------------------------------------------
// DIRECCIÓN PÚBLICA DE RECARGA (Leída dinámicamente desde la tabla direcciones_recarga)
// -----------------------------------------------------------------------------

func handleGetDireccionRecarga(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	if neon != nil {
		row, err := neon.QueryRow(`
			SELECT id, red, moneda, direccion, activa, descripcion, updated_at
			FROM direcciones_recarga
			WHERE activa = TRUE
			ORDER BY id ASC
			LIMIT 1
		`)
		if err == nil && row != nil && len(row) > 0 {
			writeJSON(w, http.StatusOK, map[string]any{
				"ok":          true,
				"id":          row["id"],
				"red":         row["red"],
				"moneda":      row["moneda"],
				"direccion":   row["direccion"],
				"activa":      row["activa"],
				"descripcion": row["descripcion"],
			})
			return
		}
	}

	// Fallback por defecto si no está conectada la base de datos
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"id":          1,
		"red":         "TRON (TRC-20)",
		"moneda":      "USDT",
		"direccion":   "TYDnyP8p2nQoD9jA5kU8v9L9w5b3x7K2zM",
		"activa":      true,
		"descripcion": "Dirección pública oficial de recargas Panda Cash",
	})
}

// -----------------------------------------------------------------------------
// RECARGAS (Fase 1: Inserción PENDIENTE -> Fase 2: Script monitor cambia a APROBADA)
// -----------------------------------------------------------------------------

type DepositRequest struct {
	Username      string  `json:"username"`
	MontoUSDT     float64 `json:"monto_usdt"`
	TxHash        string  `json:"tx_hash,omitempty"`
	WalletDestino string  `json:"wallet_destino,omitempty"`
}

func handleDeposit(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req DepositRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formato JSON inválido"})
		return
	}

	key := strings.ToLower(strings.TrimSpace(req.Username))

	if req.MontoUSDT < 10 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "El monto mínimo de recarga es de 10 USDT (equivalente a 100 💎 Diamantes).",
		})
		return
	}

	txHash := strings.TrimSpace(req.TxHash)
	if txHash == "" {
		txHash = fmt.Sprintf("tx_tron_%d_%s", time.Now().UnixNano(), key)
	}

	walletDestino := strings.TrimSpace(req.WalletDestino)
	if walletDestino == "" {
		walletDestino = "TK9x8YPandaOfficialTRC20ColdWalletV3"
	}

	addedDiamonds := int64(req.MontoUSDT * float64(DiamondRate))

	// --- 1. MODO NEON SERVERLESS API ---
	if neon != nil {
		userRow, err := neon.QueryRow(`SELECT id::text FROM users WHERE LOWER(username) = $1`, key)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado en Neon"})
			return
		}
		userID := fmt.Sprintf("%v", userRow["id"])

		depRow, err := neon.QueryRow(`
			INSERT INTO depositos (user_id, monto_usdt, monto_diamantes, red_blockchain, tron_wallet_destino, tx_hash_tron, estado)
			VALUES ($1::uuid, $2, $3, 'TRC-20', $4, $5, 'PENDIENTE')
			RETURNING id::text, created_at
		`, userID, req.MontoUSDT, addedDiamonds, walletDestino, txHash)

		if err != nil {
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "Este TxID ya fue registrado previamente"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error insertando depósito: " + err.Error()})
			return
		}

		record := &DepositRecord{
			ID:             fmt.Sprintf("%v", depRow["id"]),
			UserID:         userID,
			Username:       req.Username,
			MontoUSDT:      req.MontoUSDT,
			MontoDiamantes: addedDiamonds,
			TxHashTron:     txHash,
			WalletDestino:  walletDestino,
			Estado:         "PENDIENTE",
			FechaCreacion:  time.Now(),
		}

		writeJSON(w, http.StatusCreated, map[string]any{
			"status":   "ok",
			"message":  "Recarga registrada como PENDIENTE. Esperando confirmación de la red Tron por el script monitor.",
			"deposito": record,
		})
		return
	}

	// --- 2. FALLBACK EN MEMORIA ---
	store.mu.Lock()
	defer store.mu.Unlock()

	user, exists := store.users[key]
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	if existing, alreadyHas := store.depositsByHash[txHash]; alreadyHas {
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":    "Este TxID o hash ya se encuentra registrado",
			"deposito": existing,
		})
		return
	}

	depID := fmt.Sprintf("dep_%d", time.Now().UnixNano()%10000000)
	record := &DepositRecord{
		ID:             depID,
		UserID:         user.ID,
		Username:       user.Username,
		MontoUSDT:      req.MontoUSDT,
		MontoDiamantes: addedDiamonds,
		TxHashTron:     txHash,
		WalletDestino:  walletDestino,
		Estado:         "PENDIENTE",
		FechaCreacion:  time.Now(),
	}

	store.depositos[depID] = record
	store.depositsByHash[txHash] = record

	writeJSON(w, http.StatusCreated, map[string]any{
		"message":               "Recarga registrada como PENDIENTE. Esperando confirmación de la red Tron por el script monitor.",
		"status":                "ok",
		"deposito":              record,
		"balance_actual_diamantes": user.BalanceDiamantes,
	})
}

// Endpoint para el Script de Monitoreo TRON
type ApproveDepositRequest struct {
	TxHash    string `json:"tx_hash"`
	DepositID string `json:"deposit_id,omitempty"`
}

func handleApproveDeposit(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req ApproveDepositRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formato JSON inválido"})
		return
	}

	txHash := strings.TrimSpace(req.TxHash)
	if txHash == "" && req.DepositID != "" {
		txHash = strings.TrimSpace(req.DepositID)
	}

	// --- 1. MODO NEON SERVERLESS API (Invocación directa de stored proc) ---
	if neon != nil {
		row, err := neon.QueryRow(`SELECT aprobar_deposito($1) as res`, txHash)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error aprobando depósito en Neon: " + err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, row["res"])
		return
	}

	// --- 2. FALLBACK EN MEMORIA ---
	store.mu.Lock()
	defer store.mu.Unlock()

	var record *DepositRecord
	if txHash != "" {
		record = store.depositsByHash[txHash]
	}
	if record == nil && req.DepositID != "" {
		record = store.depositos[req.DepositID]
	}

	if record == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Depósito no encontrado con ese TxID o ID"})
		return
	}

	if record.Estado == "APROBADA" {
		writeJSON(w, http.StatusOK, map[string]any{
			"message":  "El depósito ya se encontraba aprobado previamente",
			"deposito": record,
		})
		return
	}

	now := time.Now()
	record.Estado = "APROBADA"
	record.FechaAprobacion = &now

	userKey := strings.ToLower(record.Username)
	user, exists := store.users[userKey]
	var newBalance int64 = 0
	if exists {
		user.BalanceDiamantes += record.MontoDiamantes
		user.VIPXP += int(record.MontoUSDT * 2)
		newBalance = user.BalanceDiamantes
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":                 "¡Recarga APROBADA exitosamente! Saldo acreditado al usuario.",
		"status":                  "ok",
		"deposito":                record,
		"nuevo_balance_diamantes": newBalance,
	})
}

// Consultar estado de recargas
func handleCheckDepositStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}

	txHash := strings.TrimSpace(r.URL.Query().Get("tx_hash"))
	depID := strings.TrimSpace(r.URL.Query().Get("id"))
	username := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("username")))

	if neon != nil {
		if txHash != "" {
			row, err := neon.QueryRow(`
				SELECT d.id::text, d.user_id::text, u.username, d.monto_usdt, d.monto_diamantes,
				       COALESCE(d.tx_hash_tron, '') as tx_hash_tron, d.tron_wallet_destino, d.estado, d.created_at, d.fecha_aprobacion
				FROM depositos d
				JOIN users u ON d.user_id = u.id
				WHERE LOWER(TRIM(d.tx_hash_tron)) = LOWER(TRIM($1)) OR d.id::text = TRIM($1)
				LIMIT 1
			`, txHash)
			if err == nil && row != nil && len(row) > 0 {
				writeJSON(w, http.StatusOK, row)
				return
			}
		}

		if depID != "" {
			row, err := neon.QueryRow(`
				SELECT d.id::text, d.user_id::text, u.username, d.monto_usdt, d.monto_diamantes,
				       COALESCE(d.tx_hash_tron, '') as tx_hash_tron, d.tron_wallet_destino, d.estado, d.created_at, d.fecha_aprobacion
				FROM depositos d
				JOIN users u ON d.user_id = u.id
				WHERE d.id::text = TRIM($1) OR LOWER(TRIM(d.tx_hash_tron)) = LOWER(TRIM($1))
				LIMIT 1
			`, depID)
			if err == nil && row != nil && len(row) > 0 {
				writeJSON(w, http.StatusOK, row)
				return
			}
		}

		if username != "" {
			rows, err := neon.Query(`
				SELECT d.id::text, d.user_id::text, u.username, d.monto_usdt, d.monto_diamantes,
				       COALESCE(d.tx_hash_tron, '') as tx_hash_tron, d.tron_wallet_destino, d.estado, d.created_at, d.fecha_aprobacion
				FROM depositos d
				JOIN users u ON d.user_id = u.id
				WHERE LOWER(u.username) = $1
				ORDER BY d.created_at DESC
				LIMIT 100
			`, username)
			if err == nil {
				writeJSON(w, http.StatusOK, map[string]any{
					"username":  username,
					"depositos": rows,
				})
				return
			}
		}
	}

	store.mu.RLock()
	defer store.mu.RUnlock()

	if txHash != "" {
		if rec, ok := store.depositsByHash[txHash]; ok {
			writeJSON(w, http.StatusOK, rec)
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Depósito no encontrado"})
		return
	}

	if depID != "" {
		if rec, ok := store.depositos[depID]; ok {
			writeJSON(w, http.StatusOK, rec)
			return
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Depósito no encontrado"})
		return
	}

	if username != "" {
		var userDeposits []*DepositRecord
		for _, d := range store.depositos {
			if strings.ToLower(d.Username) == username {
				userDeposits = append(userDeposits, d)
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"username":  username,
			"depositos": userDeposits,
		})
		return
	}

	writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Se requiere tx_hash, id o username"})
}

// -----------------------------------------------------------------------------
// RETIROS (Restringidos estrictamente por cuenta_verificada)
// -----------------------------------------------------------------------------

type WithdrawRequest struct {
	Username    string `json:"username"`
	Diamantes   int64  `json:"diamantes"`
	TronAddress string `json:"tron_address"`
}

func handleWithdraw(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req WithdrawRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formato JSON inválido"})
		return
	}

	req.TronAddress = strings.TrimSpace(req.TronAddress)
	if !strings.HasPrefix(req.TronAddress, "T") || len(req.TronAddress) < 30 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Dirección Tron inválida. Debe ser una billetera TRC-20 que comience con 'T'.",
		})
		return
	}

	if req.Diamantes < 1000 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "El monto mínimo de retiro es de 1,000 💎 (equivalente a 100 USDT).",
		})
		return
	}

	key := strings.ToLower(strings.TrimSpace(req.Username))

	// --- 1. MODO NEON SERVERLESS API (Con Trigger de Seguridad Estricto en Neon) ---
	if neon != nil {
		userRow, err := neon.QueryRow(`
			SELECT u.id::text, u.cuenta_verificada, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE LOWER(u.username) = $1
		`, key)

		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado en Neon"})
			return
		}

		userID := fmt.Sprintf("%v", userRow["id"])
		isVerified := false
		if v, ok := userRow["cuenta_verificada"].(bool); ok {
			isVerified = v
		}

		balance := parseNumber(userRow["balance_diamantes"])

		if !isVerified {
			writeJSON(w, http.StatusForbidden, map[string]any{
				"error":              "REGLA_BLOQUEO: Cuenta no verificada",
				"message":            "Tu cuenta no se encuentra verificada. Debes pagar la tasa de verificación (10 USDT / 100 💎) antes de poder retirar.",
				"cuenta_verificada": false,
			})
			return
		}

		// Regla de Seguridad Antifraude: Verificar que el usuario tenga al menos 1 recarga real aprobada (tipo = 'RECARGA')
		depRow, err := neon.QueryRow(`
			SELECT count(*)::int as count 
			FROM depositos 
			WHERE (user_id = $1::uuid OR LOWER(username) = $2) 
			  AND estado IN ('APROBADA', 'APROBADO', 'COMPLETADO')
			  AND COALESCE(tipo, 'RECARGA') = 'RECARGA'
		`, userID, key)

		depCount := 0
		if err == nil && depRow != nil {
			depCount = int(parseNumber(depRow["count"]))
		}

		if depCount == 0 {
			writeJSON(w, http.StatusForbidden, map[string]any{
				"error":            "REGLA_BLOQUEO: Requiere recarga previa",
				"message":          "Para poder solicitar retiros de ganancias, es obligatorio haber realizado al menos una recarga de saldo en tu cuenta (el pago de verificación no cuenta como recarga).",
				"requiere_recarga": true,
			})
			return
		}

		if balance < req.Diamantes {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": fmt.Sprintf("Saldo insuficiente. Tu saldo es de %d 💎 e intentas retirar %d 💎.", balance, req.Diamantes),
			})
			return
		}

		montoUsdt := float64(req.Diamantes) / float64(DiamondRate)

		// Tiempo aleatorio en lista de espera: entre 3 días (72h) y 7 días (168h) para procesamiento manual
		minHoras := 72
		maxHoras := 168
		randomHoras := minHoras + rand.Intn(maxHoras-minHoras+1)
		randomDias := (randomHoras + 12) / 24
		if randomDias < 3 {
			randomDias = 3
		}
		if randomDias > 7 {
			randomDias = 7
		}
		fechaEstimada := time.Now().Add(time.Duration(randomHoras) * time.Hour)

		retRow, err := neon.QueryRow(`
			INSERT INTO retiros (user_id, monto_diamantes, monto_usdt, red_blockchain, tron_wallet_receptora, estado, tiempo_estimado_dias, fecha_estimada_liberacion, nota_procesamiento)
			VALUES ($1::uuid, $2, $3, 'TRC-20', $4, 'EN_ESPERA', $5, $6, 'Procesamiento manual por equipo de seguridad y auditoría financiera')
			RETURNING id::text
		`, userID, req.Diamantes, montoUsdt, req.TronAddress, randomDias, fechaEstimada)

		if err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}

		_ = neon.Exec(`
			UPDATE wallets
			SET balance_diamantes = balance_diamantes - $2,
			    total_retirado_usdt = total_retirado_usdt + $3,
			    updated_at = NOW()
			WHERE user_id = $1::uuid
		`, userID, req.Diamantes, montoUsdt)

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":                     true,
			"estado":                 "EN_ESPERA",
			"message":                "¡Solicitud de retiro ingresada en Lista de Espera! Se procesará de forma manual.",
			"aclaracion_manual":      "Por políticas de seguridad y auditoría financiera, los retiros se procesan de forma estrictamente manual. Tu solicitud se encuentra en cola de espera.",
			"tiempo_estimado_dias":   randomDias,
			"tiempo_estimado_horas":  randomHoras,
			"fecha_estimada":         fechaEstimada.Format("02/01/2006 15:04 MST"),
			"fecha_estimada_rfc":     fechaEstimada.Format(time.RFC3339),
			"retiro_id":              retRow["id"],
			"diamantes_debitados":    req.Diamantes,
			"monto_usdt":             montoUsdt,
			"wallet_destino":         req.TronAddress,
			"nuevo_balance":          balance - req.Diamantes,
		})
		return
	}

	// --- 2. FALLBACK EN MEMORIA ---
	store.mu.Lock()
	defer store.mu.Unlock()

	user, exists := store.users[key]
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	if !user.CuentaVerificada {
		writeJSON(w, http.StatusForbidden, map[string]any{
			"error":              "REGLA_BLOQUEO: Cuenta no verificada",
			"message":            "Tu cuenta no se encuentra verificada. Debes pagar la tasa de verificación (10 USDT / 100 💎) antes de poder retirar.",
			"cuenta_verificada": false,
		})
		return
	}

	if !user.PrimerDepositoRealizado {
		writeJSON(w, http.StatusForbidden, map[string]any{
			"error":            "REGLA_BLOQUEO: Requiere recarga previa",
			"message":          "Para poder solicitar retiros de ganancias, es obligatorio haber realizado al menos una recarga de saldo en tu cuenta (el pago de verificación no cuenta como recarga).",
			"requiere_recarga": true,
		})
		return
	}

	if user.BalanceDiamantes < req.Diamantes {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("Saldo insuficiente. Tu saldo es de %d 💎 e intentas retirar %d 💎.", user.BalanceDiamantes, req.Diamantes),
		})
		return
	}

	user.BalanceDiamantes -= req.Diamantes
	montoUsdt := float64(req.Diamantes) / float64(DiamondRate)

	minHoras := 72
	maxHoras := 168
	randomHoras := minHoras + rand.Intn(maxHoras-minHoras+1)
	randomDias := (randomHoras + 12) / 24
	if randomDias < 3 {
		randomDias = 3
	}
	if randomDias > 7 {
		randomDias = 7
	}
	fechaEstimada := time.Now().Add(time.Duration(randomHoras) * time.Hour)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                    true,
		"estado":                "EN_ESPERA",
		"message":               "¡Solicitud de retiro ingresada en Lista de Espera! Se procesará de forma manual.",
		"aclaracion_manual":     "Por políticas de seguridad y auditoría financiera, los retiros se procesan de forma estrictamente manual. Tu solicitud se encuentra en cola de espera.",
		"tiempo_estimado_dias":  randomDias,
		"tiempo_estimado_horas": randomHoras,
		"fecha_estimada":        fechaEstimada.Format("02/01/2006 15:04 MST"),
		"fecha_estimada_rfc":    fechaEstimada.Format(time.RFC3339),
		"retiro_id":             fmt.Sprintf("ret_%d", time.Now().UnixNano()%1000000),
		"diamantes_debitados":   req.Diamantes,
		"monto_usdt":            montoUsdt,
		"wallet_destino":        req.TronAddress,
		"nuevo_balance":         user.BalanceDiamantes,
	})
}

// -----------------------------------------------------------------------------
// COFRE DIARIO (COOLDOWN 24H)
// -----------------------------------------------------------------------------

type DailyChestRequest struct {
	Username string `json:"username"`
}

func handleDailyChest(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req DailyChestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formato JSON inválido"})
		return
	}

	key := strings.ToLower(strings.TrimSpace(req.Username))

	if neon != nil {
		userRow, err := neon.QueryRow(`SELECT id::text FROM users WHERE LOWER(username) = $1`, key)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
			return
		}
		userID := fmt.Sprintf("%v", userRow["id"])

		resRow, err := neon.QueryRow(`SELECT reclamar_cofre_diario($1::uuid) as res`, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, resRow["res"])
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	user, exists := store.users[key]
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	now := time.Now()
	if user.UltimoCofreAbiertoAt != nil {
		duracionDesdeUltimo := now.Sub(*user.UltimoCofreAbiertoAt)
		if duracionDesdeUltimo < 24*time.Hour {
			tiempoRestante := 24*time.Hour - duracionDesdeUltimo
			writeJSON(w, http.StatusTooManyRequests, map[string]any{
				"error":                       "COOLDOWN_ACTIVO",
				"message":                     "Debes esperar 24 horas desde tu última apertura para reclamar el cofre.",
				"ultimo_cofre_abierto_at":     user.UltimoCofreAbiertoAt,
				"proximo_cofre_disponible_at": user.UltimoCofreAbiertoAt.Add(24 * time.Hour),
				"segundos_restantes":          int(tiempoRestante.Seconds()),
			})
			return
		}
	}

	randVal := rand.Float64() * 100.0
	var rewardType string
	var rewardAmount int
	var rewardLabel string

	switch {
	case randVal < 48.0:
		rewardType = "XP"
		rewardAmount = 100
		rewardLabel = "+100 XP VIP"
	case randVal < 80.0:
		rewardType = "DIAMANTES"
		rewardAmount = 50
		rewardLabel = "+50 💎 (5 USDT)"
	case randVal < 91.0:
		rewardType = "XP"
		rewardAmount = 200
		rewardLabel = "+200 XP VIP"
	case randVal < 96.5:
		rewardType = "XP"
		rewardAmount = 500
		rewardLabel = "+500 XP VIP"
	case randVal < 99.2:
		rewardType = "DIAMANTES"
		rewardAmount = 100
		rewardLabel = "+100 💎 (10 USDT)"
	default:
		rewardType = "DIAMANTES"
		rewardAmount = 200
		rewardLabel = "+200 💎 (20 USDT)"
	}

	user.UltimoCofreAbiertoAt = &now
	if rewardType == "XP" {
		user.VIPXP += rewardAmount
	} else {
		user.BalanceDiamantes += int64(rewardAmount)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":                     "¡Cofre reclamado con éxito!",
		"premio":                      rewardLabel,
		"tipo":                        rewardType,
		"cantidad":                    rewardAmount,
		"nuevo_balance_diamantes":     user.BalanceDiamantes,
		"nuevo_vip_xp":                user.VIPXP,
		"ultimo_cofre_abierto_at":     user.UltimoCofreAbiertoAt,
		"proximo_cofre_disponible_at": now.Add(24 * time.Hour),
	})
}

// -----------------------------------------------------------------------------
// RECUPERACIÓN DE CONTRASEÑA POR PREGUNTAS DE SEGURIDAD
// -----------------------------------------------------------------------------

type SecurityQuestionRequest struct {
	Username string `json:"username"`
}

func handleSecurityQuestion(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req SecurityQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido"})
		return
	}

	username := strings.TrimSpace(req.Username)
	if username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "El nombre de usuario es obligatorio"})
		return
	}

	if neon != nil {
		row, err := neon.QueryRow(`SELECT username, COALESCE(security_question, '¿Cuál fue el nombre de tu primera mascota?') as question FROM users WHERE LOWER(username) = $1`, strings.ToLower(username))
		if err == nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"ok":       true,
				"username": row["username"],
				"question": row["question"],
			})
			return
		}
	}

	store.mu.RLock()
	user, exists := store.users[strings.ToLower(username)]
	store.mu.RUnlock()

	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "El usuario no existe"})
		return
	}

	question := user.SecurityQuestion
	if question == "" {
		question = "¿Cuál fue el nombre de tu primera mascota?"
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"username": user.Username,
		"question": question,
	})
}

type ResetBySecurityRequest struct {
	Username    string `json:"username"`
	Answer      string `json:"answer"`
	NewPassword string `json:"new_password"`
}

func handleResetBySecurity(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req ResetBySecurityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido"})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Answer = strings.TrimSpace(req.Answer)
	req.NewPassword = strings.TrimSpace(req.NewPassword)

	if req.Username == "" || req.Answer == "" || req.NewPassword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Todos los campos son obligatorios"})
		return
	}

	if len(req.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "La nueva contraseña debe tener al menos 6 caracteres"})
		return
	}

	if neon != nil {
		row, err := neon.QueryRow(`SELECT COALESCE(security_answer_hash, '') as hash FROM users WHERE LOWER(username) = $1`, strings.ToLower(req.Username))
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
			return
		}

		expectedHash := fmt.Sprintf("%v", row["hash"])
		if expectedHash == "" {
			expectedHash = hashSecurityAnswer("pelusa")
		}

		if hashSecurityAnswer(req.Answer) != expectedHash {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "La respuesta de seguridad es incorrecta"})
			return
		}

		_ = neon.Exec(`UPDATE users SET password_hash = $1 WHERE LOWER(username) = $2`, hashPassword(req.NewPassword), strings.ToLower(req.Username))

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"message": "Contraseña actualizada exitosamente en Neon",
		})
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	user, exists := store.users[strings.ToLower(req.Username)]
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	expectedHash := user.SecurityAnswerHash
	if expectedHash == "" {
		expectedHash = hashSecurityAnswer("pelusa")
	}

	if hashSecurityAnswer(req.Answer) != expectedHash {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "La respuesta de seguridad es incorrecta"})
		return
	}

	user.PasswordHash = hashPassword(req.NewPassword)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": "Contraseña actualizada exitosamente",
	})
}

type UpdateSecurityQuestionRequest struct {
	Username string `json:"username"`
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

func handleUpdateSecurityQuestion(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req UpdateSecurityQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido"})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Question = strings.TrimSpace(req.Question)
	req.Answer = strings.TrimSpace(req.Answer)

	if req.Username == "" || req.Question == "" || req.Answer == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Usuario, pregunta y respuesta son requeridos"})
		return
	}

	if neon != nil {
		_ = neon.Exec(`
			UPDATE users
			SET security_question = $1, security_answer_hash = $2
			WHERE LOWER(username) = $3
		`, req.Question, hashSecurityAnswer(req.Answer), strings.ToLower(req.Username))

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":       true,
			"message":  "Pregunta de seguridad actualizada exitosamente en Neon",
			"question": req.Question,
		})
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	user, exists := store.users[strings.ToLower(req.Username)]
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	user.SecurityQuestion = req.Question
	user.SecurityAnswerHash = hashSecurityAnswer(req.Answer)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"message":  "Pregunta de seguridad actualizada exitosamente",
		"question": user.SecurityQuestion,
	})
}

// -----------------------------------------------------------------------------
// ENCUESTAS DIARIAS
// -----------------------------------------------------------------------------

type SurveyQuestion struct {
	ID       string   `json:"id"`
	Pregunta string   `json:"pregunta"`
	Opciones []string `json:"opciones"`
}

type DailySurvey struct {
	ID                  string           `json:"id"`
	Titulo              string           `json:"titulo"`
	Categoria           string           `json:"categoria"`
	RecompensaDiamantes int              `json:"recompensa_diamantes"`
	DuracionEstimada    string           `json:"duracion_estimada"`
	Preguntas           []SurveyQuestion `json:"preguntas"`
}

func getEncuestasDisponibles() []DailySurvey {
	return []DailySurvey{
		{
			ID:                  "encuesta_crypto_2026",
			Titulo:              "Hábitos de Criptomonedas y Retiros TRC-20",
			Categoria:           "Finanzas & Blockchain",
			RecompensaDiamantes: 50,
			DuracionEstimada:    "1 min",
			Preguntas: []SurveyQuestion{
				{
					ID:       "p1",
					Pregunta: "¿Utilizas la stablecoin USDT (Tether) habitualmente?",
					Opciones: []string{
						"Sí, para recargar, jugar y mover capital",
						"Solo ocasionalmente",
						"Es mi primera vez usando USDT TRC-20",
					},
				},
				{
					ID:       "p2",
					Pregunta: "¿Qué factor valoras más al retirar tus ganancias de Panda Cash?",
					Opciones: []string{
						"Rapidez en la aprobación",
						"Comisiones de red extremadamente bajas",
						"Soporte 24/7 en vivo",
					},
				},
			},
		},
	}
}

func handleGetEncuestasHoy(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"fecha":     time.Now().Format("2006-01-02"),
		"encuestas": getEncuestasDisponibles(),
	})
}

type SurveyAnswerPayload struct {
	PreguntaID           string `json:"pregunta_id"`
	Pregunta             string `json:"pregunta"`
	RespuestaSeleccionada string `json:"respuesta_seleccionada"`
}

type SurveySubmissionRequest struct {
	Username   string                `json:"username"`
	EncuestaID string                `json:"encuesta_id"`
	Respuestas []SurveyAnswerPayload `json:"respuestas"`
}

func handleResponderEncuesta(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req SurveySubmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formato JSON inválido"})
		return
	}

	if len(req.Respuestas) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Debes responder las preguntas de la encuesta"})
		return
	}

	key := strings.ToLower(strings.TrimSpace(req.Username))

	if neon != nil {
		respJSON, _ := json.Marshal(req.Respuestas)
		userRow, err := neon.QueryRow(`SELECT id::text FROM users WHERE LOWER(username) = $1`, key)
		var userIDParam any = nil
		if err == nil {
			userIDParam = userRow["id"]
		}

		err = neon.Exec(`
			INSERT INTO respuestas_encuestas (encuesta_id, encuesta_titulo, categoria, user_id, username, respuestas, recompensa_diamantes)
			VALUES ($1, 'Encuesta de Calidad', 'Comunidad', $2::uuid, $3, $4::jsonb, 50)
		`, req.EncuestaID, userIDParam, req.Username, string(respJSON))

		if err != nil {
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "Ya has completado esta encuesta en el día de hoy"})
				return
			}
		}

		if userIDParam != nil {
			_ = neon.Exec(`UPDATE wallets SET balance_diamantes = balance_diamantes + 50 WHERE user_id = $1::uuid`, userIDParam)
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"message":              "¡Encuesta completada exitosamente! Se han sumado +50 💎 a tu cuenta.",
			"recompensa_diamantes": 50,
		})
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	user, exists := store.users[key]
	var newBal int64 = 50
	if exists {
		user.BalanceDiamantes += 50
		newBal = user.BalanceDiamantes
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":                 "¡Encuesta completada exitosamente! Se han sumado +50 💎 a tu cuenta.",
		"recompensa_diamantes":    50,
		"nuevo_balance_diamantes": newBal,
	})
}

func handleGetRespuestasEncuestas(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// =============================================================================
// ADMINISTRACIÓN: GESTIÓN DE TABLAS DE NEON (DIRECCIONES, USUARIOS, TRANSACCIONES)
// =============================================================================

func handleAdminStats(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if neon == nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"total_users": 0, "total_diamantes": 0, "pending_depositos": 0, "pending_retiros": 0, "active_address": "",
		})
		return
	}

	uRow, _ := neon.QueryRow("SELECT COUNT(*) as count FROM users")
	wRow, _ := neon.QueryRow("SELECT COALESCE(SUM(balance_diamantes), 0) as total FROM wallets")
	dRow, _ := neon.QueryRow("SELECT COUNT(*) as count FROM depositos WHERE estado = 'PENDIENTE'")
	rRow, _ := neon.QueryRow("SELECT COUNT(*) as count FROM retiros WHERE estado IN ('EN_ESPERA', 'PENDIENTE', 'SOLICITADO', 'PROCESANDO')")
	aRow, _ := neon.QueryRow("SELECT direccion, red FROM direcciones_recarga WHERE activa = TRUE LIMIT 1")

	activeAddr := ""
	if aRow != nil && aRow["direccion"] != nil {
		activeAddr = fmt.Sprintf("%v", aRow["direccion"])
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total_users":       parseNumber(uRow["count"]),
		"total_diamantes":   parseNumber(wRow["total"]),
		"pending_depositos": parseNumber(dRow["count"]),
		"pending_retiros":   parseNumber(rRow["count"]),
		"active_address":    activeAddr,
	})
}

func handleAdminGetDirecciones(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if neon == nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	rows, err := neon.Query("SELECT id, red, moneda, direccion, activa, descripcion, updated_at FROM direcciones_recarga ORDER BY id ASC")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

type AdminSaveDireccionReq struct {
	ID          int    `json:"id"`
	Red         string `json:"red"`
	Moneda      string `json:"moneda"`
	Direccion   string `json:"direccion"`
	Activa      bool   `json:"activa"`
	Descripcion string `json:"descripcion"`
}

func handleAdminSaveDireccion(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}
	if neon == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Base de datos Neon offline"})
		return
	}

	var req AdminSaveDireccionReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "JSON inválido"})
		return
	}
	req.Direccion = strings.TrimSpace(req.Direccion)
	if req.Direccion == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "La dirección no puede estar vacía"})
		return
	}
	if req.Red == "" {
		req.Red = "TRON (TRC-20)"
	}
	if req.Moneda == "" {
		req.Moneda = "USDT"
	}

	if req.Activa {
		// Desactivar las demás
		_ = neon.Exec("UPDATE direcciones_recarga SET activa = FALSE")
	}

	if req.ID > 0 {
		err := neon.Exec(`
			UPDATE direcciones_recarga
			SET red = $1, moneda = $2, direccion = $3, activa = $4, descripcion = $5, updated_at = NOW()
			WHERE id = $6
		`, req.Red, req.Moneda, req.Direccion, req.Activa, req.Descripcion, req.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	} else {
		err := neon.Exec(`
			INSERT INTO direcciones_recarga (red, moneda, direccion, activa, descripcion, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
		`, req.Red, req.Moneda, req.Direccion, req.Activa, req.Descripcion)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Dirección guardada exitosamente"})
}

type AdminIDReq struct {
	ID int `json:"id"`
}

func handleAdminSetActiveDireccion(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}
	if neon == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Base de datos Neon offline"})
		return
	}
	var req AdminIDReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ID inválido"})
		return
	}
	err := neon.Exec("UPDATE direcciones_recarga SET activa = (id = $1), updated_at = NOW()", req.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Dirección activada como principal"})
}

func handleAdminGetUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if neon == nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	query := `
		SELECT u.id::text, u.username, COALESCE(u.email, '') as email, COALESCE(u.phone, '') as phone,
		       u.vip_level, u.vip_xp, u.cuenta_verificada,
		       COALESCE(w.balance_diamantes, 0) as balance_diamantes,
		       COALESCE(w.balance_bono_diamantes, 0) as balance_bono_diamantes,
		       u.created_at
		FROM users u
		LEFT JOIN wallets w ON u.id = w.user_id
		ORDER BY u.created_at DESC
		LIMIT 100
	`
	rows, err := neon.Query(query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

type AdminUpdateUserReq struct {
	UserID               string `json:"user_id"`
	BalanceDiamantes     int64  `json:"balance_diamantes"`
	BalanceBonoDiamantes int64  `json:"balance_bono_diamantes"`
	VIPLevel             string `json:"vip_level"`
	CuentaVerificada     bool   `json:"cuenta_verificada"`
}

func handleAdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}
	if neon == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Base de datos Neon offline"})
		return
	}
	var req AdminUpdateUserReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Datos de usuario inválidos"})
		return
	}

	err := neon.Exec(`
		UPDATE users 
		SET cuenta_verificada = $1, vip_level = $2
		WHERE id = $3::uuid
	`, req.CuentaVerificada, req.VIPLevel, req.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error actualizando usuario: " + err.Error()})
		return
	}

	err = neon.Exec(`
		UPDATE wallets 
		SET balance_diamantes = $1, balance_bono_diamantes = $2, updated_at = NOW()
		WHERE user_id = $3::uuid
	`, req.BalanceDiamantes, req.BalanceBonoDiamantes, req.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error actualizando billetera: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Usuario y saldo actualizados exitosamente"})
}

func handleAdminGetDepositos(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if neon == nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	rows, err := neon.Query(`
		SELECT d.id::text, d.user_id::text, COALESCE(u.username, 'Usuario Desconocido') as username,
		       d.monto_usdt, d.monto_diamantes, d.red_blockchain, d.tron_wallet_destino,
		       COALESCE(d.tx_hash_tron, '') as tx_hash_tron, d.estado, d.fecha_aprobacion, d.created_at
		FROM depositos d
		LEFT JOIN users u ON d.user_id = u.id
		ORDER BY d.created_at DESC
		LIMIT 100
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func handleAdminGetRetiros(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if neon == nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	rows, err := neon.Query(`
		SELECT r.id::text, r.user_id::text, COALESCE(u.username, 'Usuario Desconocido') as username,
		       r.monto_diamantes, r.monto_usdt, r.red_blockchain,
		       COALESCE(r.tron_wallet_receptora, '') as tron_wallet_receptora,
		       r.estado, COALESCE(r.tiempo_estimado_dias, 5) as tiempo_estimado_dias,
		       r.fecha_estimada_liberacion, r.nota_procesamiento, r.created_at
		FROM retiros r
		LEFT JOIN users u ON r.user_id = u.id
		ORDER BY r.created_at DESC
		LIMIT 100
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

type AdminProcessRetiroReq struct {
	RetiroID string `json:"retiro_id"`
	Estado   string `json:"estado"`
}

func handleAdminProcessRetiro(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}
	if neon == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Base de datos Neon offline"})
		return
	}
	var req AdminProcessRetiroReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RetiroID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Datos inválidos"})
		return
	}
	// Normalizar nombres de estado
	if req.Estado == "APROBADO" {
		req.Estado = "DESPACHADO"
	}
	if req.Estado != "DESPACHADO" && req.Estado != "RECHAZADO" && req.Estado != "PROCESANDO" && req.Estado != "SOLICITADO" && req.Estado != "EN_ESPERA" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Estado debe ser DESPACHADO, RECHAZADO, PROCESANDO o EN_ESPERA"})
		return
	}
	err := neon.Exec("UPDATE retiros SET estado = $1 WHERE id = $2::uuid", req.Estado, req.RetiroID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Retiro actualizado a " + req.Estado})
}

// -----------------------------------------------------------------------------
// MAIN ENTRYPOINT
// -----------------------------------------------------------------------------

func main() {
	initStore()
	initDatabase()

	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		status := "online_local"
		if neon != nil {
			status = "online_neon_api"
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status":   status,
			"service":  "Panda Cash iGaming API (Go + Neon Serverless HTTP SQL API)",
			"database": status,
			"time":     time.Now().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("/api/v1/auth/register", handleRegister)
	mux.HandleFunc("/api/v1/auth/login", handleLogin)
	mux.HandleFunc("/api/v1/auth/security-question", handleSecurityQuestion)
	mux.HandleFunc("/api/v1/auth/reset-by-security", handleResetBySecurity)
	mux.HandleFunc("/api/v1/user/update-security-question", handleUpdateSecurityQuestion)
	mux.HandleFunc("/api/v1/user/profile", handleProfile)
	mux.HandleFunc("/api/v1/user/pagar-verificacion", handlePayVerification)
	mux.HandleFunc("/api/v1/user/cofre-diario", handleDailyChest)
	mux.HandleFunc("/api/v1/wallet/retirar", handleWithdraw)
	mux.HandleFunc("/api/v1/wallet/direccion-recarga", handleGetDireccionRecarga)
	mux.HandleFunc("/api/v1/wallet/recargar", handleDeposit)
	mux.HandleFunc("/api/v1/wallet/aprobar-recarga", handleApproveDeposit)
	mux.HandleFunc("/api/v1/wallet/recarga-status", handleCheckDepositStatus)
	mux.HandleFunc("/api/v1/encuestas/hoy", handleGetEncuestasHoy)
	mux.HandleFunc("/api/v1/encuestas/responder", handleResponderEncuesta)
	mux.HandleFunc("/api/v1/encuestas/respuestas", handleGetRespuestasEncuestas)

	// --- RUTAS DE ADMINISTRACIÓN ---
	mux.HandleFunc("/api/v1/admin/stats", handleAdminStats)
	mux.HandleFunc("/api/v1/admin/direcciones", handleAdminGetDirecciones)
	mux.HandleFunc("/api/v1/admin/direcciones/guardar", handleAdminSaveDireccion)
	mux.HandleFunc("/api/v1/admin/direcciones/activar", handleAdminSetActiveDireccion)
	mux.HandleFunc("/api/v1/admin/users", handleAdminGetUsers)
	mux.HandleFunc("/api/v1/admin/users/editar", handleAdminUpdateUser)
	mux.HandleFunc("/api/v1/admin/depositos", handleAdminGetDepositos)
	mux.HandleFunc("/api/v1/admin/retiros", handleAdminGetRetiros)
	mux.HandleFunc("/api/v1/admin/retiros/procesar", handleAdminProcessRetiro)

	// Servir panel estático de administración
	mux.Handle("/admin/", http.StripPrefix("/admin/", http.FileServer(http.Dir("../administrador"))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}
	fmt.Printf("🐼 Servidor Panda Cash Go API corriendo en http://localhost:%s\n", port)
	fmt.Println("📌 Rutas activas conectadas a Neon Serverless API:")
	fmt.Println("   - POST /api/v1/auth/register (Registro en tabla users + wallets)")
	fmt.Println("   - POST /api/v1/auth/login (Login y validación en Neon)")
	fmt.Println("   - GET  /api/v1/user/profile?username=...")
	fmt.Println("   - POST /api/v1/user/pagar-verificacion (Ejecuta stored proc pagar_y_activar_verificacion)")
	fmt.Println("   - POST /api/v1/wallet/retirar (Protegido por trigger en tabla retiros)")
	fmt.Println("   - GET  /api/v1/wallet/direccion-recarga (Lee dirección pública de recarga desde tabla direcciones_recarga)")
	fmt.Println("   - POST /api/v1/wallet/recargar (Inserta en tabla depositos como PENDIENTE)")
	fmt.Println("   - POST /api/v1/wallet/aprobar-recarga (Ejecuta stored proc aprobar_deposito)")
	fmt.Println("   - GET  /api/v1/wallet/recarga-status?tx_hash=...")

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Error iniciando servidor: %v", err)
	}
}
