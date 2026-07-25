import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { GroqService } from './groq.service';

@Module({
  imports: [HttpModule.register({ timeout: 15000, maxRedirects: 3 })],
  providers: [GeminiService, GroqService],
  exports: [GeminiService, GroqService],
})
export class AiModule {}
