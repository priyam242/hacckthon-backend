import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  ConflictException,
  UnauthorizedException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';

// In-memory store for instant zero-dependency hackathon speed
const users = new Map<string, any>();

@Controller('api/auth')
export class AuthController {
  constructor(private jwtService: JwtService) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() body: any) {
    const { email, username, password } = body;
    if (!email || !username || !password) {
      throw new ConflictException('Email, username, and password are required.');
    }

    for (const u of users.values()) {
      if (u.email === email || u.username === username) {
        throw new ConflictException('User with this email or username already exists.');
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'usr_' + Math.random().toString(36).substring(2, 10);
    const user = { id: userId, email, username, password: hashedPassword, createdAt: new Date() };
    users.set(userId, user);

    return { id: user.id, email: user.email, username: user.username };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any) {
    const { usernameOrEmail, password } = body;
    let found = null;
    for (const u of users.values()) {
      if (u.email === usernameOrEmail || u.username === usernameOrEmail) {
        found = u;
        break;
      }
    }

    if (!found || !(await bcrypt.compare(password, found.password))) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const payload = { sub: found.id, username: found.username };
    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      token_type: 'bearer',
      user: { id: found.id, email: found.email, username: found.username },
    };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req: any) {
    const user = users.get(req.user.sub);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    return { id: user.id, email: user.email, username: user.username };
  }
}

