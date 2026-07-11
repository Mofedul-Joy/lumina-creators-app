import type { PaymentType } from "@/lib/admin";

/**
 * Pre-configured campaign templates.
 *
 * A template is just a seed for the existing 6-step builder — it pre-fills the
 * payment structure and the fields that go with it, then hands the admin the
 * same wizard. Nothing is locked: every seeded value stays editable, so a
 * template is a shortcut, never a separate kind of campaign.
 *
 * `preset` keys are a subset of the wizard's own state, so adding a field to
 * the builder never silently drops it here.
 */
export type CampaignTemplateKey = "one_time" | "per_post" | "cpm" | "hybrid";

export type TemplatePreset = {
  payment_type: PaymentType;
  fixed_amount?: string;
  cpm_rate?: string;
  per_post_amount?: string;
  budget?: string;
  content_type?: string;
  posting_frequency?: string;
};

export type CampaignTemplate = {
  key: CampaignTemplateKey;
  title: string;
  badge: string;          // short tag on the card
  blurb: string;
  example: string;        // the "Ex: …" line, so the admin knows when to pick it
  preset: TemplatePreset;
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    key: "one_time",
    title: "One-Time Payment Template (Fixed Cost)",
    badge: "Fixed",
    blurb:
      "Use when you're paying creators a fixed amount each pay period, regardless of performance.",
    example: "Ex: paying a creator recruitment lead $500 for the month.",
    preset: {
      payment_type: "fixed",
      fixed_amount: "500",
      budget: "5000",
      posting_frequency: "monthly",
    },
  },
  {
    key: "per_post",
    title: "Fixed Per Post Template",
    badge: "Post",
    blurb:
      "A high-volume UGC campaign run on a fixed-per-post basis — creators earn a flat rate for every approved post.",
    example: "Ex: paying a creator $20 per post.",
    preset: {
      payment_type: "per_post",
      per_post_amount: "20",
      budget: "10000",
      posting_frequency: "weekly",
    },
  },
  {
    key: "cpm",
    title: "Pay-Per View (CPM) Template",
    badge: "CPM",
    blurb: "Pay creators on a strictly performance basis — a rate per 1,000 views.",
    example: "Ex: $2 per 1,000 views, paid on verified views only.",
    preset: {
      payment_type: "cpm",
      cpm_rate: "2",
      budget: "10000",
    },
  },
  {
    key: "hybrid",
    title: "Hybrid Template (CPM + Fixed Rate)",
    badge: "Mixed",
    blurb:
      "Flexible: pay a guaranteed retainer plus a CPM view bonus, so creators get a floor and an upside.",
    example: "Ex: a $300/month retainer + $2 CPM for every 1,000 views.",
    preset: {
      payment_type: "mixed",
      fixed_amount: "300",
      cpm_rate: "2",
      budget: "15000",
      posting_frequency: "monthly",
    },
  },
];

export const getTemplate = (key: string | null | undefined): CampaignTemplate | undefined =>
  CAMPAIGN_TEMPLATES.find((t) => t.key === key);
