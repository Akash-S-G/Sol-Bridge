const prisma = require('../database/prisma');
const logger = require('../utils/logger');

class UserModel {
  /**
   * Find user by ID with optional inclusion of profile relations (host, buyer, investor, wallet)
   */
  static async findById(id, includeProfiles = false) {
    try {
      return await prisma.user.findUnique({
        where: { id },
        include: includeProfiles
          ? {
              host: true,
              buyer: true,
              investor: true,
              wallet: true,
              user_preferences: true,
            }
          : undefined,
      });
    } catch (error) {
      logger.error(`Error finding user by id ${id}:`, error);
      throw error;
    }
  }

  /**
   * Find user by Email
   */
  static async findByEmail(email) {
    try {
      return await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
    } catch (error) {
      logger.error(`Error finding user by email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Create a new user with automatic wallet initialization
   */
  static async create(data) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: data.email.toLowerCase(),
            password_hash: data.password_hash,
            role: data.role,
            full_name: data.full_name,
            phone: data.phone,
            is_verified: data.is_verified || false,
            kyc_status: data.kyc_status || 'pending',
          },
        });

        // Initialize wallet for new user
        await tx.wallet.create({
          data: {
            user_id: user.id,
            balance: 0.0,
            currency: 'INR',
          },
        });

        return user;
      });
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user details
   */
  static async update(id, updateData) {
    try {
      return await prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Error updating user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  static async delete(id) {
    try {
      return await prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      logger.error(`Error deleting user ${id}:`, error);
      throw error;
    }
  }
}

module.exports = UserModel;
