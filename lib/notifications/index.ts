/**
 * Notification abstraction. Deliberately minimal for V1 — we ship a no-op
 * console provider and an interface so channels (Telegram, browser, email,
 * Discord, SMS) can be added later without touching the pipeline.
 */

import type { Opportunity, Project } from "@/lib/types";
import { logger } from "@/lib/logger";
import { formatInZone } from "@/lib/dates/timezone";

export interface MintNotification {
  project: Pick<Project, "name" | "x_username">;
  opportunity: Opportunity;
  reason: "upcoming" | "live" | "verified" | "updated";
}

export interface NotificationProvider {
  readonly name: string;
  send(notification: MintNotification): Promise<void>;
}

/** Human-readable one-liner reused by any future channel. */
export function formatNotification(n: MintNotification): string {
  const when = n.opportunity.mint_date
    ? formatInZone(n.opportunity.mint_date, n.opportunity.timezone)
    : "date unknown";
  const price =
    n.opportunity.price != null
      ? ` · ${n.opportunity.price}${n.opportunity.currency ? ` ${n.opportunity.currency}` : ""}`
      : "";
  return `${n.project.name ?? n.project.x_username}\n${when}${price}`;
}

/** Default provider — logs only. Swap/add real providers later. */
export class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = "console";
  async send(notification: MintNotification): Promise<void> {
    logger.info("notification", {
      channel: this.name,
      reason: notification.reason,
      body: formatNotification(notification),
    });
  }
}

const providers: NotificationProvider[] = [new ConsoleNotificationProvider()];

export async function notify(n: MintNotification): Promise<void> {
  await Promise.allSettled(providers.map((p) => p.send(n)));
}
