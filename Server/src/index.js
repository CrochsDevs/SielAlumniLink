import 'dotenv/config';
import { connectDB, client } from "../config/db.js";
import { ensureSearchIndexes } from "../modules/search/search.indexes.js";
import AuthModel from "../modules/auth/auth.models.js";
import { initSocket } from "../realtime/socket.js";
import { createServer } from "http";
import app from "./app.js";
import { ensureFeedIndexes } from '../modules/feed/feed.service.js';

await connectDB();
await ensureSearchIndexes(client.db('SielAlumni'));
await ensureFeedIndexes(client.db('SielAlumni'));
await AuthModel.markPasswordSetupRequiredForExistingUsers();
await AuthModel.normalizeLegacyRoles();

const server = createServer(app);
initSocket(server);
const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
