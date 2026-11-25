import { ObjectId } from "mongodb";
import { profileProjection, visibleProfile } from "./profile-visibility.js";
import { activeAccount } from "../auth/session-token.js";

export function createUserDirectory(db) {
  return async (viewer, role) => {
    const profiles = await db
      .collection("users")
      .find({}, { projection: profileProjection })
      .toArray();
    const ids = [
      ...new Set(
        profiles
          .filter((profile) => profile.authId)
          .map((profile) => String(profile.authId)),
      ),
    ];
    const emails = [
      ...new Set(
        profiles
          .filter((profile) => !profile.authId && profile.email)
          .map((profile) => profile.email.trim().toLowerCase()),
      ),
    ];
    const values = ids.flatMap((id) =>
      ObjectId.isValid(id) ? [new ObjectId(id), id] : [id],
    );
    const accounts =
      ids.length || emails.length
        ? await db
            .collection("auth")
            .find(
              {
                $or: [{ _id: { $in: values } }, { email: { $in: emails } }],
              },
              {
                projection: {
                  _id: 1,
                  email: 1,
                  role: 1,
                  disabledAt: 1,
                  sourceIsActive: 1,
                  sourceDeletedAt: 1,
                  registrationSource: 1,
                  passwordSetupRequired: 1,
                  invitation: 1,
                },
              },
            )
            .toArray()
        : [];
    const byId = new Map(
      accounts.map((account) => [String(account._id), account]),
    );
    const byEmail = new Map(
      accounts.map((account) => [account.email, account]),
    );
    return profiles.flatMap((profile) => {
      const account = profile.authId
        ? byId.get(String(profile.authId))
        : byEmail.get(profile.email?.trim().toLowerCase());
      if (
        (account && !activeAccount(account)) ||
        profile.sourceIsActive === false ||
        profile.sourceDeletedAt
      )
        return [];
      const resolved = {
        ...profile,
        role: account?.role || profile.role || null,
      };
      if (
        role &&
        (resolved.role || "").toLowerCase() !== String(role).toLowerCase()
      )
        return [];
      const result = visibleProfile(resolved, viewer);
      if (
        viewer?.role === "admin" &&
        account?.registrationSource === "manual"
      ) {
        result.invitationStatus =
          account.passwordSetupRequired === false
            ? "completed"
            : account.invitation?.delivery || "pending";
        result.invitationLastAttemptAt =
          account.invitation?.lastAttemptAt || null;
        result.invitationExpiresAt = account.invitation?.expiresAt || null;
      }
      return [result];
    });
  };
}
