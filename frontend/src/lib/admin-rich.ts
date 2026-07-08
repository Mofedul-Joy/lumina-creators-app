// Thin bridge used by the shared CreatorDetailCard (Feature 2) so it can fetch
// the rich creator record with the admin bearer token and, when rendered
// inside the applicants drawer, PATCH the underlying applicant status without
// importing the full applicants module (avoids a circular import with
// admin/applicants page.tsx).
import { getCreatorRichDetail as fetchRich } from "@/lib/api";
import { updateApplicant } from "@/lib/admin";

export const getCreatorRichDetail = (token: string, id: string) => fetchRich(token, id);

export const updateApplicantStatusSafe = (participationId: string, status: "bookmarked" | "declined") =>
  updateApplicant(participationId, { status });
