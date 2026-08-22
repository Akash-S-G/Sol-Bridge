const transactionService = require('../services/TransactionService');
const paymentService = require('../services/PaymentService');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errors');

// Get wallet balance
const getWalletBalance = asyncHandler(async (req, res) => {
  const walletData = await transactionService.getWalletBalance(req.user.id);
  
  res.json({
    success: true,
    data: {
      wallet: {
        balance: walletData?.balance || 0,
        currency: 'INR',
        lastUpdated: walletData?.updated_at || new Date().toISOString(),
      },
      pendingTransactions: walletData?.pending_count || 0,
      recentActivity: walletData?.recent_transactions || [],
    },
  });
});

// Get transaction history
const getTransactionHistory = asyncHandler(async (req, res) => {
  const { limit = 20, page = 1, type, status, startDate, endDate } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  const transactions = await transactionService.getTransactionHistory(
    req.user.id,
    parseInt(limit),
    offset
  );

  const total = await transactionService.getTransactionHistoryCount(req.user.id);

  res.json({
    success: true,
    data: {
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)) || 1,
      },
    },
  });
});

// Top-up wallet (initiate payment)
const topupWallet = asyncHandler(async (req, res) => {
  const { amount, paymentMethod } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Valid amount required',
    });
  }

  // TODO: Call payment gateway (Razorpay)
  // For now, return payment initiation response
  res.json({
    status: 'payment_initiated',
    amount,
    paymentMethod,
    message: 'Redirect to payment gateway',
    // paymentUrl would come from Razorpay integration
  });
});

// Process payment callback (from payment gateway)
const processPaymentCallback = asyncHandler(async (req, res) => {
  const { userId, amount, paymentMethod, paymentGatewayTxnId } = req.body;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Never trust a client-supplied 'status'. Success must be proven via the Razorpay signature.
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      error: 'PaymentVerificationError',
      message: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required',
    });
  }

  const isValid = paymentService.verifyPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isValid) {
    logger.warn({ action: 'payment_signature_failed', userId, orderId: razorpay_order_id });
    return res.status(400).json({
      error: 'PaymentVerificationError',
      message: 'Payment signature verification failed',
    });
  }

  const result = await transactionService.processWalletTopup(
    userId,
    amount,
    paymentMethod,
    paymentGatewayTxnId || razorpay_payment_id
  );

  res.json({
    status: 'success',
    message: 'Wallet topped up successfully',
    wallet: result,
  });
});

// Request withdrawal
const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankAccount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Valid amount required',
    });
  }

  if (!bankAccount) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Bank account required',
    });
  }

  const result = await transactionService.processWithdrawal(
    req.user.id,
    amount,
    bankAccount
  );

  res.json({
    status: 'withdrawal_initiated',
    message: 'Withdrawal request submitted',
    withdrawal: result,
  });
});

// Get platform metrics (admin only)
const getPlatformMetrics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'startDate and endDate required',
    });
  }

  const metrics = await transactionService.getPlatformMetrics(
    new Date(startDate),
    new Date(endDate)
  );

  res.json(metrics);
});

module.exports = {
  getWalletBalance,
  getTransactionHistory,
  topupWallet,
  processPaymentCallback,
  requestWithdrawal,
  getPlatformMetrics,
};
