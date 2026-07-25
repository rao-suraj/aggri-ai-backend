import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../config/configuration';
import {
  ClusterArticle,
  DailyRanking,
  PipelineRun,
  RawArticle,
  Source,
  StoryCluster,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const db = configService.get('db', { infer: true });
        return {
          type: 'mssql',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          synchronize: db.synchronize,
          logging: db.logging,
          entities: [
            Source,
            RawArticle,
            StoryCluster,
            ClusterArticle,
            DailyRanking,
            PipelineRun,
          ],
          options: {
            encrypt: db.encrypt,
            trustServerCertificate: db.trustServerCertificate,
          },
        };
      },
    }),
  ],
})
export class AppDatabaseModule {}
