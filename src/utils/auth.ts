import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import logger from './logger';
import crypto from 'crypto';

// Ensure environment variables are loaded
import 'dotenv/config';
import config from '../config';

const saltRounds = config.SALT_ROUNDS;

/**
 * Utility class for authentication-related operations.
 * This class provides methods for hashing passwords, generating and verifying JWT tokens,
 * and encrypting/decrypting data using AES encryption.
 */
export class AuthUtils {
  /**
   * Hashes a plain text password.
   * @param password The plain text password.
   * @returns The hashed password.
   */
  public static async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, saltRounds);
      return hash;
    } catch (error) {
      logger('[AUTH_UTILS]').error('Error hashing password:', error);
      throw new Error('Password hashing failed.');
    }
  }

  /**
   * Compares a plain text password with a hashed password.
   * @param password The plain text password.
   * @param hash The hashed password.
   * @returns True if passwords match, false otherwise.
   */
  public static async comparePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    try {
      const match = await bcrypt.compare(password, hash);
      return match;
    } catch (error) {
      logger('[AUTH_UTILS]').error('Error comparing password:', error);
      return false;
    }
  }

  /**
   * Generates a JWT token.
   * @param payload The payload to include in the token.
   * @param secret The secret key to sign the token.
   * @param expiresIn Expiration time (e.g., 24 * 60 * 60 * 1000). 24hrs by default.
   * @returns The generated JWT token.
   */
  public static async generateToken(
    payload: object,
    secret: string,
    expiresIn: number = 24 * 60 * 60 * 1000,
  ): Promise<string> {
    try {
      const val = jwt.sign(payload, secret, { expiresIn, algorithm: 'HS256' });
      return val;
    } catch (error) {
      logger('[AUTH_UTILS]').error('Error generating token:', error);
      throw new Error('Token generation failed.');
    }
  }

  /**
   * Verifies a JWT token with enhanced security checks.
   * @param token The JWT token to verify.
   * @param secret The secret key to verify the token's signature.
   * @returns The decoded payload if valid, null otherwise.
   */
  public static async verifyToken<T>(
    token: string,
    secret: string,
  ): Promise<T | null> {
    try {
      const options: jwt.VerifyOptions = {
        // Explicitly define the expected algorithm to prevent algorithm confusion attacks
        algorithms: ['HS256'],
      };

      console.log("TOKEN:", token);

      const res = jwt.verify(token, secret, options);
      logger('[AUTH_UTILS]').info('Token verified successfully:', res);
      return res as T;
    } catch (error: any) {
      // Log a more specific error message based on the error type
      if (error instanceof jwt.TokenExpiredError) {
        logger('[AUTH_UTILS]').warn(
          'Token verification failed: Token expired.',
        );
        throw new Error('Token expired.');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger('[AUTH_UTILS]').warn(
          'Token verification failed: Invalid token signature or malformed token.',
        );
        throw new Error('Invalid token signature or malformed token.');
      } else {
        logger('[AUTH_UTILS]').error(
          'An unexpected error occurred during token verification:',
          error,
        );
        throw new Error(
          error.message ||
            'Token verification failed due to an unexpected error.',
        );
      }
    }
  }

  /**
   * Encrypts a string using AES encryption.
   * @param text The text to encrypt.
   * @param secretKey The secret key for encryption.
   * @returns An object containing the encrypted string, IV, and salt.
   */
  public static async encryptAES(
    text: string,
    secretKey: string,
  ): Promise<{ aesEncString: string; iv: string; salt: string }> {
    if (!text || !secretKey) {
      throw new Error('Encryption failed: Text and secret key are required.');
    }

    // Use a secure key derivation function like PBKDF2
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha512');

    // Generate a cryptographically secure random IV for each operation
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const aesEncString = Buffer.from(encrypted, 'hex').toString('base64');
    return { aesEncString, iv: iv.toString('base64'), salt };
  }

  /**
   * Decrypts a string encrypted with AES.
   * @param encrypted The encrypted string.
   * @param secretKey The secret key used for encryption.
   * @param iv The initialization vector used during encryption.
   * @param salt The salt used during key derivation.
   * @returns The decrypted string.
   */
  public static async decryptAES(
    encrypted: string,
    secretKey: string,
    iv: string,
    salt: string,
  ): Promise<string> {
    if (!encrypted || !secretKey || !iv) {
      throw new Error(
        'Decryption failed: Encrypted string, secret key, and IV are required.',
      );
    }

    try {
      const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha512'); // Use the same salt and key derivation
      const ivBuffer = Buffer.from(iv, 'base64');
      const encryptedBuffer = Buffer.from(encrypted, 'base64').toString('hex');

      const decipher = crypto.createDecipheriv('aes-256-cbc', key, ivBuffer);
      let decrypted = decipher.update(encryptedBuffer, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(
        'Decryption failed: Invalid key, IV, or encrypted string.',
      );
    }
  }

  /**
   * Hashes a string using SHA-256 or MD5.
   * @param text The string to hash.
   * @param algorithm The hashing algorithm ('sha256' or 'md5').
   * @returns The hashed string in hexadecimal format.
   */
  public static async hashString(
    text: string,
    algorithm: 'sha256' | 'md5' = 'sha256',
  ): Promise<string> {
    return crypto.createHash(algorithm).update(text).digest('hex');
  }

  /**
   * Generates a random string of specified length.
   * @param length The length of the random string.
   * @returns A random alphanumeric string.
   */
  public static async compareHash(
    text: string,
    hashed: string,
    algorithm: 'sha256' | 'md5' = 'sha256',
  ): Promise<boolean> {
    return (await this.hashString(text, algorithm)) === hashed;
  }

  public static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password',
      '12345678',
      'qwerty123',
      'admin',
      'user',
      'webmaster',
    ];
    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Calculates the similarity between two passwords using Levenshtein distance.
   * This method uses Levenshtein distance to calculate the similarity between two passwords.
   * @param a The first password.
   * @param b The second password.
   * @returns A similarity score between 0 and 1.
   */
  public static async calculatePasswordSimilarity(
    a: string,
    b: string,
  ): Promise<number> {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    const longerLength = longer.length;

    if (longerLength === 0) return 1.0;

    // Calculate Levenshtein distance
    const distance = await this.levenshteinDistance(longer, shorter);
    return (longerLength - distance) / longerLength;
  }

  /**
   * Calculates the Levenshtein distance between two strings.
   * This method calculates the Levenshtein distance between two strings.
   * @param a The first string.
   * @param b The second string.
   * @returns The Levenshtein distance.
   */
  public static async levenshteinDistance(
    a: string,
    b: string,
  ): Promise<number> {
    const m = a.length;
    const n = b.length;

    if (m === 0) return n;
    if (n === 0) return m;

    // Create a 2D array and initialize the first row
    const matrix = new Array(n + 1);
    for (let j = 0; j <= n; j++) {
      matrix[j] = new Array(m + 1);
      matrix[j][0] = j;
    }

    // Initialize the first column
    for (let i = 0; i <= m; i++) {
      matrix[0][i] = i;
    }

    // Fill the matrix
    for (let j = 1; j <= n; j++) {
      for (let i = 1; i <= m; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // Deletion
          matrix[j - 1][i] + 1, // Insertion
          matrix[j - 1][i - 1] + cost, // Substitution
        );
      }
    }

    return matrix[n][m];
  }
}
