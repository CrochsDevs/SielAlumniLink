import dotenv from 'dotenv';
import { connectDB, client } from '../config/db.js';
import Roles from '../constant/roles.js';

dotenv.config();

// Promotes an EXISTING account to admin. Nothing is hardcoded —
// the account must already exist in the database (created via
// signup or CAIS sync).
//
// Usage: npm run promote-admin -- <email>
// Example: npm run promote-admin -- juan@clsu.edu.ph

const email = process.argv[2];

if (!email) {
  console.error('Usage: npm run promote-admin -- <email>');
  process.exit(1);
}

await connectDB();

const authCollection = client.db('SielAlumni').collection('auth');
const result = await authCollection.updateOne(
  { email },
  { $set: { role: Roles.ADMIN, updatedAt: new Date() } }
);

if (result.matchedCount === 0) {
  console.error(`No account found with email: ${email}`);
} else {
  console.log(`Admin role granted to: ${email}`);
}

await client.close();
process.exit(result.matchedCount === 0 ? 1 : 0);
