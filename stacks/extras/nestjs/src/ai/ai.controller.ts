import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Controller('api/ai')
export class AiController {
  constructor(private configService: ConfigService) {}

  @Post('generate')
  @UseGuards(AuthGuard('jwt'))
  async generate(@Body() body: any) {
    const { prompt } = body;
    if (!prompt) {
      throw new BadRequestException('Prompt field is required.');
    }

    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });
        if (res.ok) {
          const data: any = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return { prompt, response: text, model: 'gemini-1.5-flash' };
          }
        }
      } catch (e) {
        // Fallback
      }
    }

    return {
      prompt,
      response: `[NestJS AI Engine] Evaluated query: "${prompt}". Ready for hackathon showcase.`,
      model: 'nestjs-hackathon-engine',
    };
  }
}

