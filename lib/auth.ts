import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getAdminByEmail, updateAdminLastLogin } from './db';

// Tipos
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  admin?: {
    id: string;
    email: string;
    fullname?: string;
    role: string;
  };
  error?: string;
}

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-key-in-production';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as string;
const BCRYPT_ROUNDS = 10;

/**
 * Hash de contraseña usando bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifica contraseña contra hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Genera JWT token para un admin
 */
export function generateToken(payload: JWTPayload): string {
  // @ts-ignore - jsonwebtoken types issue with options
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifica y decodifica JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Autentica un administrador con email y contraseña
 */
export async function authenticateAdmin(email: string, password: string): Promise<AuthResult> {
  try {
    // Buscar admin en BD
    const admin = await getAdminByEmail(email);
    
    if (!admin) {
      return {
        success: false,
        error: 'Credenciales inválidas',
      };
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(password, admin.password_hash);
    
    if (!isValidPassword) {
      return {
        success: false,
        error: 'Credenciales inválidas',
      };
    }

    // Generar token
    const token = generateToken({
      userId: admin.id,
      email: admin.email,
      role: admin.role,
    });

    // Actualizar último login
    await updateAdminLastLogin(email);

    return {
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        fullname: admin.fullname,
        role: admin.role,
      },
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Error de autenticación',
    };
  }
}

/**
 * Verifica si un token es válido y retorna los datos del admin
 */
export async function verifyAdminToken(token: string): Promise<AuthResult> {
  try {
    const payload = verifyToken(token);
    
    if (!payload) {
      return {
        success: false,
        error: 'Token inválido o expirado',
      };
    }

    // Verificar que el admin aún existe y está activo
    const admin = await getAdminByEmail(payload.email);
    
    if (!admin || !admin.is_active) {
      return {
        success: false,
        error: 'Usuario no encontrado o inactivo',
      };
    }

    return {
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullname: admin.fullname,
        role: admin.role,
      },
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return {
      success: false,
      error: 'Error verificando token',
    };
  }
}

