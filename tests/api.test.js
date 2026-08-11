const request = require('supertest');

const BASE = 'https://hospital-backend-production-7d0f.up.railway.app';

test('Hospitals API returns data', async () => {
  const res = await request(BASE).get('/api/hospitals');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

test('AI Agents API returns agents', async () => {
  const res = await request(BASE).get('/api/ai/agents');
  expect(res.status).toBe(200);
  expect(res.body.agents.length).toBeGreaterThan(0);
});

test('Login works', async () => {
  const res = await request(BASE)
    .post('/api/auth/login')
    .send({ email: 'medweb@web.in', password: 'MedWeb@123' });
  expect(res.status).toBe(200);
  expect(res.body.token).toBeTruthy();
});
