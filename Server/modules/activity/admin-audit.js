const text = (value, max = 300) =>
  typeof value === "string" ? value.slice(0, max) : "";
const actions = new Set([
  "user_created",
  "user_updated",
  "email_changed",
  "role_changed",
  "account_disabled",
  "user_deleted",
  "user_graduated",
  "users_synced",
  "post_deleted",
  "comment_deleted",
  "post_blocked",
  "post_restored",
  "comments_disabled",
  "comments_enabled",
  "author_restricted",
  "author_unrestricted",
]);

// Append-only server events. Never pass request bodies or credential values here.
export async function recordAdminAudit(
  db,
  actor,
  action,
  target,
  details = "",
  ip = null,
) {
  if (actor?.role !== "admin" || !actor._id || !actions.has(action)) return;
  try {
    await db.collection("activity_logs").insertOne({
      authId: String(actor._id),
      email: text(actor.email),
      action,
      actor: {
        authId: String(actor._id),
        name: text(actor.name),
        email: text(actor.email),
        role: "admin",
      },
      target: {
        type: text(target?.type, 40),
        id: target?.id ? String(target.id) : null,
        label: text(target?.label),
      },
      details: text(details, 1000),
      ip: text(ip, 100) || null,
      createdAt: new Date(),
    });
  } catch (error) {
    // An audit outage must not report an already completed action as failed.
    console.error("[audit] Unable to record admin action:", error.message);
  }
}

// User access monitoring excludes admin identities and admin actions. Personal
// admin history still reads the original records through the owner-only service.
export async function listUserAccessAudit(db, limit = 50) {
  return db
    .collection("activity_logs")
    .aggregate([
      { $match: { action: { $in: ["login", "logout"] } } },
      {
        $lookup: {
          from: "auth",
          let: {
            id: {
              $convert: {
                input: "$authId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
            email: "$email",
            missingId: { $in: [{ $ifNull: ["$authId", ""] }, ["", null]] },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$_id", "$$id"] },
                    { $and: ["$$missingId", { $eq: ["$email", "$$email"] }] },
                  ],
                },
              },
            },
            { $project: { role: 1 } },
          ],
          as: "account",
        },
      },
      {
        $set: {
          roles: [
            { $toLower: { $ifNull: ["$role", ""] } },
            { $toLower: { $ifNull: ["$actor.role", ""] } },
            {
              $toLower: {
                $ifNull: [{ $arrayElemAt: ["$account.role", 0] }, ""],
              },
            },
          ],
        },
      },
      { $match: { roles: { $in: ["student", "alumni"], $nin: ["admin"] } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $limit: Math.min(Math.max(limit, 1), 200) },
      { $project: { account: 0, roles: 0 } },
    ])
    .toArray();
}
