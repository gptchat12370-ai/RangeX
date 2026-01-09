import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { entities } from './src/entities';
config();

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: entities as unknown as any[],
  migrations: ['dist/src/migrations/*.js'],
  synchronize: false,
});
