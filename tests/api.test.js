const request = require('supertest');
const app = require('../src/server');

describe('SolBridge Backend API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return health status with HTTP 200', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'healthy');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('services');
    });
  });

  describe('404 Not Found Handler', () => {
    it('should return 404 for unknown endpoints', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route-path');
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'NotFoundError');
    });
  });

  describe('Auth Routes Validation', () => {
    it('should fail registration if email is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          password: 'Password123!',
          role: 'buyer',
        });
      expect([400, 422]).toContain(res.statusCode);
    });

    it('should fail login with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid_nonexistent_user@example.com',
          password: 'WrongPassword123!',
        });
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Matching Routes Authorization', () => {
    it('should reject unauthenticated access to /api/v1/matching/find-sellers', async () => {
      const res = await request(app)
        .post('/api/v1/matching/find-sellers')
        .send({
          requiredKwh: 50,
          maxPrice: 8.5,
        });
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('Report Download Security', () => {
    it('should prevent path traversal attempts in report downloads', async () => {
      const res = await request(app)
        .get('/api/v1/reports/download/../../etc/passwd')
        .set('Authorization', 'Bearer fake_token_string');
      // Should reject authentication or access denied
      expect([401, 403, 404]).toContain(res.statusCode);
    });
  });
});
