const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const axios = require('axios');
const config = require('../config');
const { authenticate } = require('../middleware/auth');

const ML_SERVICE_URL = (config.mlService?.url || process.env.ML_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');

/**
 * Helper to call ML Service with timeout and fallback
 */
async function callMLService(path, method = 'POST', data = {}, params = {}) {
  const url = path === '/health' ? `${ML_SERVICE_URL}/health` : `${ML_SERVICE_URL}/api/v1${path}`;
  try {
    const response = await axios({
      method,
      url,
      data: method !== 'GET' ? data : undefined,
      params: method === 'GET' ? params : undefined,
      timeout: config.mlService?.timeout || 10000,
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (error) {
    logger.warn(`[ML Proxy] Call to ${url} failed (${error.message}). Using local fallback.`);
    return null;
  }
}

/**
 * Helper to generate solar bell curve fallback
 */
function generateSolarFallback(hours = 24, capacity = 5.0) {
  const predictions = [];
  const now = new Date();
  for (let i = 0; i < hours; i++) {
    const time = new Date(now.getTime() + i * 60 * 60 * 1000);
    const hour = time.getHours();
    const isDaylight = hour >= 6 && hour <= 18;
    const val = isDaylight ? Math.max(0, capacity * Math.sin(((hour - 6) * Math.PI) / 12)) : 0.0;
    predictions.append ? predictions.append : predictions.push({
      hour: time.toISOString(),
      predicted_kwh: Number(val.toFixed(2)),
      confidence_lower: Number(Math.max(0, val * 0.85).toFixed(2)),
      confidence_upper: Number((val * 1.15).toFixed(2)),
    });
  }
  return predictions;
}

/**
 * Helper to generate demand load curve fallback
 */
function generateDemandFallback(hours = 24) {
  const predictions = [];
  const now = new Date();
  for (let i = 0; i < hours; i++) {
    const time = new Date(now.getTime() + i * 60 * 60 * 1000);
    const hour = time.getHours();
    const baseLoad = 0.7;
    const morningPeak = 1.8 * Math.exp(-Math.pow(hour - 8, 2) / 4.0);
    const eveningPeak = 2.4 * Math.exp(-Math.pow(hour - 20, 2) / 6.0);
    const val = Number((baseLoad + morningPeak + eveningPeak).toFixed(2));
    predictions.push({
      hour: time.toISOString(),
      predicted_kwh: val,
    });
  }
  return predictions;
}

// ===== Routes =====

// GET & POST Solar Forecast
router.all(['/ai/forecast/solar', '/predict/solar-generation'], async (req, res) => {
  const hours = parseInt(req.query.hours || req.body?.forecast_hours || 24, 10);
  const capacity = parseFloat(req.query.panel_capacity_kw || req.body?.panel_capacity_kw || 5.0);
  const hostId = req.query.host_id || req.body?.host_id || req.user?.id || 'host-1';

  const bodyData = {
    host_id: hostId,
    panel_capacity_kw: capacity,
    historical_data: req.body?.historical_data || [],
    weather_forecast: req.body?.weather_forecast || [],
    forecast_hours: hours,
  };

  const result = await callMLService('/forecast/solar', 'POST', bodyData);

  if (result && (result.predictions || result.data)) {
    return res.json({
      success: true,
      data: result.predictions || result.data,
      model_version: result.model_version || '1.0.0',
    });
  }

  // Local fallback curve
  res.json({
    success: true,
    data: generateSolarFallback(hours, capacity),
    message: 'Generated using diurnal solar baseline model',
    mock: true,
  });
});

// GET & POST Demand Forecast
router.all(['/ai/forecast/demand', '/predict/consumption'], async (req, res) => {
  const hours = parseInt(req.query.hours || req.body?.forecast_hours || 24, 10);
  const userId = req.query.user_id || req.body?.user_id || req.user?.id || 'user-1';

  const bodyData = {
    user_id: userId,
    historical_data: req.body?.historical_data || [],
    weather_forecast: req.body?.weather_forecast || [],
    forecast_hours: hours,
  };

  const result = await callMLService('/forecast/demand', 'POST', bodyData);

  if (result && (result.predictions || result.data)) {
    return res.json({
      success: true,
      data: result.predictions || result.data,
      model_version: result.model_version || '1.0.0',
    });
  }

  res.json({
    success: true,
    data: generateDemandFallback(hours),
    message: 'Generated using diurnal demand load baseline model',
    mock: true,
  });
});

// GET & POST Anomaly Detection
router.all(['/ai/anomalies', '/predict/anomalies'], async (req, res) => {
  const deviceId = req.query.device_id || req.body?.device_id || 'SM_H123_001';
  const readings = req.body?.readings || [];

  const result = await callMLService('/anomaly/detect', 'POST', {
    device_id: deviceId,
    readings,
  });

  if (result) {
    return res.json({
      success: true,
      data: result,
    });
  }

  res.json({
    success: true,
    data: {
      device_id: deviceId,
      anomalies_detected: 0,
      severity: 'low',
      anomaly_types: [],
      recommended_action: 'Continue monitoring',
    },
    mock: true,
  });
});

// POST Dynamic Pricing Calculation
router.post(['/ai/pricing', '/predict/pricing'], async (req, res) => {
  const bodyData = {
    timestamp: req.body?.timestamp || new Date().toISOString(),
    total_supply_kwh: req.body?.total_supply_kwh || 100,
    total_demand_kwh: req.body?.total_demand_kwh || 80,
    time_of_day: req.body?.time_of_day || 'afternoon',
    grid_tariff: req.body?.grid_tariff || 7.5,
  };

  const result = await callMLService('/pricing/calculate', 'POST', bodyData);

  if (result) {
    return res.json({
      success: true,
      data: result,
    });
  }

  res.json({
    success: true,
    data: {
      recommended_price: 6.8,
      price_range: { min: 5.5, max: 8.5, recommended: 6.8 },
      supply_demand_ratio: 1.25,
      optimal_trading_hours: [9, 10, 11, 12, 13, 14, 15, 16],
    },
    mock: true,
  });
});

// GET ML Service Health
router.get(['/ai/health', '/predict/health'], async (req, res) => {
  const result = await callMLService('/health', 'GET');
  if (result) {
    return res.json({
      success: true,
      status: 'healthy',
      ml_service: result,
    });
  }
  res.json({
    success: false,
    status: 'unhealthy',
    message: 'ML service unreachable',
  });
});

module.exports = router;
