-- =============================================================================
-- PANDA CASH - ESQUEMA DE BASE DE DATOS POSTGRESQL (v1.0)
-- =============================================================================
-- Este esquema define la estructura relacional para autenticación, gestión
-- de saldo en diamantes (💎), niveles VIP, y el flujo de verificación de cuenta.
--
-- REGLA DE NEGOCIO CLAVE:
-- La tabla 'users' posee la columna 'cuenta_verificada' (is_verified).
-- Por defecto es FALSE. Cambia a TRUE cuando el usuario paga la tasa de verificación.
-- Una cuenta NO verificada PUEDE registrarse, recargar y jugar, pero TIENE
-- ESTRICTAMENTE PROHIBIDO solicitar retiros de ganancias (garantizado a nivel
-- de base de datos mediante triggers y funciones plpgsql).
-- =============================================================================

-- Extensión para generación de UUIDs nativos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABLA: USERS (Usuarios y Estado de Verificación)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(30) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    -- =========================================================================
    -- CAMPO REQUERIDO: CUENTA VERIFICADA
    -- =========================================================================
    cuenta_verificada BOOLEAN DEFAULT FALSE NOT NULL,       -- Inicia en FALSE
    fecha_verificacion TIMESTAMPTZ NULL,                   -- Fecha/hora de pago
    monto_verificacion_usdt NUMERIC(10, 2) DEFAULT 10.00,  -- Tasa (ej. 10 USDT)
    monto_verificacion_diamantes INT DEFAULT 100,          -- Tasa en 💎 (100 💎)
    tx_hash_verificacion VARCHAR(120) NULL,                -- Hash TRC-20 o ref interna
    metodo_pago_verificacion VARCHAR(50) NULL,             -- 'saldo_diamantes' | 'trc20_directo'

    -- Perfil VIP y Progresión
    vip_level VARCHAR(30) DEFAULT 'Panda Bronce' NOT NULL,
    vip_xp INT DEFAULT 0 NOT NULL,
    avatar_url VARCHAR(500) DEFAULT 'https://api.dicebear.com/7.x/bottts/svg?seed=panda',

    -- Control de Cofre Diario, Ruleta de la Suerte (24h) y Bono de Primer Depósito
    ultimo_cofre_abierto_at TIMESTAMPTZ NULL,
    ultima_ruleta_girada_at TIMESTAMPTZ NULL,
    primer_deposito_realizado BOOLEAN DEFAULT FALSE NOT NULL,

    -- Pregunta y Respuesta Secreta de Seguridad (Recuperación Autónoma)
    security_question VARCHAR(255) DEFAULT '¿Cuál fue el nombre de tu primera mascota?' NULL,
    security_answer_hash VARCHAR(255) NULL,

    -- Metadatos de seguridad y auditoría
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índices de búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_verificada ON users(cuenta_verificada);

-- =============================================================================
-- 2. TABLA: WALLETS (Billeteras de Diamantes y Equivalencia USDT)
-- =============================================================================
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Saldos en Diamantes (1 USDT = 10 💎) - Cuenta inicia estrictamente en 0
    balance_diamantes BIGINT DEFAULT 0 NOT NULL CHECK (balance_diamantes >= 0),
    balance_bono_diamantes BIGINT DEFAULT 0 NOT NULL CHECK (balance_bono_diamantes >= 0),
    giros_gratis INT DEFAULT 0 NOT NULL CHECK (giros_gratis >= 0),

    -- Acumulados históricos
    total_depositado_usdt NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    total_retirado_usdt NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    total_jugado_diamantes BIGINT DEFAULT 0 NOT NULL,
    total_ganado_diamantes BIGINT DEFAULT 0 NOT NULL,

    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- 3. TABLA: DIRECCIONES DE RECARGA (Dirección pública oficial leída por el sistema)
-- =============================================================================
CREATE TABLE IF NOT EXISTS direcciones_recarga (
    id SERIAL PRIMARY KEY,
    red VARCHAR(50) NOT NULL DEFAULT 'TRON (TRC-20)',
    moneda VARCHAR(20) NOT NULL DEFAULT 'USDT',
    direccion VARCHAR(120) NOT NULL UNIQUE,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    descripcion VARCHAR(255) DEFAULT 'Dirección pública oficial de recargas Panda Cash',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

INSERT INTO direcciones_recarga (red, moneda, direccion, activa, descripcion)
VALUES ('TRON (TRC-20)', 'USDT', 'TYDnyP8p2nQoD9jA5kU8v9L9w5b3x7K2zM', TRUE, 'Dirección pública oficial de recargas Panda Cash')
ON CONFLICT (direccion) DO UPDATE
SET activa = TRUE, updated_at = NOW();

-- =============================================================================
-- 4. TABLA: DEPOSITOS (Recargas en USDT TRC-20 - Mínimo 10 USDT / 100 💎)
-- =============================================================================
CREATE TABLE IF NOT EXISTS depositos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    monto_usdt NUMERIC(12, 2) NOT NULL CHECK (monto_usdt >= 10.00),
    monto_diamantes BIGINT NOT NULL CHECK (monto_diamantes >= 100),
    
    red_blockchain VARCHAR(20) DEFAULT 'TRC-20' NOT NULL,
    tron_wallet_destino VARCHAR(50) NOT NULL,
    tx_hash_tron VARCHAR(120) NULL,
    comprobante_url TEXT NULL,
    
    estado VARCHAR(20) DEFAULT 'PENDIENTE' NOT NULL CHECK (estado IN ('PENDIENTE', 'CONFIRMANDO', 'APROBADA', 'APROBADO', 'COMPLETADO', 'RECHAZADO')),
    fecha_aprobacion TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- 3.1. TRIGGER: ACREDITACIÓN AUTOMÁTICA AL APROBAR DEPÓSITOS
-- =============================================================================
-- Si cualquier script, monitor o admin actualiza un depósito a 'APROBADA',
-- 'APROBADO' o 'COMPLETADO', este trigger acredita de inmediato los diamantes
-- al usuario en la tabla 'wallets' y suma sus puntos VIP en 'users'.
-- =============================================================================
CREATE OR REPLACE FUNCTION trg_fn_on_deposito_aprobado()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.estado IN ('APROBADA', 'APROBADO', 'COMPLETADO')) 
       AND (OLD.estado NOT IN ('APROBADA', 'APROBADO', 'COMPLETADO')) THEN
        
        IF NEW.fecha_aprobacion IS NULL THEN
            NEW.fecha_aprobacion := NOW();
        END IF;

        NEW.estado := 'APROBADA';

        UPDATE wallets
        SET balance_diamantes = balance_diamantes + NEW.monto_diamantes,
            total_depositado_usdt = total_depositado_usdt + NEW.monto_usdt,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;

        UPDATE users
        SET vip_xp = vip_xp + CAST(NEW.monto_usdt * 2 AS INT)
        WHERE id = NEW.user_id;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deposito_aprobado_auto_credit ON depositos;
CREATE TRIGGER trg_deposito_aprobado_auto_credit
BEFORE UPDATE OF estado ON depositos
FOR EACH ROW
EXECUTE FUNCTION trg_fn_on_deposito_aprobado();

CREATE OR REPLACE FUNCTION trg_fn_on_deposito_insert_aprobado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado IN ('APROBADA', 'APROBADO', 'COMPLETADO') THEN
        UPDATE wallets
        SET balance_diamantes = balance_diamantes + NEW.monto_diamantes,
            total_depositado_usdt = total_depositado_usdt + NEW.monto_usdt,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;

        UPDATE users
        SET vip_xp = vip_xp + CAST(NEW.monto_usdt * 2 AS INT)
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deposito_insert_auto_credit ON depositos;
CREATE TRIGGER trg_deposito_insert_auto_credit
AFTER INSERT ON depositos
FOR EACH ROW
EXECUTE FUNCTION trg_fn_on_deposito_insert_aprobado();

-- =============================================================================
-- 3.2. FUNCIÓN PARA APROBACIÓN DE DEPÓSITOS (Invocada por script de monitoreo TRON)
-- =============================================================================
CREATE OR REPLACE FUNCTION aprobar_deposito(p_tx_hash VARCHAR)
RETURNS JSON AS $$
DECLARE
    v_deposito depositos%ROWTYPE;
BEGIN
    SELECT * INTO v_deposito 
    FROM depositos 
    WHERE LOWER(TRIM(tx_hash_tron)) = LOWER(TRIM(p_tx_hash))
       OR id::text = TRIM(p_tx_hash)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Depósito con ese TxID o ID no encontrado');
    END IF;

    IF v_deposito.estado IN ('APROBADA', 'APROBADO', 'COMPLETADO') THEN
        RETURN json_build_object('success', false, 'error', 'El depósito ya fue aprobado previamente', 'estado', v_deposito.estado);
    END IF;

    -- Al hacer UPDATE del estado a 'APROBADA', el TRIGGER trg_deposito_aprobado_auto_credit
    -- se encarga de acreditar automáticamente el balance en wallets y sumar VIP XP
    UPDATE depositos
    SET estado = 'APROBADA',
        fecha_aprobacion = NOW()
    WHERE id = v_deposito.id;

    RETURN json_build_object(
        'success', true,
        'message', 'Depósito aprobado exitosamente. Diamantes acreditados al usuario.',
        'deposito_id', v_deposito.id,
        'tx_hash', v_deposito.tx_hash_tron,
        'monto_usdt', v_deposito.monto_usdt,
        'monto_diamantes', v_deposito.monto_diamantes,
        'nuevo_estado', 'APROBADA'
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. TABLA: RETIROS (Retiros de Ganancias en USDT TRC-20 - Mínimo 100 USDT / 1,000 💎)
-- =============================================================================
CREATE TABLE IF NOT EXISTS retiros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    monto_diamantes BIGINT NOT NULL CHECK (monto_diamantes >= 1000),
    monto_usdt NUMERIC(12, 2) NOT NULL CHECK (monto_usdt >= 100.00),
    
    red_blockchain VARCHAR(20) DEFAULT 'TRC-20' NOT NULL,
    tron_wallet_receptora VARCHAR(50) NOT NULL CHECK (tron_wallet_receptora LIKE 'T%'),
    tx_hash_tron VARCHAR(120) NULL,
    
    -- Estado: ingresa a lista de espera para auditoría manual
    estado VARCHAR(20) DEFAULT 'EN_ESPERA' NOT NULL CHECK (estado IN ('EN_ESPERA', 'SOLICITADO', 'PROCESANDO', 'DESPACHADO', 'RECHAZADO')),
    
    -- Estimación de tiempo en lista de espera (aleatorio entre 3 días y 1 semana / procesamiento manual)
    tiempo_estimado_dias INT DEFAULT 5,
    fecha_estimada_liberacion TIMESTAMPTZ NULL,
    nota_procesamiento TEXT DEFAULT 'Procesamiento manual por equipo de seguridad y auditoría financiera',

    -- Registro de auditoría de verificación
    usuario_estaba_verificado BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- 5. TRIGGER DE BASE DE DATOS: RESTRICCIÓN ESTRICTA DE RETIROS
-- =============================================================================
-- Si un usuario intenta insertar un retiro y cuenta_verificada es FALSE,
-- PostgreSQL aborta la transacción inmediatamente.
-- =============================================================================
CREATE OR REPLACE FUNCTION validar_cuenta_verificada_para_retiro()
RETURNS TRIGGER AS $$
DECLARE
    v_verificada BOOLEAN;
    v_username VARCHAR(50);
BEGIN
    SELECT cuenta_verificada, username 
    INTO v_verificada, v_username
    FROM users 
    WHERE id = NEW.user_id;

    IF v_verificada IS NOT TRUE THEN
        RAISE EXCEPTION 'REGLA_BLOQUEO: El usuario "%" (ID: %) no tiene la cuenta verificada. Debe pagar la tasa de verificación antes de solicitar retiros.', 
            v_username, NEW.user_id
            USING ERRCODE = 'check_violation';
    END IF;

    NEW.usuario_estaba_verificado := TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_retiro_verificado ON retiros;
CREATE TRIGGER trg_validar_retiro_verificado
BEFORE INSERT ON retiros
FOR EACH ROW
EXECUTE FUNCTION validar_cuenta_verificada_para_retiro();

-- =============================================================================
-- 6. TABLA: PAGOS_VERIFICACION (Historial de Pagos de la Tasa)
-- =============================================================================
CREATE TABLE IF NOT EXISTS pagos_verificacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    monto_pagado_diamantes INT DEFAULT 100,
    monto_pagado_usdt NUMERIC(10, 2) DEFAULT 10.00,
    metodo VARCHAR(50) NOT NULL, -- 'diamantes_balance' | 'usdt_trc20'
    tx_hash VARCHAR(120) NULL,
    estado VARCHAR(20) DEFAULT 'APROBADO' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- 7. PROCEDIMIENTO ALMACENADO: ACTIVAR VERIFICACIÓN DE CUENTA
-- =============================================================================
CREATE OR REPLACE FUNCTION pagar_y_activar_verificacion(
    p_user_id UUID,
    p_metodo VARCHAR,
    p_tx_hash VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_user users%ROWTYPE;
    v_wallet wallets%ROWTYPE;
    v_costo_diamantes INT := 100;
BEGIN
    -- 1. Obtener usuario
    SELECT * INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;

    -- Si ya está verificada
    IF v_user.cuenta_verificada THEN
        RETURN json_build_object('success', true, 'message', 'La cuenta ya se encuentra verificada previamente');
    END IF;

    -- 2. Si paga con saldo en diamantes, verificar fondos y descontar
    IF p_metodo = 'saldo_diamantes' THEN
        SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
        IF v_wallet.balance_diamantes < v_costo_diamantes THEN
            RETURN json_build_object('success', false, 'error', 'Saldo insuficiente de diamantes para pagar la verificación (Requiere 100 💎)');
        END IF;

        UPDATE wallets 
        SET balance_diamantes = balance_diamantes - v_costo_diamantes,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;

    -- 3. Marcar usuario como verificado
    UPDATE users 
    SET cuenta_verificada = TRUE,
        fecha_verificacion = NOW(),
        metodo_pago_verificacion = p_metodo,
        tx_hash_verificacion = p_tx_hash,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- 4. Registrar en historial de pagos
    INSERT INTO pagos_verificacion (user_id, monto_pagado_diamantes, monto_pagado_usdt, metodo, tx_hash, estado)
    VALUES (p_user_id, v_costo_diamantes, 10.00, p_metodo, p_tx_hash, 'APROBADO');

    RETURN json_build_object(
        'success', true,
        'message', '¡Cuenta verificada exitosamente! Retiros de ganancias habilitados.',
        'user_id', p_user_id,
        'cuenta_verificada', true
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 8. TABLA Y FUNCIÓN: COFRE DIARIO (COOLDOWN 24H Y PROBABILIDAD PONDERADA)
-- =============================================================================
-- Tabla de historial de aperturas de cofres diarios:
-- Premios posibles (ponderados en beneficio de la casa):
--   1. +100 XP                 (48.0% probabilidad)
--   2. +50 💎 (5 USDT)         (32.0% probabilidad) -> 80% entre los 2 menores
--   3. +200 XP                 (11.0% probabilidad)
--   4. +500 XP                 (5.5% probabilidad)
--   5. +100 💎 (10 USDT)       (2.7% probabilidad)
--   6. +200 💎 (20 USDT)       (0.8% probabilidad)
-- =============================================================================
CREATE TABLE IF NOT EXISTS cofres_diarios_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo_beneficio VARCHAR(20) NOT NULL CHECK (tipo_beneficio IN ('XP', 'DIAMANTES')),
    cantidad_otorgada INT NOT NULL,
    equivalente_usdt NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    etiqueta_premio VARCHAR(60) NOT NULL,
    probabilidad_porcentaje NUMERIC(5, 2) NOT NULL,
    abierto_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cofres_user_fecha ON cofres_diarios_historial(user_id, abierto_at DESC);

CREATE OR REPLACE FUNCTION reclamar_cofre_diario(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_ultimo_cofre TIMESTAMPTZ;
    v_rand NUMERIC;
    v_tipo VARCHAR(20);
    v_cantidad INT;
    v_usdt NUMERIC(10, 2) := 0.00;
    v_etiqueta VARCHAR(60);
    v_prob NUMERIC(5, 2);
BEGIN
    SELECT ultimo_cofre_abierto_at INTO v_ultimo_cofre
    FROM users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Usuario no encontrado');
    END IF;

    -- Validar que hayan transcurrido al menos 24 horas desde la última apertura
    IF v_ultimo_cofre IS NOT NULL AND (NOW() - v_ultimo_cofre) < INTERVAL '24 hours' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'COOLDOWN_ACTIVO',
            'message', 'Debes esperar 24 horas desde tu último cofre para abrir uno nuevo.',
            'ultimo_cofre_abierto_at', v_ultimo_cofre,
            'proximo_cofre_disponible_at', v_ultimo_cofre + INTERVAL '24 hours',
            'segundos_restantes', EXTRACT(EPOCH FROM ((v_ultimo_cofre + INTERVAL '24 hours') - NOW()))::INT
        );
    END IF;

    -- Sorteo aleatorio ponderado (0.00 a 100.00) a favor de la casa
    v_rand := (random() * 100.0)::NUMERIC(5, 2);

    IF v_rand < 48.00 THEN
        v_tipo := 'XP'; v_cantidad := 100; v_usdt := 0.00; v_etiqueta := '+100 XP VIP'; v_prob := 48.00;
    ELSIF v_rand < 80.00 THEN
        v_tipo := 'DIAMANTES'; v_cantidad := 50; v_usdt := 5.00; v_etiqueta := '+50 💎 (5 USDT)'; v_prob := 32.00;
    ELSIF v_rand < 91.00 THEN
        v_tipo := 'XP'; v_cantidad := 200; v_usdt := 0.00; v_etiqueta := '+200 XP VIP'; v_prob := 11.00;
    ELSIF v_rand < 96.50 THEN
        v_tipo := 'XP'; v_cantidad := 500; v_usdt := 0.00; v_etiqueta := '+500 XP VIP'; v_prob := 5.50;
    ELSIF v_rand < 99.20 THEN
        v_tipo := 'DIAMANTES'; v_cantidad := 100; v_usdt := 10.00; v_etiqueta := '+100 💎 (10 USDT)'; v_prob := 2.70;
    ELSE
        v_tipo := 'DIAMANTES'; v_cantidad := 200; v_usdt := 20.00; v_etiqueta := '+200 💎 (20 USDT)'; v_prob := 0.80;
    END IF;

    -- Acreditar beneficio y actualizar timestamp de último cofre
    IF v_tipo = 'XP' THEN
        UPDATE users
        SET vip_xp = vip_xp + v_cantidad,
            ultimo_cofre_abierto_at = NOW(),
            updated_at = NOW()
        WHERE id = p_user_id;
    ELSE
        UPDATE users
        SET ultimo_cofre_abierto_at = NOW(),
            updated_at = NOW()
        WHERE id = p_user_id;

        UPDATE wallets
        SET balance_diamantes = balance_diamantes + v_cantidad,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;

    -- Guardar registro en el historial de cofres
    INSERT INTO cofres_diarios_historial (user_id, tipo_beneficio, cantidad_otorgada, equivalente_usdt, etiqueta_premio, probabilidad_porcentaje)
    VALUES (p_user_id, v_tipo, v_cantidad, v_usdt, v_etiqueta, v_prob);

    RETURN json_build_object(
        'success', true,
        'tipo', v_tipo,
        'cantidad', v_cantidad,
        'equivalente_usdt', v_usdt,
        'etiqueta', v_etiqueta,
        'probabilidad', v_prob,
        'ultimo_cofre_abierto_at', NOW(),
        'proximo_cofre_disponible_at', NOW() + INTERVAL '24 hours'
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DATOS SEMILLA PARA PRUEBAS (Seed data)
-- =============================================================================
-- Usuario 1: Verificado (puede retirar)
INSERT INTO users (id, username, email, password_hash, cuenta_verificada, fecha_verificacion, vip_level)
VALUES (
    'a1b2c3d4-0000-0000-0000-000000000001',
    'PandaMaster_99',
    'pandamaster@pandabet.com',
    '$2a$12$e8YtBq4K.3vV1kLm6HjOuO9eN7g0QfR8yZs9W1xY2u.mockhash',
    TRUE,
    NOW(),
    'Panda Bronce'
) ON CONFLICT (username) DO NOTHING;

INSERT INTO wallets (user_id, balance_diamantes, balance_bono_diamantes, giros_gratis)
VALUES (
    'a1b2c3d4-0000-0000-0000-000000000001',
    15000,
    30000,
    150
) ON CONFLICT (user_id) DO NOTHING;

-- Usuario 2: No Verificado (retiros bloqueados hasta que pague)
INSERT INTO users (id, username, email, password_hash, cuenta_verificada, vip_level)
VALUES (
    'a1b2c3d4-0000-0000-0000-000000000002',
    'NuevoJugador_2026',
    'nuevo@pandabet.com',
    '$2a$12$e8YtBq4K.3vV1kLm6HjOuO9eN7g0QfR8yZs9W1xY2u.mockhash',
    FALSE, -- CUENTA NO VERIFICADA
    'Panda Bronce'
) ON CONFLICT (username) DO NOTHING;

INSERT INTO wallets (user_id, balance_diamantes, balance_bono_diamantes, giros_gratis)
VALUES (
    'a1b2c3d4-0000-0000-0000-000000000002',
    5000,
    10000,
    50
) ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- 9. TABLA: RESPUESTAS_ENCUESTAS (Consistencia de Datos de Encuestas Diarias)
-- =============================================================================
CREATE TABLE IF NOT EXISTS respuestas_encuestas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encuesta_id VARCHAR(50) NOT NULL,
    encuesta_titulo VARCHAR(255) NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    respuestas JSONB NOT NULL, -- Array con { pregunta_id, pregunta, respuesta_seleccionada }
    recompensa_diamantes INT NOT NULL DEFAULT 50,
    fecha_respuesta TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    fecha_dia DATE DEFAULT CURRENT_DATE NOT NULL
);

-- Índices para consultas rápidas y consistencia
CREATE INDEX IF NOT EXISTS idx_respuestas_username ON respuestas_encuestas(username);
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta ON respuestas_encuestas(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_respuestas_fecha_dia ON respuestas_encuestas(fecha_dia);
-- Evitar que el mismo usuario responda la misma encuesta más de una vez en el mismo día
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_encuesta_dia ON respuestas_encuestas(username, encuesta_id, fecha_dia);
