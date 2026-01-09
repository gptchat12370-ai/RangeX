import { Injectable, BadRequestException, Logger } from '@nestjs/common';

/**
 * Session State Machine - Validates state transitions
 * Based on OWASP Session Management Best Practices
 * Implements Finite State Machine pattern (Gang of Four)
 */

export type SessionState = 'created' | 'starting' | 'running' | 'paused' | 'stopping' | 'terminated' | 'error';

interface StateTransition {
  from: SessionState;
  to: SessionState;
  action: string;
  description: string;
}

@Injectable()
export class SessionStateMachineService {
  private readonly logger = new Logger(SessionStateMachineService.name);

  /**
   * Valid state transitions
   * Based on session lifecycle requirements
   */
  private readonly validTransitions: StateTransition[] = [
    // Initial start flow
    { from: 'created', to: 'starting', action: 'start', description: 'User starts environment' },
    { from: 'starting', to: 'running', action: 'provision_complete', description: 'Containers provisioned' },
    { from: 'starting', to: 'error', action: 'provision_failed', description: 'Provisioning failed' },
    
    // Active session transitions
    { from: 'running', to: 'paused', action: 'pause', description: 'User pauses session' },
    { from: 'running', to: 'stopping', action: 'stop', description: 'User terminates session' },
    { from: 'running', to: 'terminated', action: 'timeout', description: 'Session expired' },
    { from: 'running', to: 'error', action: 'runtime_error', description: 'Runtime error occurred' },
    
    // Paused session transitions
    { from: 'paused', to: 'running', action: 'resume', description: 'User resumes session' },
    { from: 'paused', to: 'terminated', action: 'timeout', description: 'Paused session expired' },
    { from: 'paused', to: 'stopping', action: 'stop', description: 'User terminates paused session' },
    
    // Cleanup transitions
    { from: 'stopping', to: 'terminated', action: 'stopped', description: 'Cleanup completed' },
    { from: 'error', to: 'terminated', action: 'cleanup', description: 'Error cleanup' },
  ];

  /**
   * Validate if a state transition is allowed
   * Throws BadRequestException if invalid transition
   * 
   * @param currentState - Current session state
   * @param newState - Desired new state
   * @param action - Action triggering the transition
   */
  validateTransition(currentState: SessionState, newState: SessionState, action: string): void {
    // Allow no-op transitions (same state)
    if (currentState === newState) {
      this.logger.debug(`No-op transition: ${currentState} → ${newState}`);
      return;
    }

    // Check if transition exists in valid transitions
    const transition = this.validTransitions.find(
      t => t.from === currentState && t.to === newState && t.action === action
    );

    if (!transition) {
      this.logger.error(
        `Invalid state transition attempted: ${currentState} → ${newState} (action: ${action})`
      );
      throw new BadRequestException(
        `Invalid session state transition: Cannot ${action} from ${currentState} to ${newState}`
      );
    }

    this.logger.log(`Valid transition: ${currentState} → ${newState} (${action}): ${transition.description}`);
  }

  /**
   * Get all allowed transitions from current state
   * Useful for API responses showing available actions
   * 
   * @param currentState - Current session state
   * @returns Array of allowed transitions
   */
  getAllowedTransitions(currentState: SessionState): { to: SessionState; action: string; description: string }[] {
    return this.validTransitions
      .filter(t => t.from === currentState)
      .map(t => ({ to: t.to, action: t.action, description: t.description }));
  }

  /**
   * Check if a specific action is allowed from current state
   * 
   * @param currentState - Current session state
   * @param action - Action to check
   * @returns true if action is allowed
   */
  isActionAllowed(currentState: SessionState, action: string): boolean {
    return this.validTransitions.some(
      t => t.from === currentState && t.action === action
    );
  }

  /**
   * Get recommended action based on current state
   * Useful for auto-recovery scenarios
   */
  getRecommendedAction(currentState: SessionState): string | null {
    switch (currentState) {
      case 'created':
        return 'start';
      case 'starting':
        return 'wait for provision_complete';
      case 'running':
        return 'continue or pause/stop';
      case 'paused':
        return 'resume or stop';
      case 'stopping':
        return 'wait for cleanup';
      case 'terminated':
      case 'error':
        return 'create new session';
      default:
        return null;
    }
  }
}
