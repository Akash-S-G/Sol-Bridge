const prisma = require('../database/prisma');
const logger = require('../utils/logger');

class EnergyListingModel {
  /**
   * Find listing by ID
   */
  static async findById(id) {
    try {
      return await prisma.energyListing.findUnique({
        where: { id },
        include: {
          seller: true,
          device: true,
        },
      });
    } catch (error) {
      logger.error(`Error finding energy listing ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find active energy listings with pagination
   */
  static async findActiveListings({ limit = 20, offset = 0, minPrice, maxPrice }) {
    try {
      const where = {
        status: 'active',
        available_to: { gt: new Date() },
      };

      if (minPrice || maxPrice) {
        where.price_per_kwh = {};
        if (minPrice) where.price_per_kwh.gte = Number(minPrice);
        if (maxPrice) where.price_per_kwh.lte = Number(maxPrice);
      }

      const [listings, total] = await Promise.all([
        prisma.energyListing.findMany({
          where,
          take: Number(limit),
          skip: Number(offset),
          orderBy: { created_at: 'desc' },
          include: {
            seller: {
              select: {
                id: true,
                full_name: true,
                is_verified: true,
              },
            },
          },
        }),
        prisma.energyListing.count({ where }),
      ]);

      return { listings, total };
    } catch (error) {
      logger.error('Error finding active energy listings:', error);
      throw error;
    }
  }

  /**
   * Create a new energy listing
   */
  static async create(data) {
    try {
      return await prisma.energyListing.create({
        data: {
          seller_id: data.seller_id,
          device_id: data.device_id,
          energy_amount_kwh: data.energy_amount_kwh,
          price_per_kwh: data.price_per_kwh,
          available_from: new Date(data.available_from),
          available_to: new Date(data.available_to),
          listing_type: data.listing_type || 'spot',
          status: 'active',
          min_purchase_kwh: data.min_purchase_kwh || 1.0,
          location_latitude: data.location_latitude,
          location_longitude: data.location_longitude,
          description: data.description,
        },
      });
    } catch (error) {
      logger.error('Error creating energy listing:', error);
      throw error;
    }
  }

  /**
   * Update listing status
   */
  static async updateStatus(id, status) {
    try {
      return await prisma.energyListing.update({
        where: { id },
        data: {
          status,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Error updating listing status ${id}:`, error);
      throw error;
    }
  }
}

module.exports = EnergyListingModel;
