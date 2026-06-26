/**
 * Staff identity / authorization.
 *
 * For the pilot, the source of truth is the STAFF_APPROVER_NUMBERS env allowlist
 * (see config/env.ts). Any inbound WhatsApp message from one of those numbers is
 * treated as a Destination Pakistan staff member and routed to the staff command
 * parser instead of the customer qualifier.
 *
 * Numbers are compared *normalized* (E.164, no `whatsapp:` prefix) so callers can
 * pass either form. The env var is documented as carrying the `whatsapp:` prefix,
 * so we strip it on both sides.
 */

import { env } from '../config/env';
import { stripWhatsAppPrefix } from './twilio/client';

/** Normalized set of approver numbers (no `whatsapp:` prefix), computed once. */
const approverSet = new Set(env.staffApproverNumbers.map((n) => stripWhatsAppPrefix(n)));

/** True when the given WhatsApp number belongs to an authorized staff member. */
export function isStaffNumber(whatsappNumber: string): boolean {
  return approverSet.has(stripWhatsAppPrefix(whatsappNumber));
}

/** All approver numbers, normalized — used to broadcast staff notifications. */
export function staffApproverNumbers(): string[] {
  return Array.from(approverSet);
}
