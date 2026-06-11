import path from 'path'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: path.resolve(__dirname, '../.env') })

process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/goodjob'
process.env.JWT_SECRET ??= 'test-jwt-secret'
