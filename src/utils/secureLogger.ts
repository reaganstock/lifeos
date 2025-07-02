/**
 * Secure logging utility that prevents sensitive data exposure in production
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export class SecureLogger {
  /**
   * Safe console.log that only logs in development
   */
  static log(message: string, data?: any): void {
    if (isDevelopment) {
      console.log(message, data);
    }
  }

  /**
   * Safe console.error that sanitizes errors in production
   */
  static error(message: string, error?: any): void {
    if (isDevelopment) {
      console.error(message, error);
    } else {
      // Only log error message in production, not full error object
      console.error(message, error?.message || 'An error occurred');
    }
  }

  /**
   * Safe console.warn that only logs in development
   */
  static warn(message: string, data?: any): void {
    if (isDevelopment) {
      console.warn(message, data);
    }
  }

  /**
   * Log user data safely (never logs actual user content in production)
   */
  static logUserData(message: string, userData?: any): void {
    if (isDevelopment) {
      console.log(message, userData);
    } else {
      // Only log that user data exists, not the actual content
      console.log(message, userData ? '[User data present]' : '[No user data]');
    }
  }

  /**
   * Log API responses safely (strips sensitive data in production)
   */
  static logAPIResponse(message: string, response?: any): void {
    if (isDevelopment) {
      console.log(message, response);
    } else {
      // Only log success/failure status in production
      console.log(message, response?.success ? 'Success' : 'Failed');
    }
  }

  /**
   * Log with timestamp (development only)
   */
  static timestampLog(message: string, data?: any): void {
    if (isDevelopment) {
      console.log(`[${new Date().toISOString()}] ${message}`, data);
    }
  }
}

// Export convenient aliases
export const secureLog = SecureLogger.log;
export const secureError = SecureLogger.error;
export const secureWarn = SecureLogger.warn;