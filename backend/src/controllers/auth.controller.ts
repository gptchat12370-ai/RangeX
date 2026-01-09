import { Body, Controller, Post, Get, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto, RefreshTokenDto, ChangePasswordDto } from '../dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Get CSRF token for client-side requests
   * Client should:
   * 1. Call this endpoint to get CSRF token in cookie
   * 2. Read token from cookie
   * 3. Send token in X-CSRF-Token header on POST/PUT/DELETE requests
   */
  @Get('csrf-token')
  getCsrfToken(@Res() res: Response) {
    const token = CsrfGuard.generateToken();
    res.cookie('csrf-token', token, {
      httpOnly: false, // Client needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour
    });
    return res.json({ csrfToken: token });
  }

  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    // Generate CSRF token on successful login
    const result = await this.authService.login(dto);
    const csrfToken = CsrfGuard.generateToken();
    
    res.cookie('csrf-token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour
    });
    
    return res.json({ ...result, csrfToken });
  }

  @UseGuards(CsrfGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @UseGuards(AuthGuard('jwt'), CsrfGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const userId = req.user?.userId || req.user?.sub;
    return this.authService.changePassword(userId, dto);
  }
}
