const prisma = require('../database/prisma');
const logger = require('../utils/logger');

class HostModel {
  /**
   * Find host profile by user_id
   */
  static async findByUserId(userId) {
    try {
      return await prisma.host.findUnique({
        where: { user_id: userId },
        include: {
          user: true,
        },
      });
    } catch (error) {
      logger.error(`Error finding host for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Upsert host profile details
   */
  static async upsert(userId, data) {
    try {
      return await prisma.host.upsert({
        where: { user_id: userId },
        update: {
          ...data,
          updated_at: new Date(),
        },
        create: {
          user_id: userId,
          solar_capacity_kw: data.solar_capacity_kw || 0,
          panel_brand: data.panel_brand,
          panel_model: data.panel_model,
          installation_date: data.installation_date,
          panel_efficiency: data.panel_efficiency,
          has_battery: data.has_battery || false,
          battery_capacity_kwh: data.battery_capacity_kwh,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          meter_id: data.meter_id,
          inverter_brand: data.inverter_brand,
          inverter_capacity_kw: data.inverter_capacity_kw,
          roof_type: data.roof_type,
          roof_orientation: data.roof_orientation,
          shading_factor: data.shading_factor,
        },
      });
    } catch (error) {
      logger.error(`Error upserting host for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = HostModel;
