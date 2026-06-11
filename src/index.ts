import { app } from './app'
import { config } from './config'
import { prisma } from './lib/prisma'
import { connectRedis } from './lib/redis'
import { startMediaWorker } from './modules/media/media.worker'

async function main() {
  await prisma.$connect()
  await connectRedis()
  startMediaWorker()

  app.listen(config.PORT, () => {
    console.log(`API running on http://localhost:${config.PORT}/api`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
