import { DynamicModule, Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose, { type Connection } from 'mongoose';
import type { Env } from '../config/env.schema';

// Filters may only reference fields defined in the schema.
mongoose.set('strictQuery', true);

const logger = new Logger('Database');

/** Logs host and database name only — never the URI, which contains credentials. */
function watchConnection(connection: Connection): Connection {
  logger.log(`MongoDB connected (host: ${connection.host}, database: ${connection.name})`);
  connection.on('disconnected', () => logger.warn('MongoDB disconnected; the driver will retry'));
  connection.on('reconnected', () => logger.log('MongoDB reconnected'));
  return connection;
}

@Module({})
export class DatabaseModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        MongooseModule.forRoot(env.MONGODB_URI, {
          dbName: env.MONGODB_DB_NAME,
          appName: 'sukoon-api',
          // Production indexes are built deliberately with `npm run db:indexes`, not on boot.
          autoIndex: env.NODE_ENV !== 'production',
          serverSelectionTimeoutMS: 10_000,
          retryAttempts: 3,
          retryDelay: 2_000,
          connectionFactory: watchConnection,
        }),
      ],
    };
  }
}
