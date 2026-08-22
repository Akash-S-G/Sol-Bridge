/**
 * SolBridge WebSocket Service (Socket.IO)
 * Real-time bidirectional communication for IoT telemetry, marketplace updates, and user alerts
 */

const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/auth');
const logger = require('../utils/logger');
const { corsOptions } = require('../middleware/auth');

class WebSocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> Set of socketIds
  }

  /**
   * Initialize Socket.IO with HTTP Server
   */
  init(server) {
    this.io = new Server(server, {
      cors: corsOptions,
      pingTimeout: 30000,
      pingInterval: 25000,
      path: '/socket.io',
    });

    // Authentication middleware for WebSockets
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (token) {
          const payload = verifyAccessToken(token);
          socket.user = payload;
        } else {
          socket.user = { id: 'anonymous', role: 'guest' };
        }
        next();
      } catch (err) {
        logger.warn('[WebSocket] Auth error:', err.message);
        socket.user = { id: 'anonymous', role: 'guest' };
        next(); // Allow connection with guest status
      }
    });

    // Connection Handler
    this.io.on('connection', (socket) => {
      const userId = socket.user?.id || 'anonymous';
      logger.info(`[WebSocket] Client connected: ${socket.id} (User: ${userId})`);

      // Track user sockets
      if (userId !== 'anonymous') {
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);
        socket.join(`user:${userId}`);
      }

      // Join default global marketplace room
      socket.join('marketplace');

      // Room subscriptions
      socket.on('subscribe:device', (deviceId) => {
        if (deviceId) {
          socket.join(`device:${deviceId}`);
          logger.info(`[WebSocket] ${socket.id} subscribed to device:${deviceId}`);
        }
      });

      socket.on('unsubscribe:device', (deviceId) => {
        if (deviceId) {
          socket.leave(`device:${deviceId}`);
          logger.info(`[WebSocket] ${socket.id} unsubscribed from device:${deviceId}`);
        }
      });

      socket.on('subscribe:host', (hostId) => {
        if (hostId) {
          socket.join(`host:${hostId}`);
          logger.info(`[WebSocket] ${socket.id} subscribed to host:${hostId}`);
        }
      });

      // Disconnect handler
      socket.on('disconnect', (reason) => {
        logger.info(`[WebSocket] Client disconnected: ${socket.id} (${reason})`);
        if (userId !== 'anonymous' && this.userSockets.has(userId)) {
          this.userSockets.get(userId).delete(socket.id);
          if (this.userSockets.get(userId).size === 0) {
            this.userSockets.delete(userId);
          }
        }
      });
    });

    logger.info('✓ Socket.IO WebSocket Service initialized');
    return this.io;
  }

  /**
   * Broadcast live IoT sensor telemetry
   */
  emitIoTReading(deviceId, data, hostId = null) {
    if (!this.io) return;
    const payload = { deviceId, data, timestamp: new Date().toISOString() };
    this.io.to(`device:${deviceId}`).emit('iot:reading', payload);
    if (hostId) {
      this.io.to(`host:${hostId}`).emit('iot:reading', payload);
    }
  }

  /**
   * Broadcast device status update
   */
  emitDeviceStatus(deviceId, status, details = {}) {
    if (!this.io) return;
    this.io.to(`device:${deviceId}`).emit('device:status', { deviceId, status, details, timestamp: new Date().toISOString() });
  }

  /**
   * Send notification to specific user
   */
  emitToUser(userId, event, data) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, { ...data, timestamp: new Date().toISOString() });
  }

  /**
   * Broadcast marketplace listing update
   */
  emitMarketplaceUpdate(data) {
    if (!this.io) return;
    this.io.to('marketplace').emit('marketplace:update', { ...data, timestamp: new Date().toISOString() });
  }
}

const webSocketService = new WebSocketService();
module.exports = webSocketService;
