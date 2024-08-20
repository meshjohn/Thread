/* eslint-disable camelcase */
// Resource: https://clerk.com/docs/users/sync-data-to-your-backend
// Above article shows why we need webhooks i.e., to sync data to our backend

// Resource: https://docs.svix.com/receiving/verifying-payloads/why
// It's a good practice to verify webhooks. Above article shows why we should do it
import { Webhook, WebhookRequiredHeaders } from "svix";
import { headers } from "next/headers";

import { IncomingHttpHeaders } from "http";
import { NextResponse } from "next/server";
import {
  addMemberToCommunity,
  createCommunity,
  deleteCommunity,
  removeUserFromCommunity,
  updateCommunityInfo,
} from "@/lib/actions/community.actions";

// Resource: https://clerk.com/docs/integration/webhooks#supported-events
// Above document lists the supported events
type EventType =
  | "organization.created"
  | "organizationInvitation.created"
  | "organizationMembership.created"
  | "organizationMembership.deleted"
  | "organization.updated"
  | "organization.deleted";

type Event = {
  data: Record<string, string | number | Record<string, string>[]>;
  object: "event";
  type: EventType;
};

export const POST = async (request: Request) => {
  console.log("Webhook handler triggered");  // Log to check if handler is triggered

  const payload = await request.json();
  console.log("Received payload:", payload);  // Log the entire payload

  const header = headers();
  console.log("Received headers:", header);  // Log the headers to ensure they are received correctly

  const heads = {
    "svix-id": header.get("svix-id"),
    "svix-timestamp": header.get("svix-timestamp"),
    "svix-signature": header.get("svix-signature"),
  };

  // Log the extracted headers for debugging
  console.log("Extracted svix headers:", heads);

  // Check if the webhook secret is loaded correctly
  console.log("Webhook Secret:", process.env.NEXT_CLERK_WEBHOOK_SECRET);

  const wh = new Webhook(process.env.NEXT_CLERK_WEBHOOK_SECRET || "");

  let evnt: Event | null = null;

  try {
    evnt = wh.verify(
      JSON.stringify(payload),
      heads as IncomingHttpHeaders & WebhookRequiredHeaders
    ) as Event;
    console.log("Webhook verified successfully.");  // Log success
  } catch (err) {
    console.log("Webhook verification failed:", err);  // Log verification failure
    return NextResponse.json({ message: err }, { status: 400 });
  }

  const eventType: EventType = evnt?.type!;
  console.log("Received event type:", eventType);  // Log the event type

  // Listen organization creation event
  if (eventType === "organization.created") {
    console.log("Handling organization.created event");
    const { id, name, slug, logo_url, image_url, created_by } = evnt?.data ?? {};
    console.log("Event data:", evnt?.data);  // Log the event data

    try {
      // @ts-ignore
      await createCommunity(
        // @ts-ignore
        id,
        name,
        slug,
        logo_url || image_url,
        "org bio",
        created_by
      );
      return NextResponse.json({ message: "Organization created" }, { status: 201 });
    } catch (err) {
      console.log("Error creating community:", err);  // Log the error
      return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
  }

  if (eventType === "organizationInvitation.created") {
    console.log("Handling organizationInvitation.created event");
    console.log("Invitation created data:", evnt?.data);  // Log the event data

    try {
      return NextResponse.json({ message: "Invitation created" }, { status: 201 });
    } catch (err) {
      console.log("Error handling invitation:", err);  // Log the error
      return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
  }

  if (eventType === "organizationMembership.created") {
    console.log("Handling organizationMembership.created event");
    const { organization, public_user_data } = evnt?.data;
    console.log("Membership created data:", evnt?.data);  // Log the event data

    try {
      // @ts-ignore
      await addMemberToCommunity(organization.id, public_user_data.user_id);
      return NextResponse.json({ message: "Membership created" }, { status: 201 });
    } catch (err) {
      console.log("Error adding member to community:", err);  // Log the error
      return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
  }

  if (eventType === "organizationMembership.deleted") {
    console.log("Handling organizationMembership.deleted event");
    const { organization, public_user_data } = evnt?.data;
    console.log("Membership deleted data:", evnt?.data);  // Log the event data

    try {
      // @ts-ignore
      await removeUserFromCommunity(public_user_data.user_id, organization.id);
      return NextResponse.json({ message: "Member removed" }, { status: 201 });
    } catch (err) {
      console.log("Error removing member from community:", err);  // Log the error
      return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
  }

  if (eventType === "organization.updated") {
    console.log("Handling organization.updated event");
    const { id, logo_url, name, slug } = evnt?.data;
    console.log("Organization updated data:", evnt?.data);  // Log the event data

    try {
      // @ts-ignore
      await updateCommunityInfo(id, name, slug, logo_url);
      return NextResponse.json({ message: "Organization updated" }, { status: 201 });
    } catch (err) {
      console.log("Error updating organization:", err);  // Log the error
      return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
  }

  if (eventType === "organization.deleted") {
    console.log("Handling organization.deleted event");
    const { id } = evnt?.data;
    console.log("Organization deleted data:", evnt?.data);  // Log the event data

    try {
      // @ts-ignore
      await deleteCommunity(id);
      return NextResponse.json({ message: "Organization deleted" }, { status: 201 });
    } catch (err) {
      console.log("Error deleting organization:", err);  // Log the error
      return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
  }
  
  console.log("Unhandled event type:", eventType);  // Log if the event type is unhandled
  return NextResponse.json({ message: "Event type not handled" }, { status: 400 });
};
