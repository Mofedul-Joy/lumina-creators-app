/**
 * Shared vocabulary for the campaign creation flow.
 *
 * The flow is: template (optional) → campaign kind → experience level → wizard.
 * Everything here mirrors the CHECK constraints added in migration 0024, so an
 * option that exists in the UI is always one the backend will accept.
 */

export type CampaignKind =
  | "high_volume_ugc"
  | "influencer"
  | "paid_ads"
  | "campaign_manager"
  | "analytics_only";

export type ExperienceLevel = "essentials" | "advanced";

export type PaymentSchedule = "every_7_days" | "every_14_days" | "every_30_days";

export type PaymentCycleTrigger = "post_delivery" | "schedule";

export const CAMPAIGN_KINDS: {
  key: CampaignKind;
  title: string;
  blurb: string;
}[] = [
  {
    key: "high_volume_ugc",
    title: "High Volume UGC Campaign",
    blurb: "Creators produce content on brand-owned or brand-new accounts created specifically for your brand",
  },
  {
    key: "influencer",
    title: "Influencer Campaign",
    blurb: "Creators post content on their personal accounts to promote your brand to their audience",
  },
  {
    key: "paid_ads",
    title: "Paid Ads Campaign",
    blurb: "Receive a guaranteed set of creator-produced ad assets, optimized for paid media across platforms",
  },
  {
    key: "campaign_manager",
    title: "Campaign Manager",
    blurb: "Hire someone to manage creators, content, and communication on your behalf",
  },
  {
    key: "analytics_only",
    title: "Analytics Only",
    blurb: "View analytics and performance data without launching a creator program",
  },
];

export const EXPERIENCE_LEVELS: {
  key: ExperienceLevel;
  title: string;
  blurb: string;
  recommended?: boolean;
}[] = [
  {
    key: "essentials",
    title: "Essentials",
    blurb: "For brands new to UGC campaigns who want just the essentials.",
    recommended: true,
  },
  {
    key: "advanced",
    title: "Advanced",
    blurb: "For brands experienced with UGC campaigns who want full control and setup.",
  },
];

export const PAYMENT_SCHEDULES: { key: PaymentSchedule; label: string }[] = [
  { key: "every_7_days", label: "Every 7 days" },
  { key: "every_14_days", label: "Every 14 days" },
  { key: "every_30_days", label: "Every 30 days" },
];

export const CYCLE_TRIGGERS: { key: PaymentCycleTrigger; label: string; blurb: string }[] = [
  {
    key: "post_delivery",
    label: "Post delivery",
    blurb: "A payment cycle starts when the creator delivers a post.",
  },
  {
    key: "schedule",
    label: "Schedule",
    blurb: "A payment cycle runs on the schedule above, regardless of delivery.",
  },
];

export const kindLabel = (k: string) =>
  CAMPAIGN_KINDS.find((x) => x.key === k)?.title ?? k;

export const scheduleLabel = (s: string | null) =>
  PAYMENT_SCHEDULES.find((x) => x.key === s)?.label ?? "Not set";
