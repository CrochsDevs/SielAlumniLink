import 'dotenv/config';
import { connectDB, client } from "../config/db.js";
import { ensureSearchIndexes } from "../modules/search/search.indexes.js";
import AuthModel from "../modules/auth/auth.models.js";
import { initSocket } from "../realtime/socket.js";
import { createServer } from "http";
import app from "./app.js";
import { ensureFeedIndexes } from '../modules/feed/feed.service.js';
import { ensureNotificationRetention } from '../modules/notifications/notifications.retention.js';
import { ensureAuthSecurityIndexes } from '../modules/auth/auth-limits.js';
import { ensurePerformanceIndexes } from '../config/performance-indexes.js';

await connectDB();
await ensureAuthSecurityIndexes(client.db('SielAlumni'));
await ensureNotificationRetention(client.db('SielAlumni'));
await ensureSearchIndexes(client.db('SielAlumni'));
await ensureFeedIndexes(client.db('SielAlumni'));
await ensurePerformanceIndexes(client.db('SielAlumni'));
await AuthModel.markPasswordSetupRequiredForExistingUsers();
await AuthModel.normalizeLegacyRoles();

const server = createServer(app);
initSocket(server);
const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
