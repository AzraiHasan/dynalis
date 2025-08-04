#!/usr/bin/env node

/**
 * Data Migration Script: SQLite to Supabase
 * 
 * This script exports data from the existing SQLite database
 * and imports it into Supabase PostgreSQL database.
 * 
 * Prerequisites:
 * 1. Set up your Supabase project
 * 2. Run the supabase-schema.sql script in your Supabase SQL editor
 * 3. Update .env with your Supabase credentials
 * 4. Install: npm install @supabase/supabase-js better-sqlite3
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize SQLite database
const sqliteDb = new Database('.data/dynalis.sqlite3', { readonly: true });

console.log('🚀 Starting data migration from SQLite to Supabase...');

async function migrateUsers() {
  console.log('📊 Migrating users...');
  
  try {
    // Get users from SQLite
    const users = sqliteDb.prepare('SELECT * FROM users').all();
    console.log(`Found ${users.length} users to migrate`);
    
    if (users.length === 0) {
      console.log('No users found in SQLite database');
      return;
    }

    // Note: We cannot directly create auth.users entries via the client
    // Users will need to register again through Supabase Auth
    console.log('⚠️  IMPORTANT: Users will need to re-register with Supabase Auth');
    console.log('   The following users were found in the old system:');
    
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.name || 'No name'})`);
    });
    
    console.log('✅ User migration analysis complete');
    return users;
  } catch (error) {
    console.error('❌ Error migrating users:', error);
    throw error;
  }
}

async function migrateSites(userMapping = {}) {
  console.log('📊 Migrating sites...');
  
  try {
    // Get sites from SQLite
    const sites = sqliteDb.prepare('SELECT * FROM sites').all();
    console.log(`Found ${sites.length} sites to migrate`);
    
    if (sites.length === 0) {
      console.log('No sites found in SQLite database');
      return;
    }

    // Transform and insert sites into Supabase
    const sitesToInsert = sites.map(site => ({
      id: site.id,
      site_id: site.site_id,
      exp_date: site.exp_date,
      total_rental: parseFloat(site.total_rental) || 0,
      total_payment_to_pay: parseFloat(site.total_payment_to_pay) || 0,
      deposit: parseFloat(site.deposit) || 0,
      created_at: site.created_at,
      updated_at: site.updated_at,
      created_by: null // Will be updated when users re-register
    }));

    // Insert sites in batches of 100
    const batchSize = 100;
    for (let i = 0; i < sitesToInsert.length; i += batchSize) {
      const batch = sitesToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('sites')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Error inserting sites batch ${Math.floor(i/batchSize) + 1}:`, error);
        throw error;
      }
      
      console.log(`✅ Inserted sites batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(sitesToInsert.length/batchSize)}`);
    }

    console.log(`✅ Successfully migrated ${sites.length} sites`);
  } catch (error) {
    console.error('❌ Error migrating sites:', error);
    throw error;
  }
}

async function migrateJobs() {
  console.log('📊 Checking for upload jobs...');
  
  try {
    // Check if upload_jobs table exists
    const tableInfo = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='upload_jobs'").get();
    
    if (!tableInfo) {
      console.log('No upload_jobs table found - skipping job migration');
      return;
    }

    const jobs = sqliteDb.prepare('SELECT * FROM upload_jobs').all();
    console.log(`Found ${jobs.length} jobs to migrate`);
    
    if (jobs.length === 0) {
      console.log('No jobs found in database');
      return;
    }

    // Transform and insert jobs
    const jobsToInsert = jobs.map(job => ({
      id: job.id,
      filename: job.filename,
      status: job.status,
      total_chunks: job.total_chunks,
      chunks_received: job.chunks_received || 0,
      processed_records: job.processed_records || 0,
      error_message: job.error_message,
      created_at: job.created_at,
      updated_at: job.updated_at,
      completed_at: job.completed_at,
      created_by: null // Will be updated when users re-register
    }));

    const { error } = await supabase
      .from('upload_jobs')
      .insert(jobsToInsert);
    
    if (error) {
      console.error('❌ Error inserting jobs:', error);
      throw error;
    }

    console.log(`✅ Successfully migrated ${jobs.length} jobs`);
  } catch (error) {
    console.error('❌ Error migrating jobs:', error);
    throw error;
  }
}

async function migrateSystemFields() {
  console.log('📊 Checking for system fields...');
  
  try {
    // Check if system_fields table exists
    const tableInfo = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_fields'").get();
    
    if (!tableInfo) {
      console.log('No system_fields table found - skipping system fields migration');
      return;
    }

    const fields = sqliteDb.prepare('SELECT * FROM system_fields').all();
    console.log(`Found ${fields.length} system fields to migrate`);
    
    if (fields.length === 0) {
      console.log('No system fields found in database');
      return;
    }

    // Transform and insert system fields
    const fieldsToInsert = fields.map(field => ({
      id: field.id,
      name: field.name,
      data_type: field.data_type,
      is_required: Boolean(field.is_required),
      description: field.description,
      version: field.version || 1,
      status: field.status || 'active',
      created_at: field.created_at,
      updated_at: field.updated_at,
      created_by: null,
      validation_rules: field.validation_rules ? JSON.parse(field.validation_rules) : null,
      metadata_properties: field.metadata_properties ? JSON.parse(field.metadata_properties) : null
    }));

    const { error } = await supabase
      .from('system_fields')
      .insert(fieldsToInsert);
    
    if (error) {
      console.error('❌ Error inserting system fields:', error);
      throw error;
    }

    console.log(`✅ Successfully migrated ${fields.length} system fields`);
  } catch (error) {
    console.error('❌ Error migrating system fields:', error);
    throw error;
  }
}

async function generateMigrationReport() {
  console.log('\n📋 Migration Report:');
  console.log('==================');
  
  try {
    // Count records in Supabase
    const { count: sitesCount } = await supabase
      .from('sites')
      .select('*', { count: 'exact', head: true });
    
    const { count: jobsCount } = await supabase
      .from('upload_jobs')
      .select('*', { count: 'exact', head: true });
    
    const { count: fieldsCount } = await supabase
      .from('system_fields')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Sites migrated: ${sitesCount}`);
    console.log(`✅ Jobs migrated: ${jobsCount}`);
    console.log(`✅ System fields migrated: ${fieldsCount}`);
    
    console.log('\n⚠️  POST-MIGRATION TASKS:');
    console.log('1. Users need to re-register through Supabase Auth');
    console.log('2. Update created_by fields once users re-register');
    console.log('3. Test all application functionality');
    console.log('4. Update environment variables in production');
    console.log('5. Remove SQLite database dependencies from code');
    
  } catch (error) {
    console.error('❌ Error generating migration report:', error);
  }
}

async function main() {
  try {
    const users = await migrateUsers();
    await migrateSites();
    await migrateJobs();
    await migrateSystemFields();
    await generateMigrationReport();
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
  }
}

// Run migration
main();