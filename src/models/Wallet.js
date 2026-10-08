const prisma = require('../database/prisma');
const logger = require('../utils/logger');

class WalletModel {
  /**
   * Find wallet by user_id
   */
  static async findByUserId(userId) {
    try {
      return await prisma.wallet.findUnique({
        where: { user_id: userId },
      });
    } catch (error) {
      logger.error(`Error finding wallet for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Execute wallet credit transaction
   */
  static async credit(userId, amount, description, referenceId = null, referenceType = null) {
    try {
      return await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { user_id: userId },
        });

        const currentBalance = wallet ? Number(wallet.balance) : 0;
        const newBalance = currentBalance + Number(amount);

        const updatedWallet = await tx.wallet.upsert({
          where: { user_id: userId },
          update: {
            balance: newBalance,
            last_transaction_at: new Date(),
            updated_at: new Date(),
          },
          create: {
            user_id: userId,
            balance: newBalance,
            currency: 'INR',
          },
        });

        const txn = await tx.walletTransaction.create({
          data: {
            user_id: userId,
            transaction_type: 'credit',
            amount: Number(amount),
            balance_before: currentBalance,
            balance_after: newBalance,
            description,
            reference_id: referenceId,
            reference_type: referenceType,
            status: 'completed',
          },
        });

        return { wallet: updatedWallet, transaction: txn };
      });
    } catch (error) {
      logger.error(`Error crediting wallet for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Execute wallet debit transaction
   */
  static async debit(userId, amount, description, referenceId = null, referenceType = null) {
    try {
      return await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { user_id: userId },
        });

        const currentBalance = wallet ? Number(wallet.balance) : 0;
        if (currentBalance < Number(amount)) {
          throw new Error('Insufficient wallet balance');
        }

        const newBalance = currentBalance - Number(amount);

        const updatedWallet = await tx.wallet.update({
          where: { user_id: userId },
          data: {
            balance: newBalance,
            last_transaction_at: new Date(),
            updated_at: new Date(),
          },
        });

        const txn = await tx.walletTransaction.create({
          data: {
            user_id: userId,
            transaction_type: 'debit',
            amount: Number(amount),
            balance_before: currentBalance,
            balance_after: newBalance,
            description,
            reference_id: referenceId,
            reference_type: referenceType,
            status: 'completed',
          },
        });

        return { wallet: updatedWallet, transaction: txn };
      });
    } catch (error) {
      logger.error(`Error debiting wallet for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = WalletModel;
