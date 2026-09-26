import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import AuthModel from "../modules/auth/auth.models.js";
import { initSocket } from "../realtime/socket.js";
import { createServer } from "http";
import app from "./app.js";

dotenv.config();

await connectDB();
await AuthModel.markPasswordSetupRequiredForExistingUsers();
await AuthModel.normalizeLegacyRoles();

const server = createServer(app);
initSocket(server);
const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});