const prisma = require('../database/prisma');
const logger = require('../utils/logger');

class BuyerModel {
  /**
   * Find buyer profile by user_id
   */
  static async findByUserId(userId) {
    try {
      return await prisma.buyer.findUnique({
        where: { user_id: userId },
        include: {
          user: true,
        },
      });
    } catch (error) {
      logger.error(`Error finding buyer for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Upsert buyer profile details
   */
  static async upsert(userId, data) {
    try {
      return await prisma.buyer.upsert({
        where: { user_id: userId },
        update: {
          ...data,
          updated_at: new Date(),
        },
        create: {
          user_id: userId,
          meter_id: data.meter_id,
          monthly_avg_consumption: data.monthly_avg_consumption,
          household_size: data.household_size,
          has_ac: data.has_ac || false,
          ac_tonnage: data.ac_tonnage,
          has_ev: data.has_ev || false,
          ev_battery_kwh: data.ev_battery_kwh,
          house_type: data.house_type,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          preferences: data.preferences,
        },
      });
    } catch (error) {
      logger.error(`Error upserting buyer for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = BuyerModel;
