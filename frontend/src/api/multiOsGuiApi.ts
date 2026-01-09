import { httpClient } from './httpClient';

/**
 * DEPRECATED: This API file is obsolete.
 * Use session-scoped endpoints in MultiOsConnectionPanel.tsx instead.
 * 
 * New routes:
 * - POST /solver/sessions/:sessionId/gui
 * - GET /solver/sessions/:sessionId/gui
 * - DELETE /solver/sessions/:sessionId/gui
 * - GET /solver/sessions/:sessionId/gui/health
 * 
 * These routes use SessionOwnershipGuard for proper isolation.
 */

// Keep file for backward compatibility but mark as deprecated
export const multiOsGuiApi = {
  /**
   * @deprecated Use session-scoped endpoints instead
   */
  async startSession(): Promise<never> {
    throw new Error('DEPRECATED: Use /solver/sessions/:sessionId/gui instead');
  },

  /**
   * @deprecated Use session-scoped endpoints instead
   */
  async getSession(): Promise<never> {
    throw new Error('DEPRECATED: Use /solver/sessions/:sessionId/gui instead');
  },

  /**
   * @deprecated Use session-scoped endpoints instead
   */
  async stopSession(): Promise<never> {
    throw new Error('DEPRECATED: Use DELETE /solver/sessions/:sessionId/gui instead');
  },

  /**
   * @deprecated Use session-scoped endpoints instead
   */
  async heartbeat(): Promise<never> {
    throw new Error('DEPRECATED: heartbeat not needed - sessions auto-timeout');
  },

  /**
   * @deprecated Use session-scoped endpoints instead
   */
  async getMySessions(): Promise<never> {
    throw new Error('DEPRECATED: GUI sessions are tied to environment sessions');
  },
};
