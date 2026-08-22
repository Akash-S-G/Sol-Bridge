const db = require('./index');
const logger = require('../utils/logger');

// Define all migrations here (idempotent operations)
const migrations = [
  {
    id: '001-fix-host-capacity-constraint',
    description: 'Fix solar_capacity_kw constraint to allow 0 value',
    up: async (client) => {
      try {
        // Drop existing constraint if it exists
        await client.query(`
          ALTER TABLE hosts DROP CONSTRAINT IF EXISTS hosts_solar_capacity_kw_check
        `);
        
        // Add new constraint allowing >= 0
        await client.query(`
          ALTER TABLE hosts ADD CONSTRAINT hosts_solar_capacity_kw_check 
          CHECK (solar_capacity_kw >= 0)
        `);
        
        logger.info('✓ Migration 001: Fixed host solar_capacity_kw constraint');
        return true;
      } catch (error) {
        logger.warn(`Migration 001 already applied or skipped: ${error.message}`);
        return true; // Don't fail if already applied
      }
    }
  },
  {
    id: '002-fix-investor-capital-constraint',
    description: 'Fix total_capital constraint to allow 0 value',
    up: async (client) => {
      try {
        // Drop existing constraint if it exists
        await client.query(`
          ALTER TABLE investors DROP CONSTRAINT IF EXISTS investors_total_capital_check
        `);
        
        // Add new constraint allowing >= 0
        await client.query(`
          ALTER TABLE investors ADD CONSTRAINT investors_total_capital_check 
          CHECK (total_capital >= 0)
        `);
        
        logger.info('✓ Migration 002: Fixed investor total_capital constraint');
        return true;
      } catch (error) {
        logger.warn(`Migration 002 already applied or skipped: ${error.message}`);
        return true;
      }
    }
  },
  {
    id: '003-add-device-fields',
    description: 'Add device fields (device_name, capacity_kwh, efficiency_rating, metadata) to devices table',
    up: async (client) => {
      try {
        // Check if device_name already exists
        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'devices' AND column_name = 'device_name'
        `);

        if (columnCheck.rows.length === 0) {
          // Add missing columns
          await client.query(`
            ALTER TABLE devices
            ADD COLUMN IF NOT EXISTS device_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS capacity_kwh DECIMAL(10, 2),
            ADD COLUMN IF NOT EXISTS efficiency_rating DECIMAL(5, 2),
            ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
          `);

          logger.info('✓ Migration 003: Added device fields successfully');
        } else {
          logger.info('✓ Migration 003: Device fields already exist, skipping');
        }
        
        return true;
      } catch (error) {
        logger.warn(`Migration 003 error: ${error.message}`);
        // Don't fail if columns already exist
        if (error.message.includes('already exists')) {
          return true;
        }
        throw error;
      }
    }
  },
  {
    id: '004-create-buyer-energy-sources',
    description: 'Create buyer_energy_sources table for saving matched hosts',
    up: async (client) => {
      try {
        // Create table for buyer's saved energy sources (matched hosts)
        await client.query(`
          CREATE TABLE IF NOT EXISTS buyer_energy_sources (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            source_name VARCHAR(255),
            match_score DECIMAL(5, 2),
            price_per_kwh DECIMAL(6, 2),
            distance_km DECIMAL(10, 2),
            renewable_certified BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            subscription_type VARCHAR(20) DEFAULT 'on-demand' CHECK (subscription_type IN ('on-demand', 'monthly', 'yearly')),
            notes TEXT,
            matched_at TIMESTAMPTZ DEFAULT NOW(),
            last_purchase_at TIMESTAMPTZ,
            total_energy_purchased DECIMAL(12, 2) DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            CONSTRAINT unique_buyer_host_source UNIQUE (buyer_id, host_id)
          )
        `);

        await client.query('CREATE INDEX IF NOT EXISTS idx_buyer_sources_buyer ON buyer_energy_sources(buyer_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_buyer_sources_host ON buyer_energy_sources(host_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_buyer_sources_active ON buyer_energy_sources(buyer_id, is_active)');

        logger.info('✓ Migration 004: Created buyer_energy_sources table');
        return true;
      } catch (error) {
        logger.warn(`Migration 004 error: ${error.message}`);
        if (error.message.includes('already exists')) {
          return true;
        }
        throw error;
      }
    }
  },
  {
    id: '005-investment-system',
    description: 'Create investment system tables (host_spaces, investments, industries, contracts)',
    up: async (client) => {
      try {
        // Host Spaces Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS host_spaces (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('rooftop', 'ground', 'both')),
            available_area_sqft DECIMAL(10, 2) NOT NULL,
            total_capacity_kw DECIMAL(10, 2) NOT NULL,
            available_capacity_kw DECIMAL(10, 2) NOT NULL,
            address TEXT NOT NULL,
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL,
            pincode VARCHAR(10) NOT NULL,
            latitude DECIMAL(10, 7),
            longitude DECIMAL(10, 7),
            monthly_rent_per_kw DECIMAL(10, 2) NOT NULL,
            has_structural_certificate BOOLEAN DEFAULT false,
            structural_certificate_url TEXT,
            is_near_industry BOOLEAN DEFAULT false,
            distance_to_nearest_industry_km DECIMAL(10, 2),
            property_images JSONB DEFAULT '[]',
            status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'full', 'inactive')),
            property_rating DECIMAL(3, 2) DEFAULT 4.5,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await client.query('CREATE INDEX IF NOT EXISTS idx_host_spaces_host_id ON host_spaces(host_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_host_spaces_location ON host_spaces(city, state)');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_host_spaces_available ON host_spaces(available_capacity_kw) WHERE status = 'available'`);

        // Investments Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS investments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            host_space_id UUID NOT NULL REFERENCES host_spaces(id) ON DELETE CASCADE,
            panel_capacity_kw DECIMAL(10, 2) NOT NULL,
            investment_amount DECIMAL(12, 2) NOT NULL,
            monthly_production_kwh DECIMAL(10, 2) NOT NULL,
            net_monthly_profit DECIMAL(10, 2) NOT NULL,
            roi_percentage DECIMAL(5, 2) NOT NULL,
            total_earned_lifetime DECIMAL(12, 2) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'maintenance', 'inactive', 'completed')),
            installation_date TIMESTAMP,
            next_maintenance_date TIMESTAMP,
            razorpay_payment_id VARCHAR(255),
            razorpay_order_id VARCHAR(255),
            host_location_city VARCHAR(100),
            host_location_state VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await client.query('CREATE INDEX IF NOT EXISTS idx_investments_buyer_id ON investments(buyer_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_investments_host_id ON investments(host_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status)');

        // Industries Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS industries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            company_name VARCHAR(255) NOT NULL,
            industry_type VARCHAR(100) NOT NULL,
            daily_energy_demand_kwh DECIMAL(10, 2) NOT NULL,
            monthly_budget DECIMAL(12, 2),
            max_price_per_kwh DECIMAL(6, 2) NOT NULL,
            operational_hours_per_day INTEGER DEFAULT 24,
            peak_demand_hours VARCHAR(50) DEFAULT 'all-day',
            address TEXT NOT NULL,
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL,
            pincode VARCHAR(10) NOT NULL,
            contact_person VARCHAR(255) NOT NULL,
            contact_phone VARCHAR(15) NOT NULL,
            contact_email VARCHAR(255) NOT NULL,
            has_grid_backup BOOLEAN DEFAULT true,
            requires_24x7_supply BOOLEAN DEFAULT false,
            willing_to_sign_long_term_contract BOOLEAN DEFAULT false,
            contract_duration_preference_months INTEGER DEFAULT 12,
            status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await client.query('CREATE INDEX IF NOT EXISTS idx_industries_user_id ON industries(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_industries_location ON industries(city, state)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_industries_status ON industries(status)');

        // Industry Contracts Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS industry_contracts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
            industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
            price_per_kwh DECIMAL(6, 2) NOT NULL,
            contract_start_date TIMESTAMP NOT NULL,
            contract_end_date TIMESTAMP NOT NULL,
            status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(investment_id, industry_id)
          );
        `);

        await client.query('CREATE INDEX IF NOT EXISTS idx_industry_contracts_investment ON industry_contracts(investment_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_industry_contracts_industry ON industry_contracts(industry_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_industry_contracts_status ON industry_contracts(status)');

        // Industry Consumption Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS industry_consumption (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
            investment_id UUID REFERENCES investments(id) ON DELETE SET NULL,
            energy_consumed_kwh DECIMAL(10, 2) NOT NULL,
            amount_paid DECIMAL(12, 2) NOT NULL,
            price_per_kwh DECIMAL(6, 2) NOT NULL,
            carbon_offset_kg DECIMAL(10, 2) DEFAULT 0,
            consumption_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await client.query('CREATE INDEX IF NOT EXISTS idx_industry_consumption_industry ON industry_consumption(industry_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_industry_consumption_date ON industry_consumption(consumption_date)');

        // Pending Investments Table (for Razorpay order tracking)
        await client.query(`
          CREATE TABLE IF NOT EXISTS pending_investments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            razorpay_order_id VARCHAR(255) NOT NULL UNIQUE,
            razorpay_payment_id VARCHAR(255),
            buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            host_space_id UUID NOT NULL REFERENCES host_spaces(id) ON DELETE CASCADE,
            industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
            amount DECIMAL(12, 2) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        await client.query('CREATE INDEX IF NOT EXISTS idx_pending_investments_order ON pending_investments(razorpay_order_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_pending_investments_buyer ON pending_investments(buyer_id)');

        logger.info('✓ Migration 005: Created investment system tables');
        return true;
      } catch (error) {
        logger.warn(`Migration 005 error: ${error.message}`);
        if (error.message.includes('already exists')) {
          return true;
        }
        throw error;
      }
    }
  }
];

const runMigrations = async (client = null) => {
  const useProvidedClient = !!client;
  
  if (!useProvidedClient) {
    client = await db.pool.connect();
  }

  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(50) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    let appliedCount = 0;

    for (const migration of migrations) {
      try {
        // Check if migration already applied
        const result = await client.query(
          'SELECT id FROM schema_migrations WHERE id = $1',
          [migration.id]
        );

        if (result.rows.length === 0) {
          // Run migration
          await migration.up(client);

          // Record migration
          await client.query(
            'INSERT INTO schema_migrations (id) VALUES ($1)',
            [migration.id]
          );

          appliedCount++;
          logger.info(`Applied migration: ${migration.id} - ${migration.description}`);
        }
      } catch (error) {
        logger.warn(`Error running migration ${migration.id}: ${error.message}`);
        // Continue with next migration instead of failing
      }
    }

    if (appliedCount > 0) {
      logger.info(`✓ ${appliedCount} migration(s) applied successfully`);
    } else {
      logger.info('✓ All migrations already applied');
    }

    return true;
  } catch (error) {
    logger.error('Migration system error:', error);
    throw error;
  } finally {
    if (!useProvidedClient) {
      client.release();
    }
  }
};

module.exports = {
  migrations,
  runMigrations
};
