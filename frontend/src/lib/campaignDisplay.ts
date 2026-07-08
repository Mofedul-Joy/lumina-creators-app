// Shared display helpers for the native brief page (Feature 5) — payment-type
// labels/summaries and targeting chip lists. Used by both the authed creator
// campaign page and the public share page so the two stay visually in sync.
import { fmtInt, fmtMoney } from "@/lib/format";

export type PaymentFields = {
  payment_type: string | null;
  fixed_amount: number | string | null;
  cpm_rate: number | string;
  weekly_hours_needed: number | null;
  hourly_rate: number | string | null;
  required_hours: number | null;
  per_post_amount: number | string | null;
};

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  fixed: "Fixed payment",
  cpm: "Pay per views (CPM)",
  mixed: "Fixed + CPM",
  per_hour: "Hourly",
  per_post: "Per post",
};

export function paymentTypeLabel(paymentType: string | null | undefined): string {
  if (!paymentType) return "Pay per views (CPM)";
  return PAYMENT_TYPE_LABEL[paymentType] ?? paymentType;
}

/** Big headline amount string for the Payment & Terms card, e.g. "$500 flat" or "$5 per 1K views". */
export function paymentHeadline(c: PaymentFields): string {
  const type = c.payment_type ?? "cpm";
  switch (type) {
    case "fixed":
      return c.fixed_amount != null ? `${fmtMoney(c.fixed_amount)} flat` : "Fixed payment";
    case "mixed":
      return c.fixed_amount != null
        ? `${fmtMoney(c.fixed_amount)} flat + ${fmtMoney(c.cpm_rate)} per 1K views`
        : `${fmtMoney(c.cpm_rate)} per 1K views`;
    case "per_hour":
      return c.hourly_rate != null
        ? `${fmtMoney(c.hourly_rate)}/hr${c.required_hours ? ` × ${fmtInt(c.required_hours)} hrs` : ""}`
        : "Hourly rate";
    case "per_post":
      return c.per_post_amount != null ? `${fmtMoney(c.per_post_amount)} per post` : "Per post";
    case "cpm":
    default:
      return `${fmtMoney(c.cpm_rate)} per 1K views`;
  }
}

export const AGE_REQUIREMENT_LABEL: Record<string, string> = {
  "13+": "13+",
  "16+": "16+",
  "18+": "18+",
  "21+": "21+",
};

export function targetingChips(c: {
  age_requirement: string | null;
  content_type: string | null;
  posting_frequency: string | null;
  video_length: string | null;
  account_type: string | null;
  is_app: boolean;
  physical_product: boolean;
}): string[] {
  const chips: string[] = [];
  if (c.age_requirement) chips.push(AGE_REQUIREMENT_LABEL[c.age_requirement] ?? c.age_requirement);
  if (c.content_type) chips.push(c.content_type);
  if (c.posting_frequency) chips.push(c.posting_frequency);
  if (c.video_length) chips.push(c.video_length);
  if (c.account_type) chips.push(c.account_type);
  if (c.is_app) chips.push("In-app product");
  if (c.physical_product) chips.push("Physical product ships to you");
  return chips;
}
