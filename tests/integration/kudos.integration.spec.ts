import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '@/app'
import { prisma } from '@/lib/prisma'
import { connectRedis } from '@/lib/redis'

const hasDb = Boolean(process.env.DATABASE_URL)
const describeIntegration = hasDb ? describe : describe.skip

describeIntegration('Kudos API (integration)', () => {
  let cookieHeader: string
  let userA: { id: string }
  let userB: { id: string }
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  beforeAll(async () => {
    await connectRedis().catch(() => undefined)
    const hash = await bcrypt.hash('password123', 10)
    userA = await prisma.user.create({
      data: {
        email: `kudos-it-a-${suffix}@test.com`,
        name: 'Test A',
        password: hash,
        balance: 0,
      },
    })
    userB = await prisma.user.create({
      data: {
        email: `kudos-it-b-${suffix}@test.com`,
        name: 'Test B',
        password: hash,
        balance: 0,
      },
    })

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `kudos-it-a-${suffix}@test.com`, password: 'password123' })

    expect(res.status).toBe(200)
    const raw = res.headers['set-cookie']
    cookieHeader = Array.isArray(raw) ? raw.join('; ') : String(raw ?? '')
  })

  afterAll(async () => {
    const ids = [userA.id, userB.id]
    await prisma.pointLedger.deleteMany({ where: { userId: { in: ids } } })
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } })
    await prisma.kudo.deleteMany({
      where: {
        OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }],
      },
    })
    await prisma.givingBudget.deleteMany({ where: { userId: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  })

  it('GET /api/kudos — returns 401 without cookie', async () => {
    const res = await request(app).get('/api/kudos')
    expect(res.status).toBe(401)
  })

  it('POST /api/kudos — creates kudo and updates receiver balance', async () => {
    const res = await request(app)
      .post('/api/kudos')
      .set('Cookie', cookieHeader)
      .send({
        receiverId: userB.id,
        points: 30,
        message: 'Integration test message here!',
        coreValue: 'teamwork',
      })

    expect(res.status).toBe(201)
    expect(res.body.data.points).toBe(30)

    const updated = await prisma.user.findUnique({ where: { id: userB.id } })
    expect(updated?.balance).toBe(30)
  })

  it('POST /api/kudos — rejects self-send', async () => {
    const res = await request(app)
      .post('/api/kudos')
      .set('Cookie', cookieHeader)
      .send({
        receiverId: userA.id,
        points: 20,
        message: 'Trying to self-send here ok',
        coreValue: 'ownership',
      })
    expect(res.status).toBe(400)
  })

  it('GET /api/kudos — returns paginated feed', async () => {
    const res = await request(app).get('/api/kudos').set('Cookie', cookieHeader)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.data)).toBe(true)
  })
})
