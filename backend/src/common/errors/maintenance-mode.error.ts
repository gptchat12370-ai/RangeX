export class MaintenanceModeError extends Error {
  readonly code = 'MAINTENANCE_MODE';
  constructor(message = 'Platform is in maintenance mode') {
    super(message);
    this.name = 'MaintenanceModeError';
  }
}
