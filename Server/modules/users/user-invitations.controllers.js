import { client } from "../../config/db.js";
import { sendInvitationEmail } from "../../utils/email.js";
import ActivityModel from "../activity/activity.models.js";
import { createUserInvitations } from "./user-invitations.js";
import { frontendOrigin } from "../../config/frontend-origin.js";

const invitations = createUserInvitations({
  db: client.db("SielAlumni"),
  sendEmail: sendInvitationEmail,
  frontendUrl: (requestOrigin) => frontendOrigin(process.env, requestOrigin),
  transaction: async (operation) => {
    const session = client.startSession();
    try {
      return await session.withTransaction(() => operation(session));
    } finally {
      await session.endSession();
    }
  },
});

const handleError = (res, error) =>
  res
    .status(error.status || 500)
    .json({
      success: false,
      message: error.status
        ? error.message
        : "Unable to process the invitation. Please try again.",
    });

export async function registerInvitedUser(req, res) {
  try {
    const data = await invitations.register(
      req.body,
      req.user,
      req.headers?.origin,
    );
    await ActivityModel.logAdmin(
      req.user,
      "user_created",
      { type: "user", id: data.authId, label: data.name },
      `Registered without a password; invitation ${data.invitationDelivery}.`,
      req.ip,
    );
    res
      .status(201)
      .json({
        success: true,
        data,
        message:
          data.invitationDelivery === "accepted"
            ? "User registered. Invitation accepted for email delivery."
            : "User registered, but the invitation could not be sent. Please retry from the user list.",
      });
  } catch (error) {
    handleError(res, error);
  }
}

export async function resendUserInvitation(req, res) {
  try {
    const data = await invitations.resend(req.params.id, req.headers?.origin);
    await ActivityModel.logAdmin(
      req.user,
      "user_invitation_sent",
      { type: "user", id: req.params.id },
      `Invitation ${data.invitationDelivery}.`,
      req.ip,
    );
    res.json({
      success: true,
      data,
      message:
        data.invitationDelivery === "accepted"
          ? "Invitation accepted for email delivery."
          : "Invitation could not be sent. Check the email provider and try again.",
    });
  } catch (error) {
    handleError(res, error);
  }
}
