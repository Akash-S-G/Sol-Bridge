-- SolBridge Performance & Spatial Indexes Migration

-- 1. Energy Readings Composite Index for IoT History Queries
CREATE INDEX IF NOT EXISTS idx_energy_readings_device_timestamp 
ON energy_readings (device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_energy_readings_user_timestamp 
ON energy_readings (user_id, timestamp DESC);

-- 2. Geospatial Indexes for User Addresses & Nearby Host Discovery
CREATE INDEX IF NOT EXISTS idx_user_addresses_coords 
ON user_addresses (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_user_addresses_city_state 
ON user_addresses (city, state);

-- 3. Devices Index
CREATE INDEX IF NOT EXISTS idx_devices_host_status 
ON devices (host_id, status);

CREATE INDEX IF NOT EXISTS idx_devices_user_id 
ON devices (user_id);

-- 4. Transactions Index
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_created 
ON transactions (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_seller_created 
ON transactions (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_status 
ON transactions (status);

-- 5. Wallet Index
CREATE INDEX IF NOT EXISTS idx_wallets_user_id 
ON wallets (user_id);
