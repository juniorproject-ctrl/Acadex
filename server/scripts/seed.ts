import bcrypt from 'bcrypt';
import { pool } from '../db';
import { seedListings } from '../../src/lib/demoListings';

const seedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Acadex Marketplace',
  email: 'marketplace@sharjah.ac.ae',
};

async function seed() {
  const passwordHash = await bcrypt.hash('SeedAccount!2026', 12);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'INSERT INTO users (id, name, email, password_hash, role, is_verified, verified_at) VALUES (?, ?, ?, ?, ?, 1, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE name = VALUES(name)',
      [seedUser.id, seedUser.name, seedUser.email, passwordHash, 'student'],
    );
    for (const listing of seedListings) {
      const id = `00000000-0000-4000-8000-${listing.id.replace('seed-', '').padStart(12, '0')}`;
      await connection.execute(
        'INSERT INTO listings (id, owner_id, title, description, price, category, item_condition, location, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, \'ACTIVE\', ?) ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), price = VALUES(price), category = VALUES(category), item_condition = VALUES(item_condition), location = VALUES(location)',
        [id, seedUser.id, listing.title, listing.subtitle, listing.price, listing.category, listing.condition, listing.location, new Date(listing.createdAt)],
      );
      await connection.execute('INSERT INTO listing_images (id, listing_id, image_url, position) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)', [
        `10000000-0000-4000-8000-${listing.id.replace('seed-', '').padStart(12, '0')}`,
        id,
        listing.image,
      ]);
    }
    await connection.commit();
    console.log(`Seeded ${seedListings.length} listings.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
