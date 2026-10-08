const prisma = require('../database/prisma');
const logger = require('../utils/logger');

class DeviceModel {
  /**
   * Find device by device_id
   */
  static async findById(deviceId) {
    try {
      return await prisma.device.findUnique({
        where: { device_id: deviceId },
        include: {
          user: true,
        },
      });
    } catch (error) {
      logger.error(`Error finding device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get all devices for a user
   */
  static async findByUserId(userId) {
    try {
      return await prisma.device.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
      });
    } catch (error) {
      logger.error(`Error finding devices for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Register or update a device
   */
  static async upsertDevice(data) {
    try {
      return await prisma.device.upsert({
        where: { device_id: data.device_id },
        update: {
          ...data,
          updated_at: new Date(),
        },
        create: {
          device_id: data.device_id,
          user_id: data.user_id,
          device_name: data.device_name || data.device_id,
          device_type: data.device_type,
          capacity_kwh: data.capacity_kwh,
          efficiency_rating: data.efficiency_rating,
          device_model: data.device_model,
          firmware_version: data.firmware_version,
          mqtt_username: data.mqtt_username,
          mqtt_password_hash: data.mqtt_password_hash,
          latitude: data.latitude,
          longitude: data.longitude,
          status: data.status || 'active',
        },
      });
    } catch (error) {
      logger.error(`Error upserting device ${data.device_id}:`, error);
      throw error;
    }
  }

  /**
   * Update device status
   */
  static async updateStatus(deviceId, status, lastSeenAt = new Date()) {
    try {
      return await prisma.device.update({
        where: { device_id: deviceId },
        data: {
          status,
          last_seen_at: lastSeenAt,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Error updating device status for ${deviceId}:`, error);
      throw error;
    }
  }
}

module.exports = DeviceModel;
