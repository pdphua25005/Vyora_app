import "dotenv/config";

import app from "./app.js";
import { ChatMessage } from "./models/chat.js";
import { ForumCommentReaction } from "./models/forum.js";
import { seedForumSamples } from "./models/forumSamples.js";
import { User } from "./models/user.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  if (Buffer.byteLength(process.env.JWT_SECRET ?? '', 'utf8') < 32) {
    throw new Error('JWT_SECRET trong backend/.env cần ít nhất 32 byte.');
  }
  await connectDB();
  // Ensure the database enforces uniqueness before accepting registrations.
  await Promise.all([User.createIndexes(), ForumCommentReaction.createIndexes(), ChatMessage.createIndexes()]);
  await seedForumSamples();

  app.listen(PORT, () => {
    console.log("------------------------------");
    console.log("VYORA BACKEND SERVER");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/health`);
    console.log("------------------------------");
  });
};

startServer().catch(error => {
  console.error("Backend startup failed:", error.code ?? error.name, error.code ? "" : error.message);
  process.exit(1);
});
