import request from 'supertest'
import { app } from '@/app'

const hasDb = Boolean(process.env.DATABASE_URL)
const describeIntegration = hasDb ? describe : describe.skip

describeIntegration('GET /api/rewards', () => {
  it('returns 401 without cookie', async () => {
    const res = await request(app).get('/api/rewards')
    expect(res.status).toBe(401)
  })
})
