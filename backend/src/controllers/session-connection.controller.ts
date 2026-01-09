import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SessionOwnershipGuard } from '../guards/session-ownership.guard';
import { SessionConnectionService } from '../services/session-connection.service';

@Controller('solver/sessions')
@UseGuards(JwtAuthGuard)
export class SessionConnectionController {
  constructor(
    private readonly sessionConnectionService: SessionConnectionService,
  ) {}

  /**
   * Get connection details for all machines in a session
   * GET /solver/sessions/:sessionId/connection
   */
  @Get(':sessionId/connection')
  @UseGuards(SessionOwnershipGuard)
  async getSessionConnection(@Param('sessionId') sessionId: string) {
    return this.sessionConnectionService.getSessionConnectionDetails(sessionId);
  }

  /**
   * Get connection details for a specific machine
   * GET /solver/sessions/:sessionId/machines/:machineId/connection
   */
  @Get(':sessionId/machines/:machineId/connection')
  @UseGuards(SessionOwnershipGuard)
  async getMachineConnection(
    @Param('sessionId') sessionId: string,
    @Param('machineId') machineId: string,
  ) {
    return this.sessionConnectionService.getMachineConnectionDetails(
      sessionId,
      machineId,
    );
  }
}
