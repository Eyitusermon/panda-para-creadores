package main

import (
	"bufio"
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// Constante de economía del juego
const DiamondRate = 10                 // 1 USDT = 10 Diamantes 💎
const VerificationFeeDiamonds = 100    // Costo de verificación (100 💎 = 10 USDT)
const SurveyRewardDiamonds int64 = 50  // Recompensa fija de encuesta diaria en servidor
const MaxSyncWinMultiplier int64 = 1000 // Multiplicador máximo por apuesta en sync-balance (Panda Creadores)
const MaxSingleSyncWin int64 = 100000   // Tope máximo de ganancia neta por sincronización (Panda Creadores)

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
	UltimaRuletaGiradaAt   *time.Time `json:"ultima_ruleta_girada_at,omitempty"`
	UltimoBonoSemanalAt    *time.Time `json:"ultimo_bono_semanal_at,omitempty"`
	WeeklyWageredDiamantes int64      `json:"weekly_wagered_diamantes"`
	ActiveBetPool          int64      `json:"-"`
	LastBetAt              *time.Time `json:"-"`
	CreatedAt              time.Time  `json:"created_at"`
}

type AuditLogRecord struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id,omitempty"`
	Username      string    `json:"username"`
	Action        string    `json:"action"`
	Delta         int64     `json:"delta"`
	BalanceBefore int64     `json:"balance_before"`
	BalanceAfter  int64     `json:"balance_after"`
	IPAddress     string    `json:"ip_address"`
	Details       string    `json:"details"`
	CreatedAt     time.Time `json:"created_at"`
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
	auditLogs      []AuditLogRecord
	surveyClaims   map[string]bool
}

var store = &UserStore{
	users:          make(map[string]*User),
	depositos:      make(map[string]*DepositRecord),
	depositsByHash: make(map[string]*DepositRecord),
	auditLogs:      make([]AuditLogRecord, 0, 128),
	surveyClaims:   make(map[string]bool),
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

	// Auto-migración segura de columnas y auditoría requeridas
	migrations := []string{
		`ALTER TABLE depositos ADD COLUMN IF NOT EXISTS username VARCHAR(100)`,
		`ALTER TABLE depositos ADD COLUMN IF NOT EXISTS tipo VARCHAR(30) DEFAULT 'RECARGA'`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS primer_deposito_realizado BOOLEAN DEFAULT FALSE`,
		`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS active_bet_pool BIGINT NOT NULL DEFAULT 0`,
		`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS last_bet_at TIMESTAMPTZ NULL`,
		`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS weekly_wagered_diamantes BIGINT NOT NULL DEFAULT 0`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS ultima_ruleta_girada_at TIMESTAMPTZ NULL`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS ultimo_bono_semanal_at TIMESTAMPTZ NULL`,
		`CREATE TABLE IF NOT EXISTS balance_audit_logs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
			username VARCHAR(100) NOT NULL,
			action VARCHAR(50) NOT NULL,
			delta BIGINT NOT NULL DEFAULT 0,
			balance_before BIGINT NOT NULL DEFAULT 0,
			balance_after BIGINT NOT NULL DEFAULT 0,
			ip_address VARCHAR(80) DEFAULT '',
			details TEXT DEFAULT '',
			created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_user_created ON balance_audit_logs(user_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_created ON balance_audit_logs(created_at DESC)`,
	}
	for _, m := range migrations {
		_ = neon.Exec(m)
	}
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
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key")
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	enableCORS(w)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// -----------------------------------------------------------------------------
// SEGURIDAD: FIRMA HMAC DE SESIÓN, CLAVE ADMIN Y AUDITORÍA DE SALDO
// -----------------------------------------------------------------------------

type SessionClaims struct {
	UID      string `json:"uid"`
	Username string `json:"username"`
	IAT      int64  `json:"iat"`
	EXP      int64  `json:"exp"`
}

func getSessionSigningSecret() []byte {
	if jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET")); jwtSecret != "" {
		sum := sha256.Sum256([]byte("panda_session_signing_v1:" + jwtSecret))
		return sum[:]
	}
	if dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL")); dbURL != "" {
		sum := sha256.Sum256([]byte("panda_session_signing_v1:" + dbURL))
		return sum[:]
	}
	sum := sha256.Sum256([]byte("panda_local_dev_fallback_secret"))
	return sum[:]
}

func generateSessionToken(userID, username string) string {
	now := time.Now().Unix()
	claims := SessionClaims{
		UID:      strings.TrimSpace(userID),
		Username: strings.TrimSpace(username),
		IAT:      now,
		EXP:      now + 30*24*3600,
	}
	rawJSON, _ := json.Marshal(claims)
	payloadB64 := base64.RawURLEncoding.EncodeToString(rawJSON)
	mac := hmac.New(sha256.New, getSessionSigningSecret())
	mac.Write([]byte(payloadB64))
	sigB64 := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payloadB64 + "." + sigB64
}

func verifySessionToken(token string) (*SessionClaims, error) {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return nil, fmt.Errorf("formato de token inválido")
	}
	mac := hmac.New(sha256.New, getSessionSigningSecret())
	mac.Write([]byte(parts[0]))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if len(parts[1]) != len(expectedSig) || subtle.ConstantTimeCompare([]byte(parts[1]), []byte(expectedSig)) != 1 {
		return nil, fmt.Errorf("firma de token inválida")
	}
	rawClaims, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("claims corruptos")
	}
	var claims SessionClaims
	if err := json.Unmarshal(rawClaims, &claims); err != nil {
		return nil, fmt.Errorf("JSON de token inválido")
	}
	if claims.Username == "" || claims.EXP <= time.Now().Unix() {
		return nil, fmt.Errorf("token expirado")
	}
	return &claims, nil
}

func extractBearerToken(r *http.Request) string {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(auth) > 7 && strings.EqualFold(auth[:7], "Bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return ""
}

func getClientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 && strings.TrimSpace(parts[0]) != "" {
			return strings.TrimSpace(parts[0])
		}
	}
	if xrip := strings.TrimSpace(r.Header.Get("X-Real-IP")); xrip != "" {
		return xrip
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func appendMemAuditLocked(userID, username, action string, delta, before, after int64, ip, details string) {
	rec := AuditLogRecord{
		ID:            fmt.Sprintf("aud_%d", time.Now().UnixNano()),
		UserID:        strings.TrimSpace(userID),
		Username:      strings.TrimSpace(username),
		Action:        action,
		Delta:         delta,
		BalanceBefore: before,
		BalanceAfter:  after,
		IPAddress:     ip,
		Details:       details,
		CreatedAt:     time.Now(),
	}
	store.auditLogs = append([]AuditLogRecord{rec}, store.auditLogs...)
	if len(store.auditLogs) > 500 {
		store.auditLogs = store.auditLogs[:500]
	}
}

func logBalanceAudit(userID, username, action string, delta, before, after int64, ip, details string) {
	if neon != nil {
		err := neon.Exec(`
			INSERT INTO balance_audit_logs (user_id, username, action, delta, balance_before, balance_after, ip_address, details)
			VALUES (NULLIF($1, '')::uuid, $2, $3, $4, $5, $6, $7, $8)
		`, strings.TrimSpace(userID), strings.TrimSpace(username), action, delta, before, after, ip, details)
		if err != nil {
			log.Printf("[AUDIT WARN] No se pudo insertar log de auditoría: %v", err)
		}
		return
	}
	store.mu.Lock()
	appendMemAuditLocked(userID, username, action, delta, before, after, ip, details)
	store.mu.Unlock()
}

func requireUserSession(w http.ResponseWriter, r *http.Request, requestedUsername string) (*SessionClaims, bool) {
	token := extractBearerToken(r)
	if token == "" {
		if strings.TrimSpace(requestedUsername) != "" {
			logBalanceAudit("", requestedUsername, "BLOCKED_AUTH", 0, 0, 0, getClientIP(r), "Token ausente en "+r.URL.Path)
		}
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error":         "Sesión expirada o no autenticada. Inicia sesión nuevamente.",
			"auth_required": true,
		})
		return nil, false
	}
	claims, err := verifySessionToken(token)
	if err != nil {
		if strings.TrimSpace(requestedUsername) != "" {
			logBalanceAudit("", requestedUsername, "BLOCKED_AUTH", 0, 0, 0, getClientIP(r), "Token inválido ("+err.Error()+") en "+r.URL.Path)
		}
		writeJSON(w, http.StatusUnauthorized, map[string]any{
			"error":         "Sesión expirada o no autenticada. Inicia sesión nuevamente.",
			"auth_required": true,
		})
		return nil, false
	}
	if strings.TrimSpace(requestedUsername) != "" && strings.ToLower(strings.TrimSpace(requestedUsername)) != strings.ToLower(strings.TrimSpace(claims.Username)) {
		logBalanceAudit(claims.UID, claims.Username, "BLOCKED_AUTH", 0, 0, 0, getClientIP(r), "Mismatch usuario solicitado="+requestedUsername+" en "+r.URL.Path)
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error": "El token de sesión no coincide con el usuario solicitado",
		})
		return nil, false
	}
	return claims, true
}

func getAdminAPIKey() string {
	return strings.TrimSpace(os.Getenv("ADMIN_API_KEY"))
}

func requireAdminAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			enableCORS(w)
			return
		}
		expected := getAdminAPIKey()
		if expected == "" {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"error": "ADMIN_API_KEY no configurada en el servidor. Configura ADMIN_API_KEY en las variables de entorno de Render.",
			})
			return
		}
		provided := strings.TrimSpace(r.Header.Get("X-Admin-Key"))
		if provided == "" {
			provided = extractBearerToken(r)
		}
		if len(provided) != len(expected) || subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			logBalanceAudit("", "admin", "BLOCKED_AUTH", 0, 0, 0, getClientIP(r), "Acceso admin denegado en "+r.URL.Path)
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "Clave de administrador inválida o ausente",
			})
			return
		}
		next(w, r)
	}
}

func parseNeonTime(val any) *time.Time {
	if val == nil {
		return nil
	}
	switch v := val.(type) {
	case time.Time:
		if v.IsZero() {
			return nil
		}
		return &v
	case *time.Time:
		return v
	case string:
		s := strings.TrimSpace(v)
		if s == "" || s == "<nil>" {
			return nil
		}
		layouts := []string{
			time.RFC3339Nano,
			time.RFC3339,
			"2006-01-02 15:04:05.999999Z07:00",
			"2006-01-02 15:04:05.999999-07:00",
			"2006-01-02 15:04:05.999999-07",
			"2006-01-02 15:04:05Z07:00",
			"2006-01-02 15:04:05-07:00",
			"2006-01-02 15:04:05-07",
			"2006-01-02 15:04:05",
		}
		for _, layout := range layouts {
			if t, err := time.Parse(layout, s); err == nil {
				return &t
			}
		}
	}
	return nil
}

func computeVipUpgrades(currentLevel string, xp int64) (string, int64) {
	level := strings.TrimSpace(currentLevel)
	if level == "" {
		level = "Panda Bronce"
	}
	var totalBonus int64
	for {
		if level == "Panda Bronce" && xp >= 1000 {
			level = "Panda Plata"
			totalBonus += 250
		} else if level == "Panda Plata" && xp >= 5000 {
			level = "Panda Oro"
			totalBonus += 1000
		} else if level == "Panda Oro" && xp >= 25000 {
			level = "Panda Platino"
			totalBonus += 5000
		} else {
			break
		}
	}
	return level, totalBonus
}

func applyVipProgressionNeon(userID, username, ip string) (string, int64) {
	if neon == nil || strings.TrimSpace(userID) == "" {
		return "Panda Bronce", 0
	}
	row, err := neon.QueryRow(`
		SELECT u.vip_level, u.vip_xp, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
		FROM users u
		LEFT JOIN wallets w ON u.id = w.user_id
		WHERE u.id = $1::uuid
		LIMIT 1
	`, userID)
	if err != nil || row == nil {
		return "Panda Bronce", 0
	}
	curLevel := fmt.Sprintf("%v", row["vip_level"])
	xp := parseNumber(row["vip_xp"])
	bal := parseNumber(row["balance_diamantes"])
	nextLevel, bonus := computeVipUpgrades(curLevel, xp)
	if bonus <= 0 && nextLevel == curLevel {
		return curLevel, 0
	}
	if err := neon.Exec(`UPDATE users SET vip_level = $1, updated_at = NOW() WHERE id = $2::uuid`, nextLevel, userID); err == nil && bonus > 0 {
		_ = neon.Exec(`
			INSERT INTO wallets (user_id, balance_diamantes, updated_at)
			VALUES ($1::uuid, $2, NOW())
			ON CONFLICT (user_id) DO UPDATE
			SET balance_diamantes = wallets.balance_diamantes + $2,
			    updated_at = NOW()
		`, userID, bonus)
		logBalanceAudit(userID, username, "VIP_LEVEL_UP", bonus, bal, bal+bonus, ip, "Ascenso automático a "+nextLevel)
	}
	return nextLevel, bonus
}

func applyVipProgressionMem(user *User, ip string) int64 {
	if user == nil {
		return 0
	}
	nextLevel, bonus := computeVipUpgrades(user.VIPLevel, int64(user.VIPXP))
	if nextLevel != user.VIPLevel {
		user.VIPLevel = nextLevel
	}
	if bonus > 0 {
		before := user.BalanceDiamantes
		user.BalanceDiamantes += bonus
		appendMemAuditLocked(user.ID, user.Username, "VIP_LEVEL_UP", bonus, before, before+bonus, ip, "Ascenso automático a "+nextLevel)
	}
	return bonus
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
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Phone = strings.TrimSpace(req.Phone)
	if req.Username == "" {
		req.Username = fmt.Sprintf("Panda_%d", time.Now().Unix()%100000)
	}
	if strings.Contains(req.Username, "@") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "El nombre de usuario no puede ser un correo electrónico. Usa un apodo sin '@'."})
		return
	}
	key := strings.ToLower(req.Username)

	// --- 1. MODO NEON SERVERLESS API ---
	if neon != nil {
		dupRow, dupErr := neon.QueryRow(`
			SELECT id::text, username, COALESCE(email, '') as email
			FROM users
			WHERE LOWER(TRIM(username)) = $1
			   OR ($2::text != '' AND LOWER(TRIM(COALESCE(email, ''))) = $2::text)
			LIMIT 1
		`, key, req.Email)
		if dupErr == nil && dupRow != nil && dupRow["id"] != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "El nombre de usuario o correo electrónico ya se encuentra registrado"})
			return
		}

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
			"token":   generateSessionToken(user.ID, user.Username),
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
	if req.Email != "" {
		for _, existing := range store.users {
			if strings.ToLower(strings.TrimSpace(existing.Email)) == req.Email {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "El correo electrónico ya se encuentra registrado"})
				return
			}
		}
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
		"token":   generateSessionToken(newUser.ID, newUser.Username),
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
	if cleanUser == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Ingresa tu usuario o correo electrónico y tu contraseña"})
		return
	}

	// --- 1. MODO NEON SERVERLESS API ---
	if neon != nil {
		rows, err := neon.Query(`
			SELECT u.id::text, u.username, COALESCE(u.email, '') as email, COALESCE(u.phone, '') as phone, u.password_hash,
			       u.cuenta_verificada, u.fecha_verificacion, COALESCE(u.tx_hash_verificacion, '') as tx_hash_verificacion,
			       COALESCE(u.metodo_pago_verificacion, '') as metodo_pago_verificacion,
			       u.vip_level, u.vip_xp, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes,
			       COALESCE(w.balance_bono_diamantes, 0)::bigint as balance_bono_diamantes,
			       COALESCE(w.giros_gratis, 0)::int as giros_gratis,
			       u.ultimo_cofre_abierto_at, u.ultima_ruleta_girada_at, u.ultimo_bono_semanal_at,
			       COALESCE(w.weekly_wagered_diamantes, 0)::bigint as weekly_wagered_diamantes,
			       u.created_at,
			       COALESCE(u.primer_deposito_realizado, false) as primer_deposito_realizado,
			       EXISTS (
			           SELECT 1 FROM depositos d
			           WHERE (d.user_id = u.id OR LOWER(d.username) = LOWER(u.username))
			             AND d.estado IN ('APROBADA', 'APROBADO', 'COMPLETADO')
			             AND COALESCE(d.tipo, 'RECARGA') = 'RECARGA'
			       ) as tiene_recarga_aprobada
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE LOWER(TRIM(u.username)) = $1 OR LOWER(TRIM(COALESCE(u.email, ''))) = $1
			ORDER BY (LOWER(TRIM(u.username)) = $1) DESC, COALESCE(w.balance_diamantes, 0) DESC, u.created_at ASC
		`, key)

		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error consultando credenciales en el servidor. Intenta de nuevo."})
			return
		}
		if len(rows) == 0 {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "No encontramos una cuenta con ese usuario o correo electrónico"})
			return
		}

		passHash := hashPassword(req.Password)
		var matchedRow map[string]any
		for _, r := range rows {
			if fmt.Sprintf("%v", r["password_hash"]) == passHash {
				matchedRow = r
				break
			}
		}
		if matchedRow == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Contraseña incorrecta"})
			return
		}

		user := parseUserFromRow(matchedRow)

		writeJSON(w, http.StatusOK, map[string]any{
			"message": "Inicio de sesión exitoso",
			"user":    user,
			"token":   generateSessionToken(user.ID, user.Username),
		})
		return
	}

	// --- 2. FALLBACK EN MEMORIA ---
	store.mu.RLock()
	user, exists := store.users[key]
	if !exists {
		for _, candidate := range store.users {
			if strings.ToLower(strings.TrimSpace(candidate.Email)) == key {
				user = candidate
				exists = true
				break
			}
		}
	}
	store.mu.RUnlock()

	if !exists {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "No encontramos una cuenta con ese usuario o correo electrónico"})
		return
	}

	if hashPassword(req.Password) != user.PasswordHash {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Contraseña incorrecta"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "Inicio de sesión exitoso",
		"user":    user,
		"token":   generateSessionToken(user.ID, user.Username),
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
		var f float64
		fmt.Sscanf(v, "%f", &f)
		return int64(math.Round(f))
	default:
		return 0
	}
}

func ensureNeonUserAndWallet(username, email, phone string) (string, error) {
	cleanUser := strings.TrimSpace(username)
	if cleanUser == "" {
		return "", fmt.Errorf("username requerido")
	}
	key := strings.ToLower(cleanUser)
	row, err := neon.QueryRow(`SELECT id::text FROM users WHERE LOWER(TRIM(username)) = $1 LIMIT 1`, key)
	if err == nil && row != nil && row["id"] != nil {
		uid := fmt.Sprintf("%v", row["id"])
		_ = neon.Exec(`
			INSERT INTO wallets (user_id, balance_diamantes, balance_bono_diamantes, giros_gratis)
			VALUES ($1::uuid, 0, 0, 0)
			ON CONFLICT (user_id) DO NOTHING
		`, uid)
		return uid, nil
	}

	if strings.Contains(cleanUser, "@") {
		emailRow, emailErr := neon.QueryRow(`
			SELECT id::text
			FROM users
			WHERE LOWER(TRIM(COALESCE(email, ''))) = $1
			ORDER BY created_at ASC
			LIMIT 1
		`, key)
		if emailErr == nil && emailRow != nil && emailRow["id"] != nil {
			uid := fmt.Sprintf("%v", emailRow["id"])
			_ = neon.Exec(`
				INSERT INTO wallets (user_id, balance_diamantes, balance_bono_diamantes, giros_gratis)
				VALUES ($1::uuid, 0, 0, 0)
				ON CONFLICT (user_id) DO NOTHING
			`, uid)
			return uid, nil
		}
		return "", fmt.Errorf("no se permite crear cuenta automática con correo electrónico")
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	if strings.Count(cleanEmail, "@") > 1 {
		cleanEmail = ""
	}
	cleanPhone := strings.TrimSpace(phone)

	userRow, err := neon.QueryRow(`
		INSERT INTO users (username, email, phone, password_hash, security_question, security_answer_hash, cuenta_verificada, vip_level, vip_xp)
		VALUES ($1, NULLIF(TRIM($2), ''), NULLIF(TRIM($3), ''), $4, '¿Cuál fue el nombre de tu primera mascota?', $5, FALSE, 'Panda Bronce', 0)
		RETURNING id::text
	`, cleanUser, cleanEmail, cleanPhone, hashPassword("123456"), hashSecurityAnswer("pelusa"))
	if err != nil {
		return "", err
	}
	uid := fmt.Sprintf("%v", userRow["id"])
	_ = neon.Exec(`
		INSERT INTO wallets (user_id, balance_diamantes, balance_bono_diamantes, giros_gratis)
		VALUES ($1::uuid, 0, 0, 0)
		ON CONFLICT (user_id) DO NOTHING
	`, uid)
	return uid, nil
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
		UltimoCofreAbiertoAt:    parseNeonTime(row["ultimo_cofre_abierto_at"]),
		UltimaRuletaGiradaAt:    parseNeonTime(row["ultima_ruleta_girada_at"]),
		UltimoBonoSemanalAt:     parseNeonTime(row["ultimo_bono_semanal_at"]),
		WeeklyWageredDiamantes:  parseNumber(row["weekly_wagered_diamantes"]),
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
			       COALESCE(w.giros_gratis, 0)::int as giros_gratis,
			       u.ultimo_cofre_abierto_at, u.ultima_ruleta_girada_at, u.ultimo_bono_semanal_at,
			       COALESCE(w.weekly_wagered_diamantes, 0)::bigint as weekly_wagered_diamantes,
			       u.created_at,
			       COALESCE(u.primer_deposito_realizado, false) as primer_deposito_realizado,
			       EXISTS (
			           SELECT 1 FROM depositos d 
			           WHERE (d.user_id = u.id OR LOWER(d.username) = LOWER(u.username))
			             AND d.estado IN ('APROBADA', 'APROBADO', 'COMPLETADO')
			             AND COALESCE(d.tipo, 'RECARGA') = 'RECARGA'
			       ) as tiene_recarga_aprobada
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE LOWER(TRIM(u.username)) = $1 OR LOWER(TRIM(COALESCE(u.email, ''))) = $1
			ORDER BY (LOWER(TRIM(u.username)) = $1) DESC, COALESCE(w.balance_diamantes, 0) DESC, u.created_at ASC
			LIMIT 1
		`, key)
		if err == nil {
			writeJSON(w, http.StatusOK, parseUserFromRow(row))
			return
		}
	}

	store.mu.RLock()
	user, exists := store.users[key]
	if !exists {
		for _, candidate := range store.users {
			if strings.ToLower(strings.TrimSpace(candidate.Email)) == key {
				user = candidate
				exists = true
				break
			}
		}
	}
	store.mu.RUnlock()

	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	writeJSON(w, http.StatusOK, user)
}

type SyncBalanceRequest struct {
	Username             string  `json:"username"`
	BalanceDiamantes     float64 `json:"balance_diamantes"`
	BalanceBonoDiamantes float64 `json:"balance_bono_diamantes"`
	VIPXP                int     `json:"vip_xp"`
	VIPLevel             string  `json:"vip_level"`
	Email                string  `json:"email,omitempty"`
	Phone                string  `json:"phone,omitempty"`
	Source               string  `json:"source,omitempty"`
}

func handleSyncBalance(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req SyncBalanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Formato JSON inválido"})
		return
	}

	claims, ok := requireUserSession(w, r, req.Username)
	if !ok {
		return
	}

	cleanUser := strings.TrimSpace(claims.Username)
	if cleanUser == "" || strings.Contains(cleanUser, "@") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Usuario inválido para sincronizar saldo. Inicia sesión nuevamente."})
		return
	}
	key := strings.ToLower(cleanUser)
	ip := getClientIP(r)
	source := strings.TrimSpace(req.Source)

	balDiamantes := int64(math.Round(req.BalanceDiamantes))
	if balDiamantes < 0 {
		balDiamantes = 0
	}

	if neon != nil {
		row, err := neon.QueryRow(`
			SELECT u.id::text, u.username, COALESCE(u.vip_xp, 0)::bigint as vip_xp,
			       COALESCE(u.vip_level, 'Panda Bronce') as vip_level,
			       COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes,
			       COALESCE(w.balance_bono_diamantes, 0)::bigint as balance_bono_diamantes,
			       COALESCE(w.active_bet_pool, 0)::bigint as active_bet_pool,
			       w.last_bet_at
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE ($1::text != '' AND u.id::text = $1) OR LOWER(TRIM(u.username)) = LOWER(TRIM($2))
			ORDER BY (u.id::text = $1) DESC
			LIMIT 1
		`, claims.UID, cleanUser)
		if err != nil || row == nil || row["id"] == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
			return
		}

		userID := fmt.Sprintf("%v", row["id"])
		canonicalUser := fmt.Sprintf("%v", row["username"])
		currentBalance := parseNumber(row["balance_diamantes"])
		currentBonus := parseNumber(row["balance_bono_diamantes"])
		currentXP := parseNumber(row["vip_xp"])
		currentLevel := fmt.Sprintf("%v", row["vip_level"])
		activeBetPool := parseNumber(row["active_bet_pool"])
		lastBetAt := parseNeonTime(row["last_bet_at"])

		_ = neon.Exec(`
			INSERT INTO wallets (user_id, balance_diamantes, balance_bono_diamantes, giros_gratis)
			VALUES ($1::uuid, 0, 0, 0)
			ON CONFLICT (user_id) DO NOTHING
		`, userID)

		delta := balDiamantes - currentBalance
		if delta == 0 {
			writeJSON(w, http.StatusOK, map[string]any{
				"ok":                     true,
				"username":               canonicalUser,
				"balance_diamantes":      currentBalance,
				"balance_bono_diamantes": currentBonus,
				"vip_xp":                 currentXP,
				"vip_level":              currentLevel,
				"vip_upgraded":           false,
				"vip_bonus":              int64(0),
			})
			return
		}

		if delta < 0 {
			bet := -delta
			err = neon.Exec(`
				UPDATE wallets
				SET balance_diamantes = $2,
				    active_bet_pool = LEAST(COALESCE(active_bet_pool, 0) + $3, 50000),
				    last_bet_at = NOW(),
				    total_jugado_diamantes = COALESCE(total_jugado_diamantes, 0) + $3,
				    weekly_wagered_diamantes = COALESCE(weekly_wagered_diamantes, 0) + $3,
				    updated_at = NOW()
				WHERE user_id = $1::uuid
			`, userID, balDiamantes, bet)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error actualizando billetera en Neon: " + err.Error()})
				return
			}

			maxXPDelta := bet / 10
			if maxXPDelta < 1 {
				maxXPDelta = 1
			}
			maxXPDelta += 5
			newXP := int64(req.VIPXP)
			if newXP < currentXP {
				newXP = currentXP
			}
			if newXP > currentXP+maxXPDelta {
				newXP = currentXP + maxXPDelta
			}
			if newXP > currentXP {
				_ = neon.Exec(`UPDATE users SET vip_xp = $1, updated_at = NOW() WHERE id = $2::uuid`, newXP, userID)
			} else {
				newXP = currentXP
			}

			logBalanceAudit(userID, canonicalUser, "GAME_BET", -bet, currentBalance, balDiamantes, ip, "source="+source)
			nextLevel, vipBonus := applyVipProgressionNeon(userID, canonicalUser, ip)
			finalBal := balDiamantes + vipBonus
			if nextLevel == "" {
				nextLevel = currentLevel
			}

			writeJSON(w, http.StatusOK, map[string]any{
				"ok":                     true,
				"username":               canonicalUser,
				"balance_diamantes":      finalBal,
				"balance_bono_diamantes": currentBonus,
				"vip_xp":                 newXP,
				"vip_level":              nextLevel,
				"vip_upgraded":           vipBonus > 0,
				"vip_bonus":              vipBonus,
			})
			return
		}

		// delta > 0 (premio / cashout de juego)
		win := delta
		if activeBetPool < 10 || lastBetAt == nil || time.Since(*lastBetAt) > 20*time.Minute {
			logBalanceAudit(userID, canonicalUser, "BLOCKED_NO_BET", win, currentBalance, currentBalance, ip,
				fmt.Sprintf("intento=%d pool=%d source=%s", balDiamantes, activeBetPool, source))
			writeJSON(w, http.StatusForbidden, map[string]any{
				"ok":                false,
				"error":             "SYNC_BLOCKED_NO_ACTIVE_BET",
				"balance_diamantes": currentBalance,
				"vip_xp":            currentXP,
				"vip_level":         currentLevel,
			})
			return
		}

		maxAllowed := activeBetPool * MaxSyncWinMultiplier
		if maxAllowed > MaxSingleSyncWin {
			maxAllowed = MaxSingleSyncWin
		}
		if win > maxAllowed {
			logBalanceAudit(userID, canonicalUser, "BLOCKED_ANOMALY", win, currentBalance, currentBalance, ip,
				fmt.Sprintf("maxAllowed=%d pool=%d source=%s", maxAllowed, activeBetPool, source))
			writeJSON(w, http.StatusForbidden, map[string]any{
				"ok":                false,
				"error":             "SYNC_BLOCKED_ANOMALY",
				"balance_diamantes": currentBalance,
				"vip_xp":            currentXP,
				"vip_level":         currentLevel,
			})
			return
		}

		var nextPool int64 = 0
		if strings.Contains(strings.ToLower(source), "plinko") {
			used := (win + 14) / 15
			if used < 10 {
				used = 10
			}
			if used > activeBetPool {
				used = activeBetPool
			}
			nextPool = activeBetPool - used
		}

		err = neon.Exec(`
			UPDATE wallets
			SET balance_diamantes = $2,
			    active_bet_pool = $3,
			    total_ganado_diamantes = COALESCE(total_ganado_diamantes, 0) + $4,
			    updated_at = NOW()
			WHERE user_id = $1::uuid
		`, userID, balDiamantes, nextPool, win)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error acreditando premio en Neon: " + err.Error()})
			return
		}

		logBalanceAudit(userID, canonicalUser, "GAME_WIN", win, currentBalance, balDiamantes, ip,
			fmt.Sprintf("pool=%d->%d source=%s", activeBetPool, nextPool, source))

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":                     true,
			"username":               canonicalUser,
			"balance_diamantes":      balDiamantes,
			"balance_bono_diamantes": currentBonus,
			"vip_xp":                 currentXP,
			"vip_level":              currentLevel,
			"vip_upgraded":           false,
			"vip_bonus":              int64(0),
		})
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()
	user, exists := store.users[key]
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	currentBalance := user.BalanceDiamantes
	delta := balDiamantes - currentBalance
	if delta == 0 {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":                     true,
			"username":               user.Username,
			"balance_diamantes":      user.BalanceDiamantes,
			"balance_bono_diamantes": user.BalanceBonoDiamantes,
			"vip_xp":                 user.VIPXP,
			"vip_level":              user.VIPLevel,
			"vip_upgraded":           false,
			"vip_bonus":              int64(0),
		})
		return
	}

	if delta < 0 {
		bet := -delta
		now := time.Now()
		user.BalanceDiamantes = balDiamantes
		user.ActiveBetPool += bet
		if user.ActiveBetPool > 50000 {
			user.ActiveBetPool = 50000
		}
		user.LastBetAt = &now
		user.WeeklyWageredDiamantes += bet

		maxXPDelta := int(bet/10)
		if maxXPDelta < 1 {
			maxXPDelta = 1
		}
		maxXPDelta += 5
		if req.VIPXP > user.VIPXP {
			capped := user.VIPXP + maxXPDelta
			if req.VIPXP < capped {
				user.VIPXP = req.VIPXP
			} else {
				user.VIPXP = capped
			}
		}

		appendMemAuditLocked(user.ID, user.Username, "GAME_BET", -bet, currentBalance, balDiamantes, ip, "source="+source)
		vipBonus := applyVipProgressionMem(user, ip)

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":                     true,
			"username":               user.Username,
			"balance_diamantes":      user.BalanceDiamantes,
			"balance_bono_diamantes": user.BalanceBonoDiamantes,
			"vip_xp":                 user.VIPXP,
			"vip_level":              user.VIPLevel,
			"vip_upgraded":           vipBonus > 0,
			"vip_bonus":              vipBonus,
		})
		return
	}

	// delta > 0 en memoria
	win := delta
	if user.ActiveBetPool < 10 || user.LastBetAt == nil || time.Since(*user.LastBetAt) > 20*time.Minute {
		appendMemAuditLocked(user.ID, user.Username, "BLOCKED_NO_BET", win, currentBalance, currentBalance, ip,
			fmt.Sprintf("intento=%d pool=%d source=%s", balDiamantes, user.ActiveBetPool, source))
		writeJSON(w, http.StatusForbidden, map[string]any{
			"ok":                false,
			"error":             "SYNC_BLOCKED_NO_ACTIVE_BET",
			"balance_diamantes": currentBalance,
			"vip_xp":            user.VIPXP,
			"vip_level":         user.VIPLevel,
		})
		return
	}

	maxAllowed := user.ActiveBetPool * MaxSyncWinMultiplier
	if maxAllowed > MaxSingleSyncWin {
		maxAllowed = MaxSingleSyncWin
	}
	if win > maxAllowed {
		appendMemAuditLocked(user.ID, user.Username, "BLOCKED_ANOMALY", win, currentBalance, currentBalance, ip,
			fmt.Sprintf("maxAllowed=%d pool=%d source=%s", maxAllowed, user.ActiveBetPool, source))
		writeJSON(w, http.StatusForbidden, map[string]any{
			"ok":                false,
			"error":             "SYNC_BLOCKED_ANOMALY",
			"balance_diamantes": currentBalance,
			"vip_xp":            user.VIPXP,
			"vip_level":         user.VIPLevel,
		})
		return
	}

	prevPool := user.ActiveBetPool
	if strings.Contains(strings.ToLower(source), "plinko") {
		used := (win + 14) / 15
		if used < 10 {
			used = 10
		}
		if used > user.ActiveBetPool {
			used = user.ActiveBetPool
		}
		user.ActiveBetPool -= used
	} else {
		user.ActiveBetPool = 0
	}
	user.BalanceDiamantes = balDiamantes
	appendMemAuditLocked(user.ID, user.Username, "GAME_WIN", win, currentBalance, balDiamantes, ip,
		fmt.Sprintf("pool=%d->%d source=%s", prevPool, user.ActiveBetPool, source))

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                     true,
		"username":               user.Username,
		"balance_diamantes":      user.BalanceDiamantes,
		"balance_bono_diamantes": user.BalanceBonoDiamantes,
		"vip_xp":                 user.VIPXP,
		"vip_level":              user.VIPLevel,
		"vip_upgraded":           false,
		"vip_bonus":              int64(0),
	})
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

	claims, ok := requireUserSession(w, r, req.Username)
	if !ok {
		return
	}
	targetUser := claims.Username
	key := strings.ToLower(strings.TrimSpace(targetUser))
	ip := getClientIP(r)

	if neon != nil {
		userRow, err := neon.QueryRow(`
			SELECT u.id::text, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE ($1::text != '' AND u.id::text = $1) OR LOWER(TRIM(u.username)) = $2
			LIMIT 1
		`, claims.UID, key)
		if err != nil || userRow == nil || userRow["id"] == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado en Neon"})
			return
		}
		userID := fmt.Sprintf("%v", userRow["id"])
		balBefore := parseNumber(userRow["balance_diamantes"])

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

			err = neon.Exec(`
				INSERT INTO depositos (user_id, username, monto_usdt, monto_diamantes, red_blockchain, tron_wallet_destino, tx_hash_tron, estado, tipo)
				VALUES ($1::uuid, $2, 10.00, 0, 'TRC-20', $3, $4, 'PENDIENTE', 'VERIFICACION')
			`, userID, targetUser, activeWallet, req.TxHash)

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

		if resMap, ok := resRow["res"].(map[string]any); ok {
			if succ, _ := resMap["success"].(bool); !succ {
				writeJSON(w, http.StatusBadRequest, resMap)
				return
			}
			balAfter := balBefore
			if req.Metodo == "saldo_diamantes" {
				wRow, wErr := neon.QueryRow(`SELECT COALESCE(balance_diamantes, 0)::bigint as bal FROM wallets WHERE user_id = $1::uuid`, userID)
				if wErr == nil && wRow != nil {
					balAfter = parseNumber(wRow["bal"])
				}
				delta := balAfter - balBefore
				if delta != 0 {
					logBalanceAudit(userID, targetUser, "VERIFY_PAYMENT", delta, balBefore, balAfter, ip, "Verificación con saldo_diamantes")
				}
			}
			resMap["nuevo_balance"] = balAfter
			writeJSON(w, http.StatusOK, resMap)
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
			"success":           true,
			"message":           "La cuenta ya se encuentra verificada",
			"cuenta_verificada": true,
			"nuevo_balance":     user.BalanceDiamantes,
		})
		return
	}

	balBefore := user.BalanceDiamantes
	if req.Metodo == "saldo_diamantes" {
		if user.BalanceDiamantes < VerificationFeeDiamonds {
			writeJSON(w, http.StatusPaymentRequired, map[string]string{
				"error": "Saldo insuficiente de diamantes para pagar la verificación (requiere 100 💎).",
			})
			return
		}
		user.BalanceDiamantes -= VerificationFeeDiamonds
		appendMemAuditLocked(user.ID, user.Username, "VERIFY_PAYMENT", -VerificationFeeDiamonds, balBefore, user.BalanceDiamantes, ip, "Verificación con saldo_diamantes")
	}

	now := time.Now()
	user.CuentaVerificada = true
	user.FechaVerificacion = &now
	user.MetodoPagoVerificacion = req.Metodo
	user.TxHashVerificacion = req.TxHash

	writeJSON(w, http.StatusOK, map[string]any{
		"success":           true,
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

	addedDiamonds := int64(math.Round(req.MontoUSDT * float64(DiamondRate)))

	// --- 1. MODO NEON SERVERLESS API ---
	if neon != nil {
		userID, err := ensureNeonUserAndWallet(req.Username, "", "")
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado en Neon: " + err.Error()})
			return
		}

		depRow, err := neon.QueryRow(`
			INSERT INTO depositos (user_id, username, monto_usdt, monto_diamantes, red_blockchain, tron_wallet_destino, tx_hash_tron, estado, tipo)
			VALUES ($1::uuid, $2, $3, $4, 'TRC-20', $5, $6, 'PENDIENTE', 'RECARGA')
			RETURNING id::text, created_at
		`, userID, strings.TrimSpace(req.Username), req.MontoUSDT, addedDiamonds, walletDestino, txHash)

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
	ip := getClientIP(r)

	// --- 1. MODO NEON SERVERLESS API (Invocación directa de stored proc) ---
	if neon != nil {
		row, err := neon.QueryRow(`SELECT aprobar_deposito($1) as res`, txHash)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Error aprobando depósito en Neon: " + err.Error()})
			return
		}

		if resMap, ok := row["res"].(map[string]any); ok {
			if succ, _ := resMap["success"].(bool); !succ {
				writeJSON(w, http.StatusBadRequest, resMap)
				return
			}
			depID := fmt.Sprintf("%v", resMap["deposito_id"])
			montoDiam := parseNumber(resMap["monto_diamantes"])
			infoRow, infoErr := neon.QueryRow(`
				SELECT d.user_id::text, COALESCE(u.username, d.username, '') as username,
				       COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
				FROM depositos d
				LEFT JOIN users u ON d.user_id = u.id
				LEFT JOIN wallets w ON d.user_id = w.user_id
				WHERE d.id::text = $1
				LIMIT 1
			`, depID)
			if infoErr == nil && infoRow != nil {
				uid := fmt.Sprintf("%v", infoRow["user_id"])
				uname := fmt.Sprintf("%v", infoRow["username"])
				balAfter := parseNumber(infoRow["balance_diamantes"])
				logBalanceAudit(uid, uname, "DEPOSIT_APPROVED", montoDiam, balAfter-montoDiam, balAfter, ip, "tx_hash="+txHash)
				_, _ = applyVipProgressionNeon(uid, uname, ip)
			}
			writeJSON(w, http.StatusOK, resMap)
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
		balBefore := user.BalanceDiamantes
		user.BalanceDiamantes += record.MontoDiamantes
		user.VIPXP += int(record.MontoUSDT * 2)
		user.PrimerDepositoRealizado = true
		user.TieneRecargaAprobada = true
		appendMemAuditLocked(user.ID, user.Username, "DEPOSIT_APPROVED", record.MontoDiamantes, balBefore, user.BalanceDiamantes, ip, "tx_hash="+txHash)
		_ = applyVipProgressionMem(user, ip)
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

	claims, ok := requireUserSession(w, r, req.Username)
	if !ok {
		return
	}
	targetUser := claims.Username
	key := strings.ToLower(strings.TrimSpace(targetUser))
	ip := getClientIP(r)

	// --- 1. MODO NEON SERVERLESS API (Con Trigger de Seguridad Estricto en Neon) ---
	if neon != nil {
		userRow, err := neon.QueryRow(`
			SELECT u.id::text, u.cuenta_verificada, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE ($1::text != '' AND u.id::text = $1) OR LOWER(TRIM(u.username)) = $2
			LIMIT 1
		`, claims.UID, key)

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
				"error":             "REGLA_BLOQUEO: Cuenta no verificada",
				"message":           "Tu cuenta no se encuentra verificada. Debes pagar la tasa de verificación (10 USDT / 100 💎) antes de poder retirar.",
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

		// En Panda para Creadores: Retiro instantáneo (sin días de espera ni bloqueos manuales)
		retRow, err := neon.QueryRow(`
			INSERT INTO retiros (user_id, monto_diamantes, monto_usdt, red_blockchain, tron_wallet_receptora, estado, tiempo_estimado_dias, fecha_estimada_liberacion, nota_procesamiento)
			VALUES ($1::uuid, $2, $3, 'TRC-20', $4, 'COMPLETADO', 0, NOW(), 'Despacho automatizado instantáneo a red TRON TRC-20')
			RETURNING id::text
		`, userID, req.Diamantes, montoUsdt, req.TronAddress)

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

		logBalanceAudit(userID, targetUser, "WITHDRAW_REQUEST", -req.Diamantes, balance, balance-req.Diamantes, ip, "wallet="+req.TronAddress)

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":                   true,
			"estado":               "COMPLETADO",
			"message":              "¡Retiro completado y transferido exitosamente a tu billetera TRON!",
			"tiempo_estimado_dias": 0,
			"fecha_estimada":       time.Now().Format("02/01/2006 15:04 MST"),
			"retiro_id":            retRow["id"],
			"diamantes_debitados":  req.Diamantes,
			"monto_usdt":           montoUsdt,
			"wallet_destino":       req.TronAddress,
			"nuevo_balance":        balance - req.Diamantes,
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
			"error":             "REGLA_BLOQUEO: Cuenta no verificada",
			"message":           "Tu cuenta no se encuentra verificada. Debes pagar la tasa de verificación (10 USDT / 100 💎) antes de poder retirar.",
			"cuenta_verificada": false,
		})
		return
	}

	if user.BalanceDiamantes < req.Diamantes {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("Saldo insuficiente. Tu saldo es de %d 💎 e intentas retirar %d 💎.", user.BalanceDiamantes, req.Diamantes),
		})
		return
	}

	balBefore := user.BalanceDiamantes
	user.BalanceDiamantes -= req.Diamantes
	appendMemAuditLocked(user.ID, user.Username, "WITHDRAW_REQUEST", -req.Diamantes, balBefore, user.BalanceDiamantes, ip, "wallet="+req.TronAddress)
	montoUsdt := float64(req.Diamantes) / float64(DiamondRate)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                   true,
		"estado":               "COMPLETADO",
		"message":              "¡Retiro completado y transferido exitosamente a tu billetera TRON!",
		"tiempo_estimado_dias": 0,
		"fecha_estimada":       time.Now().Format("02/01/2006 15:04 MST"),
		"retiro_id":            fmt.Sprintf("ret_%d", time.Now().UnixNano()%1000000),
		"diamantes_debitados":  req.Diamantes,
		"monto_usdt":           montoUsdt,
		"wallet_destino":       req.TronAddress,
		"nuevo_balance":        user.BalanceDiamantes,
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
	_ = json.NewDecoder(r.Body).Decode(&req)

	claims, ok := requireUserSession(w, r, req.Username)
	if !ok {
		return
	}
	targetUser := claims.Username
	key := strings.ToLower(strings.TrimSpace(targetUser))
	ip := getClientIP(r)

	if neon != nil {
		userRow, err := neon.QueryRow(`
			SELECT u.id::text, COALESCE(u.vip_xp, 0)::bigint as vip_xp,
			       COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE ($1::text != '' AND u.id::text = $1) OR LOWER(TRIM(u.username)) = $2
			LIMIT 1
		`, claims.UID, key)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
			return
		}
		userID := fmt.Sprintf("%v", userRow["id"])
		balBefore := parseNumber(userRow["balance_diamantes"])

		resRow, err := neon.QueryRow(`SELECT reclamar_cofre_diario($1::uuid) as res`, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if resMap, ok := resRow["res"].(map[string]any); ok {
			if succ, _ := resMap["success"].(bool); !succ {
				writeJSON(w, http.StatusTooManyRequests, resMap)
				return
			}
			_, _ = applyVipProgressionNeon(userID, targetUser, ip)
			afterRow, _ := neon.QueryRow(`
				SELECT u.vip_xp, u.vip_level, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
				FROM users u LEFT JOIN wallets w ON u.id = w.user_id
				WHERE u.id = $1::uuid
			`, userID)
			balAfter := balBefore
			var xpAfter int64 = parseNumber(userRow["vip_xp"])
			lvlAfter := "Panda Bronce"
			if afterRow != nil {
				balAfter = parseNumber(afterRow["balance_diamantes"])
				xpAfter = parseNumber(afterRow["vip_xp"])
				lvlAfter = fmt.Sprintf("%v", afterRow["vip_level"])
			}
			delta := balAfter - balBefore
			logBalanceAudit(userID, targetUser, "DAILY_CHEST", delta, balBefore, balAfter, ip,
				fmt.Sprintf("tipo=%v cantidad=%v", resMap["tipo"], resMap["cantidad"]))
			resMap["nuevo_balance_diamantes"] = balAfter
			resMap["nuevo_vip_xp"] = xpAfter
			resMap["vip_level"] = lvlAfter
			writeJSON(w, http.StatusOK, resMap)
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
				"success":                     false,
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

	balBefore := user.BalanceDiamantes
	user.UltimoCofreAbiertoAt = &now
	if rewardType == "XP" {
		user.VIPXP += rewardAmount
	} else {
		user.BalanceDiamantes += int64(rewardAmount)
	}
	appendMemAuditLocked(user.ID, user.Username, "DAILY_CHEST", user.BalanceDiamantes-balBefore, balBefore, user.BalanceDiamantes, ip,
		fmt.Sprintf("tipo=%s cantidad=%d", rewardType, rewardAmount))
	_ = applyVipProgressionMem(user, ip)

	writeJSON(w, http.StatusOK, map[string]any{
		"success":                     true,
		"message":                     "¡Cofre reclamado con éxito!",
		"premio":                      rewardLabel,
		"tipo":                        rewardType,
		"cantidad":                    rewardAmount,
		"nuevo_balance_diamantes":     user.BalanceDiamantes,
		"nuevo_vip_xp":                user.VIPXP,
		"vip_level":                   user.VIPLevel,
		"ultimo_cofre_abierto_at":     user.UltimoCofreAbiertoAt,
		"proximo_cofre_disponible_at": now.Add(24 * time.Hour),
	})
}

// -----------------------------------------------------------------------------
// RULETA DE LA SUERTE (AUTORIATVO EN SERVIDOR + COOLDOWN 24H EN NEON)
// -----------------------------------------------------------------------------

type rouletteSegmentDef struct {
	ID     string
	Type   string
	Amount int64
	Label  string
	Weight float64
}

var rouletteSegments = []rouletteSegmentDef{
	{ID: "r_xp100", Type: "xp", Amount: 100, Label: "+100 XP VIP", Weight: 44.0},
	{ID: "r_usdt5", Type: "diamantes", Amount: 50, Label: "+50 💎 (5 USDT)", Weight: 31.0},
	{ID: "r_xp200", Type: "xp", Amount: 200, Label: "+200 XP VIP", Weight: 11.5},
	{ID: "r_usdt10", Type: "diamantes", Amount: 100, Label: "+100 💎 (10 USDT)", Weight: 2.5},
	{ID: "r_xp350", Type: "xp", Amount: 350, Label: "+350 XP VIP", Weight: 6.5},
	{ID: "r_usdt20", Type: "diamantes", Amount: 200, Label: "+200 💎 (20 USDT)", Weight: 0.85},
	{ID: "r_xp500", Type: "xp", Amount: 500, Label: "+500 XP VIP", Weight: 3.5},
	{ID: "r_special", Type: "diamantes", Amount: 1000, Label: "★ +1,000 💎 (ESPECIAL)", Weight: 0.15},
}

func rollRouletteSegment() rouletteSegmentDef {
	r := rand.Float64() * 100.0
	cum := 0.0
	for _, seg := range rouletteSegments {
		cum += seg.Weight
		if r < cum {
			return seg
		}
	}
	return rouletteSegments[0]
}

func handleRouletteSpin(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username string `json:"username"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	claims, ok := requireUserSession(w, r, req.Username)
	if !ok {
		return
	}
	targetUser := claims.Username
	key := strings.ToLower(strings.TrimSpace(targetUser))
	ip := getClientIP(r)

	if neon != nil {
		userRow, err := neon.QueryRow(`
			SELECT u.id::text, u.ultima_ruleta_girada_at, COALESCE(u.vip_xp, 0)::bigint as vip_xp,
			       COALESCE(u.vip_level, 'Panda Bronce') as vip_level,
			       COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE ($1::text != '' AND u.id::text = $1) OR LOWER(TRIM(u.username)) = $2
			LIMIT 1
		`, claims.UID, key)
		if err != nil || userRow == nil || userRow["id"] == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
			return
		}
		userID := fmt.Sprintf("%v", userRow["id"])
		balBefore := parseNumber(userRow["balance_diamantes"])

		// Bloqueo atómico de cooldown de 24 horas en Postgres
		updRows, updErr := neon.Query(`
			UPDATE users
			SET ultima_ruleta_girada_at = NOW(), updated_at = NOW()
			WHERE id = $1::uuid
			  AND (ultima_ruleta_girada_at IS NULL OR NOW() - ultima_ruleta_girada_at >= INTERVAL '24 hours')
			RETURNING ultima_ruleta_girada_at
		`, userID)
		if updErr != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": updErr.Error()})
			return
		}
		if len(updRows) == 0 {
			lastSpin := parseNeonTime(userRow["ultima_ruleta_girada_at"])
			var remSecs int
			var nextAvail *time.Time
			if lastSpin != nil {
				na := lastSpin.Add(24 * time.Hour)
				nextAvail = &na
				remSecs = int(time.Until(na).Seconds())
				if remSecs < 0 {
					remSecs = 0
				}
			}
			writeJSON(w, http.StatusTooManyRequests, map[string]any{
				"success":                     false,
				"error":                       "COOLDOWN_ACTIVO",
				"message":                     "Debes esperar 24 horas desde tu último giro de la ruleta.",
				"ultima_ruleta_girada_at":     lastSpin,
				"proximo_giro_disponible_at":  nextAvail,
				"segundos_restantes":          remSecs,
			})
			return
		}

		seg := rollRouletteSegment()
		if seg.Type == "xp" {
			_ = neon.Exec(`UPDATE users SET vip_xp = vip_xp + $1, updated_at = NOW() WHERE id = $2::uuid`, seg.Amount, userID)
		} else {
			_ = neon.Exec(`
				INSERT INTO wallets (user_id, balance_diamantes, updated_at)
				VALUES ($1::uuid, $2, NOW())
				ON CONFLICT (user_id) DO UPDATE
				SET balance_diamantes = wallets.balance_diamantes + $2,
				    updated_at = NOW()
			`, userID, seg.Amount)
		}

		_, _ = applyVipProgressionNeon(userID, targetUser, ip)
		afterRow, _ := neon.QueryRow(`
			SELECT u.vip_xp, u.vip_level, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
			FROM users u LEFT JOIN wallets w ON u.id = w.user_id
			WHERE u.id = $1::uuid
		`, userID)
		balAfter := balBefore
		xpAfter := parseNumber(userRow["vip_xp"])
		lvlAfter := fmt.Sprintf("%v", userRow["vip_level"])
		if afterRow != nil {
			balAfter = parseNumber(afterRow["balance_diamantes"])
			xpAfter = parseNumber(afterRow["vip_xp"])
			lvlAfter = fmt.Sprintf("%v", afterRow["vip_level"])
		}

		logBalanceAudit(userID, targetUser, "ROULETTE_WIN", balAfter-balBefore, balBefore, balAfter, ip,
			fmt.Sprintf("segment=%s tipo=%s cantidad=%d", seg.ID, seg.Type, seg.Amount))

		nowTime := time.Now()
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":                          true,
			"success":                     true,
			"segment_id":                  seg.ID,
			"tipo":                        seg.Type,
			"cantidad":                    seg.Amount,
			"label":                       seg.Label,
			"nuevo_balance_diamantes":     balAfter,
			"nuevo_vip_xp":                xpAfter,
			"vip_level":                   lvlAfter,
			"ultima_ruleta_girada_at":     nowTime,
			"proximo_giro_disponible_at":  nowTime.Add(24 * time.Hour),
		})
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
	if user.UltimaRuletaGiradaAt != nil && now.Sub(*user.UltimaRuletaGiradaAt) < 24*time.Hour {
		rem := 24*time.Hour - now.Sub(*user.UltimaRuletaGiradaAt)
		writeJSON(w, http.StatusTooManyRequests, map[string]any{
			"success":                    false,
			"error":                      "COOLDOWN_ACTIVO",
			"message":                    "Debes esperar 24 horas desde tu último giro de la ruleta.",
			"ultima_ruleta_girada_at":    user.UltimaRuletaGiradaAt,
			"proximo_giro_disponible_at": user.UltimaRuletaGiradaAt.Add(24 * time.Hour),
			"segundos_restantes":         int(rem.Seconds()),
		})
		return
	}

	seg := rollRouletteSegment()
	balBefore := user.BalanceDiamantes
	user.UltimaRuletaGiradaAt = &now
	if seg.Type == "xp" {
		user.VIPXP += int(seg.Amount)
	} else {
		user.BalanceDiamantes += seg.Amount
	}
	appendMemAuditLocked(user.ID, user.Username, "ROULETTE_WIN", user.BalanceDiamantes-balBefore, balBefore, user.BalanceDiamantes, ip,
		fmt.Sprintf("segment=%s tipo=%s cantidad=%d", seg.ID, seg.Type, seg.Amount))
	_ = applyVipProgressionMem(user, ip)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                         true,
		"success":                    true,
		"segment_id":                 seg.ID,
		"tipo":                       seg.Type,
		"cantidad":                   seg.Amount,
		"label":                      seg.Label,
		"nuevo_balance_diamantes":    user.BalanceDiamantes,
		"nuevo_vip_xp":               user.VIPXP,
		"vip_level":                  user.VIPLevel,
		"ultima_ruleta_girada_at":    user.UltimaRuletaGiradaAt,
		"proximo_giro_disponible_at": now.Add(24 * time.Hour),
	})
}

// -----------------------------------------------------------------------------
// BONO SEMANAL (10% DEL GASTO SEMANAL REGISTRADO EN SERVIDOR)
// -----------------------------------------------------------------------------

func handleClaimWeeklyBonus(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username string `json:"username"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	claims, ok := requireUserSession(w, r, req.Username)
	if !ok {
		return
	}
	targetUser := claims.Username
	key := strings.ToLower(strings.TrimSpace(targetUser))
	ip := getClientIP(r)

	if neon != nil {
		row, err := neon.QueryRow(`
			SELECT u.id::text, u.ultimo_bono_semanal_at,
			       COALESCE(w.weekly_wagered_diamantes, 0)::bigint as weekly_wagered_diamantes,
			       COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
			FROM users u
			LEFT JOIN wallets w ON u.id = w.user_id
			WHERE ($1::text != '' AND u.id::text = $1) OR LOWER(TRIM(u.username)) = $2
			LIMIT 1
		`, claims.UID, key)
		if err != nil || row == nil || row["id"] == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
			return
		}
		userID := fmt.Sprintf("%v", row["id"])
		lastClaim := parseNeonTime(row["ultimo_bono_semanal_at"])
		if lastClaim != nil && time.Since(*lastClaim) < 7*24*time.Hour {
			writeJSON(w, http.StatusTooManyRequests, map[string]any{
				"error":                  "COOLDOWN_ACTIVO",
				"message":                "Ya reclamaste tu bono semanal en los últimos 7 días.",
				"ultimo_bono_semanal_at": lastClaim,
			})
			return
		}
		weeklySpent := parseNumber(row["weekly_wagered_diamantes"])
		bonus := weeklySpent / 10
		if bonus <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Aún no tienes bono acumulado. Juega en los juegos del lobby para acumular gasto y recibir tu 10%.",
			})
			return
		}

		updRows, updErr := neon.Query(`
			UPDATE users
			SET ultimo_bono_semanal_at = NOW(), updated_at = NOW()
			WHERE id = $1::uuid
			  AND (ultimo_bono_semanal_at IS NULL OR NOW() - ultimo_bono_semanal_at >= INTERVAL '7 days')
			RETURNING ultimo_bono_semanal_at
		`, userID)
		if updErr != nil || len(updRows) == 0 {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "Ya reclamaste tu bono semanal recientemente."})
			return
		}

		balBefore := parseNumber(row["balance_diamantes"])
		_ = neon.Exec(`
			UPDATE wallets
			SET balance_diamantes = balance_diamantes + $2,
			    weekly_wagered_diamantes = 0,
			    updated_at = NOW()
			WHERE user_id = $1::uuid
		`, userID, bonus)

		balAfter := balBefore + bonus
		logBalanceAudit(userID, targetUser, "WEEKLY_BONUS", bonus, balBefore, balAfter, ip,
			fmt.Sprintf("weekly_wagered=%d", weeklySpent))

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":                      true,
			"bonus_diamantes":         bonus,
			"weekly_wagered":          weeklySpent,
			"nuevo_balance_diamantes": balAfter,
			"message":                 fmt.Sprintf("¡Has recibido +%d 💎 de Bono Semanal!", bonus),
		})
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
	if user.UltimoBonoSemanalAt != nil && now.Sub(*user.UltimoBonoSemanalAt) < 7*24*time.Hour {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{
			"error": "Ya reclamaste tu bono semanal en los últimos 7 días.",
		})
		return
	}
	bonus := user.WeeklyWageredDiamantes / 10
	if bonus <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Aún no tienes bono acumulado. Juega en los juegos del lobby para acumular gasto y recibir tu 10%.",
		})
		return
	}
	balBefore := user.BalanceDiamantes
	weeklySpent := user.WeeklyWageredDiamantes
	user.BalanceDiamantes += bonus
	user.WeeklyWageredDiamantes = 0
	user.UltimoBonoSemanalAt = &now
	appendMemAuditLocked(user.ID, user.Username, "WEEKLY_BONUS", bonus, balBefore, user.BalanceDiamantes, ip,
		fmt.Sprintf("weekly_wagered=%d", weeklySpent))

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                      true,
		"bonus_diamantes":         bonus,
		"weekly_wagered":          weeklySpent,
		"nuevo_balance_diamantes": user.BalanceDiamantes,
		"message":                 fmt.Sprintf("¡Has recibido +%d 💎 de Bono Semanal!", bonus),
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
		row, err := neon.QueryRow(`
			SELECT username, COALESCE(security_question, '¿Cuál fue el nombre de tu primera mascota?') as question
			FROM users
			WHERE LOWER(TRIM(username)) = $1 OR LOWER(TRIM(COALESCE(email, ''))) = $1
			ORDER BY (LOWER(TRIM(username)) = $1) DESC, created_at ASC
			LIMIT 1
		`, strings.ToLower(username))
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
	lookupKey := strings.ToLower(username)
	user, exists := store.users[lookupKey]
	if !exists {
		for _, candidate := range store.users {
			if strings.ToLower(strings.TrimSpace(candidate.Email)) == lookupKey {
				user = candidate
				exists = true
				break
			}
		}
	}
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
		row, err := neon.QueryRow(`
			SELECT id::text, username, COALESCE(security_answer_hash, '') as hash
			FROM users
			WHERE LOWER(TRIM(username)) = $1 OR LOWER(TRIM(COALESCE(email, ''))) = $1
			ORDER BY (LOWER(TRIM(username)) = $1) DESC, created_at ASC
			LIMIT 1
		`, strings.ToLower(req.Username))
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

		_ = neon.Exec(`UPDATE users SET password_hash = $1 WHERE id = $2::uuid`, hashPassword(req.NewPassword), fmt.Sprintf("%v", row["id"]))

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":       true,
			"username": row["username"],
			"message":  "Contraseña actualizada exitosamente en Neon",
		})
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	resetKey := strings.ToLower(req.Username)
	user, exists := store.users[resetKey]
	if !exists {
		for _, candidate := range store.users {
			if strings.ToLower(strings.TrimSpace(candidate.Email)) == resetKey {
				user = candidate
				exists = true
				break
			}
		}
	}
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
		"ok":       true,
		"username": user.Username,
		"message":  "Contraseña actualizada exitosamente",
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

	claims, ok := requireUserSession(w, r, req.Username)
	if !ok {
		return
	}

	req.Username = claims.Username
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
			WHERE ($3::text != '' AND id::text = $3) OR LOWER(TRIM(username)) = $4
		`, req.Question, hashSecurityAnswer(req.Answer), claims.UID, strings.ToLower(req.Username))

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
	Username            string                `json:"username"`
	EncuestaID          string                `json:"encuesta_id"`
	RecompensaDiamantes int64                 `json:"recompensa_diamantes,omitempty"`
	Respuestas          []SurveyAnswerPayload `json:"respuestas"`
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

	claims, ok := requireUserSession(w, r, req.Username)
	if !ok {
		return
	}
	targetUser := claims.Username
	key := strings.ToLower(strings.TrimSpace(targetUser))
	encID := strings.TrimSpace(req.EncuestaID)
	if encID == "" {
		encID = "encuesta_diaria"
	}
	// Ignorar cualquier monto enviado por el cliente: recompensa fija en servidor
	reward := SurveyRewardDiamonds
	ip := getClientIP(r)

	if neon != nil {
		respJSON, _ := json.Marshal(req.Respuestas)
		uRow, uErr := neon.QueryRow(`
			SELECT u.id::text, COALESCE(u.vip_xp, 0)::bigint as vip_xp,
			       COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
			FROM users u LEFT JOIN wallets w ON u.id = w.user_id
			WHERE ($1::text != '' AND u.id::text = $1) OR LOWER(TRIM(u.username)) = $2
			LIMIT 1
		`, claims.UID, key)
		if uErr != nil || uRow == nil || uRow["id"] == nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
			return
		}
		userID := fmt.Sprintf("%v", uRow["id"])
		balBefore := parseNumber(uRow["balance_diamantes"])

		err := neon.Exec(`
			INSERT INTO respuestas_encuestas (encuesta_id, encuesta_titulo, categoria, user_id, username, respuestas, recompensa_diamantes)
			VALUES ($1, 'Encuesta de Calidad', 'Comunidad', $2::uuid, $3, $4::jsonb, $5)
		`, encID, userID, targetUser, string(respJSON), reward)

		if err != nil {
			errLower := strings.ToLower(err.Error())
			if strings.Contains(errLower, "unique") || strings.Contains(errLower, "duplicate") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "Ya has completado esta encuesta en el día de hoy"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "No se pudo registrar la encuesta en Neon: " + err.Error()})
			return
		}

		_ = neon.Exec(`
			INSERT INTO wallets (user_id, balance_diamantes, updated_at)
			VALUES ($1::uuid, $2, NOW())
			ON CONFLICT (user_id) DO UPDATE
			SET balance_diamantes = wallets.balance_diamantes + $2,
			    updated_at = NOW()
		`, userID, reward)
		_ = neon.Exec(`UPDATE users SET vip_xp = vip_xp + 10, updated_at = NOW() WHERE id = $1::uuid`, userID)
		_, _ = applyVipProgressionNeon(userID, targetUser, ip)

		afterRow, _ := neon.QueryRow(`
			SELECT u.vip_xp, u.vip_level, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
			FROM users u LEFT JOIN wallets w ON u.id = w.user_id
			WHERE u.id = $1::uuid
		`, userID)
		balAfter := balBefore + reward
		xpAfter := parseNumber(uRow["vip_xp"]) + 10
		if afterRow != nil {
			balAfter = parseNumber(afterRow["balance_diamantes"])
			xpAfter = parseNumber(afterRow["vip_xp"])
		}
		logBalanceAudit(userID, targetUser, "SURVEY_REWARD", balAfter-balBefore, balBefore, balAfter, ip, "encuesta_id="+encID)

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":                      true,
			"message":                 fmt.Sprintf("¡Encuesta completada exitosamente! Se han sumado +%d 💎 a tu cuenta.", reward),
			"recompensa_diamantes":    reward,
			"nuevo_balance_diamantes": balAfter,
			"nuevo_vip_xp":            xpAfter,
		})
		return
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	user, exists := store.users[key]
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}
	if store.surveyClaims == nil {
		store.surveyClaims = make(map[string]bool)
	}
	claimKey := key + "|" + encID + "|" + time.Now().Format("2006-01-02")
	if store.surveyClaims[claimKey] {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "Ya has completado esta encuesta en el día de hoy"})
		return
	}
	store.surveyClaims[claimKey] = true

	balBefore := user.BalanceDiamantes
	user.BalanceDiamantes += reward
	user.VIPXP += 10
	appendMemAuditLocked(user.ID, user.Username, "SURVEY_REWARD", reward, balBefore, user.BalanceDiamantes, ip, "encuesta_id="+encID)
	_ = applyVipProgressionMem(user, ip)

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                      true,
		"message":                 fmt.Sprintf("¡Encuesta completada exitosamente! Se han sumado +%d 💎 a tu cuenta.", reward),
		"recompensa_diamantes":    reward,
		"nuevo_balance_diamantes": user.BalanceDiamantes,
		"nuevo_vip_xp":            user.VIPXP,
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
		store.mu.RLock()
		var totalDiam int64
		for _, u := range store.users {
			totalDiam += u.BalanceDiamantes
		}
		totalUsers := len(store.users)
		store.mu.RUnlock()
		writeJSON(w, http.StatusOK, map[string]any{
			"total_users": totalUsers, "total_diamantes": totalDiam, "pending_depositos": 0, "pending_retiros": 0, "active_address": "TYDnyP8p2nQoD9jA5kU8v9L9w5b3x7K2zM",
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
		store.mu.RLock()
		list := make([]*User, 0, len(store.users))
		for _, u := range store.users {
			list = append(list, u)
		}
		store.mu.RUnlock()
		writeJSON(w, http.StatusOK, list)
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
	var req AdminUpdateUserReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Datos de usuario inválidos"})
		return
	}
	ip := getClientIP(r)

	if neon == nil {
		store.mu.Lock()
		defer store.mu.Unlock()
		for _, u := range store.users {
			if u.ID == req.UserID {
				balBefore := u.BalanceDiamantes
				u.BalanceDiamantes = req.BalanceDiamantes
				u.BalanceBonoDiamantes = req.BalanceBonoDiamantes
				u.VIPLevel = req.VIPLevel
				u.CuentaVerificada = req.CuentaVerificada
				appendMemAuditLocked(u.ID, u.Username, "ADMIN_EDIT", req.BalanceDiamantes-balBefore, balBefore, req.BalanceDiamantes, ip,
					fmt.Sprintf("vip=%s verif=%v", req.VIPLevel, req.CuentaVerificada))
				writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Usuario y saldo actualizados exitosamente"})
				return
			}
		}
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "Usuario no encontrado"})
		return
	}

	var targetUsername string
	var balBefore int64
	if prevRow, prevErr := neon.QueryRow(`
		SELECT u.username, COALESCE(w.balance_diamantes, 0)::bigint as balance_diamantes
		FROM users u LEFT JOIN wallets w ON u.id = w.user_id
		WHERE u.id = $1::uuid LIMIT 1
	`, req.UserID); prevErr == nil && prevRow != nil {
		targetUsername = fmt.Sprintf("%v", prevRow["username"])
		balBefore = parseNumber(prevRow["balance_diamantes"])
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

	if targetUsername == "" {
		targetUsername = req.UserID
	}
	logBalanceAudit(req.UserID, targetUsername, "ADMIN_EDIT", req.BalanceDiamantes-balBefore, balBefore, req.BalanceDiamantes, ip,
		fmt.Sprintf("vip=%s verif=%v", req.VIPLevel, req.CuentaVerificada))

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "message": "Usuario y saldo actualizados exitosamente"})
}

func handleAdminGetAuditLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		enableCORS(w)
		return
	}
	if neon == nil {
		store.mu.RLock()
		logs := make([]AuditLogRecord, len(store.auditLogs))
		copy(logs, store.auditLogs)
		store.mu.RUnlock()
		writeJSON(w, http.StatusOK, logs)
		return
	}
	rows, err := neon.Query(`
		SELECT id::text, COALESCE(user_id::text, '') as user_id, username, action,
		       delta, balance_before, balance_after, ip_address, details, created_at
		FROM balance_audit_logs
		ORDER BY created_at DESC
		LIMIT 100
	`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, rows)
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

	// Ruta raíz y endpoints de monitoreo de actividad (UptimeRobot, health checks, cron, etc.)
	healthResponse := func(w http.ResponseWriter, r *http.Request) {
		status := "online_local"
		if neon != nil {
			status = "online_neon_api"
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"status":   "online",
			"database": status,
			"service":  "Panda Creadores iGaming API (Go + Neon)",
			"health":   "/api/v1/health",
			"time":     time.Now().Format(time.RFC3339),
		})
	}

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		cleanPath := strings.TrimRight(r.URL.Path, "/")
		if cleanPath == "" || cleanPath == "/health" || cleanPath == "/healthz" || cleanPath == "/ping" || cleanPath == "/api/health" {
			healthResponse(w, r)
			return
		}
		http.NotFound(w, r)
	})

	mux.HandleFunc("/health", healthResponse)
	mux.HandleFunc("/healthz", healthResponse)
	mux.HandleFunc("/ping", healthResponse)
	mux.HandleFunc("/api/health", healthResponse)
	mux.HandleFunc("/api/v1/health", healthResponse)

	mux.HandleFunc("/api/v1/auth/register", handleRegister)
	mux.HandleFunc("/api/v1/auth/login", handleLogin)
	mux.HandleFunc("/api/v1/auth/security-question", handleSecurityQuestion)
	mux.HandleFunc("/api/v1/auth/reset-by-security", handleResetBySecurity)
	mux.HandleFunc("/api/v1/user/update-security-question", handleUpdateSecurityQuestion)
	mux.HandleFunc("/api/v1/user/profile", handleProfile)
	mux.HandleFunc("/api/v1/user/sync-balance", handleSyncBalance)
	mux.HandleFunc("/api/v1/wallet/sync-balance", handleSyncBalance)
	mux.HandleFunc("/api/v1/user/pagar-verificacion", handlePayVerification)
	mux.HandleFunc("/api/v1/user/cofre-diario", handleDailyChest)
	mux.HandleFunc("/api/v1/user/ruleta", handleRouletteSpin)
	mux.HandleFunc("/api/v1/user/bono-semanal", handleClaimWeeklyBonus)
	mux.HandleFunc("/api/v1/wallet/retirar", handleWithdraw)
	mux.HandleFunc("/api/v1/wallet/direccion-recarga", handleGetDireccionRecarga)
	mux.HandleFunc("/api/v1/wallet/recargar", handleDeposit)
	mux.HandleFunc("/api/v1/wallet/aprobar-recarga", handleApproveDeposit)
	mux.HandleFunc("/api/v1/wallet/recarga-status", handleCheckDepositStatus)
	mux.HandleFunc("/api/v1/encuestas/hoy", handleGetEncuestasHoy)
	mux.HandleFunc("/api/v1/encuestas/responder", handleResponderEncuesta)
	mux.HandleFunc("/api/v1/encuestas/respuestas", handleGetRespuestasEncuestas)

	// --- RUTAS DE ADMINISTRACIÓN (Protegidas con X-Admin-Key) ---
	mux.HandleFunc("/api/v1/admin/verify", requireAdminAuth(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}))
	mux.HandleFunc("/api/v1/admin/audit-logs", requireAdminAuth(handleAdminGetAuditLogs))
	mux.HandleFunc("/api/v1/admin/stats", requireAdminAuth(handleAdminStats))
	mux.HandleFunc("/api/v1/admin/direcciones", requireAdminAuth(handleAdminGetDirecciones))
	mux.HandleFunc("/api/v1/admin/direcciones/guardar", requireAdminAuth(handleAdminSaveDireccion))
	mux.HandleFunc("/api/v1/admin/direcciones/activar", requireAdminAuth(handleAdminSetActiveDireccion))
	mux.HandleFunc("/api/v1/admin/users", requireAdminAuth(handleAdminGetUsers))
	mux.HandleFunc("/api/v1/admin/users/editar", requireAdminAuth(handleAdminUpdateUser))
	mux.HandleFunc("/api/v1/admin/depositos", requireAdminAuth(handleAdminGetDepositos))
	mux.HandleFunc("/api/v1/admin/retiros", requireAdminAuth(handleAdminGetRetiros))
	mux.HandleFunc("/api/v1/admin/retiros/procesar", requireAdminAuth(handleAdminProcessRetiro))

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
