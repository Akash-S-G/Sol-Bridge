const request = require('supertest');
const { redis, redisAvailable, cacheSet, cacheGet, cacheDel, cacheClear } = require('../src/utils/cache');
const WalletService = require('../src/services/WalletService');
const marketplaceService = require('../src/services/MarketplaceService');

describe('SolBridge Redis Integration & Cache Suite', () => {
  beforeAll(async () => {
    // Ensure redis connection is ready
    for (let i = 0; i < 20; i++) {
      if (redisAvailable()) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  afterAll(async () => {
    if (redis && redis.status === 'ready') {
      await redis.quit();
    }
  });

  test('Redis Service should be connected and reporting available', () => {
    expect(redisAvailable()).toBe(true);
    expect(redis).not.toBeNull();
  });

  test('Redis Cache Set, Get, Delete, Clear helper operations', async () => {
    const key = 'test:suite:key';
    const val = { message: 'Redis cache works!', timestamp: Date.now() };

    // Set
    await cacheSet(key, val, 60);

    // Get
    const fetched = await cacheGet(key);
    expect(fetched).not.toBeNull();
    expect(fetched.message).toBe('Redis cache works!');

    // Delete
    await cacheDel(key);
    const deleted = await cacheGet(key);
    expect(deleted).toBeNull();

    // Pattern Clear
    await cacheSet('test:pattern:1', { a: 1 }, 60);
    await cacheSet('test:pattern:2', { b: 2 }, 60);
    await cacheClear('test:pattern:*');
    expect(await cacheGet('test:pattern:1')).toBeNull();
    expect(await cacheGet('test:pattern:2')).toBeNull();
  });

  test('Marketplace Caching & Invalidation Flow', async () => {
    const mockFilters = { limit: 10, offset: 0 };
    const cacheKey = `marketplace:listings:${JSON.stringify(mockFilters)}`;

    // Set mock listings in Redis cache
    const mockListings = [
      { id: 'lst-1', energy_amount_kwh: 50, price_per_kwh: 4.5, seller_name: 'Solar Host Alpha' }
    ];
    await cacheSet(cacheKey, mockListings, 30);

    // Fetch listings (should return from Redis cache)
    const result = await marketplaceService.getListings(mockFilters);
    expect(result).toHaveLength(1);
    expect(result[0].seller_name).toBe('Solar Host Alpha');

    // Invalidate cache
    await cacheClear('marketplace:listings*');
    const cachedAfterClear = await cacheGet(cacheKey);
    expect(cachedAfterClear).toBeNull();
  });

  test('Wallet Balance Caching & Deletion Flow', async () => {
    const userId = 'usr-test-redis-wallet';
    const cacheKey = `wallet:balance:${userId}`;

    // Store cached balance
    await cacheSet(cacheKey, { balance: 1500.00 }, 60);

    // Get balance (cache hit)
    const cachedBalance = await cacheGet(cacheKey);
    expect(cachedBalance.balance).toBe(1500.00);

    // Delete balance cache
    await cacheDel(cacheKey);
    expect(await cacheGet(cacheKey)).toBeNull();
  });

  test('IoT Hot-Path Telemetry Caching Flow', async () => {
    const deviceId = 'DEV_SOLAR_TEST_001';
    const cacheKey = `iot:latest:${deviceId}`;
    const telemetryData = {
      device_id: deviceId,
      power_kw: 4.85,
      voltage: 230.4,
      current: 21.05,
      time: new Date().toISOString()
    };

    // Cache telemetry
    await cacheSet(cacheKey, telemetryData, 3600);

    // Retrieve cached telemetry
    const cachedTelemetry = await cacheGet(cacheKey);
    expect(cachedTelemetry).not.toBeNull();
    expect(cachedTelemetry.power_kw).toBe(4.85);
    expect(cachedTelemetry.voltage).toBe(230.4);

    // Clean up
    await cacheDel(cacheKey);
  });
});
