/**
 * Citizen-facing report status and in-app notifications.
 *
 * Notifications are derived from the shared store (each defect's status history, the
 * citizen's observations and issues), so an authority's status change is visible to the
 * citizen without any extra messaging. They are IN-APP PROTOTYPE NOTIFICATIONS: shown while
 * the app is open. No push service (Firebase Cloud Messaging / APNs) is connected.
 */
import type { CitizenIssue, Defect, DefectStatus } from '../api/types';
import { CITIZEN_ISSUE_LABELS } from '../api/types';
import type { StoredNotice } from '../api/mockBackend';

export type CitizenStage = 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'SCHEDULED' | 'REPAIRED' | 'REOPENED';

export const STAGE_META: Record<CitizenStage, { label: string; description: string }> = {
  SUBMITTED: { label: 'Report submitted', description: 'Received and linked to a Digital Defect ID.' },
  UNDER_REVIEW: { label: 'Under review', description: 'Awaiting verification by the road authority.' },
  VERIFIED: { label: 'Verified', description: 'The authority confirmed the defect.' },
  SCHEDULED: { label: 'Scheduled', description: 'Maintenance has been scheduled.' },
  REPAIRED: { label: 'Repaired', description: 'The authority marked the defect repaired.' },
  REOPENED: { label: 'Reopened', description: 'The defect recurred after repair and was reopened.' },
};

/** Maps the maintenance lifecycle onto the stages a citizen sees. */
export function citizenStage(defect: Defect): CitizenStage {
  switch (defect.status) {
    case 'RECURRED':
      return 'REOPENED';
    case 'REPAIRED':
      return 'REPAIRED';
    case 'SCHEDULED':
      return 'SCHEDULED';
    case 'VERIFIED':
      return 'VERIFIED';
    default:
      return 'UNDER_REVIEW';
  }
}

/** Stages shown in the status stepper; REOPENED only appears once it happens. */
export function stageSteps(defect: Defect): { stage: CitizenStage; state: 'done' | 'current' | 'todo' }[] {
  const current = citizenStage(defect);
  const order: CitizenStage[] = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'SCHEDULED', 'REPAIRED'];
  if (current === 'REOPENED') order.push('REOPENED');
  const idx = order.indexOf(current);
  return order.map((stage, i) => ({ stage, state: i < idx ? 'done' : i === idx ? 'current' : 'todo' }));
}

export type NotificationKind =
  | 'SUBMITTED'
  | 'OUTCOME'
  | 'UNDER_REVIEW'
  | 'STATUS'
  | 'REVIEW'
  | 'RECORD_UPDATED'
  | 'ISSUE'
  | 'REMOVED';

export interface CitizenNotification {
  id: string;
  at: number;
  defectId: string;
  kind: NotificationKind;
  title: string;
  body: string;
}

const STATUS_MESSAGE: Partial<Record<DefectStatus, (id: string) => [string, string]>> = {
  CORROBORATED: (id) => ['Report corroborated', `Another report confirmed ${id}. It is now supported by more than one report.`],
  VERIFIED: (id) => ['Defect verified', `Your reported defect ${id} has been verified by the road authority.`],
  SCHEDULED: (id) => ['Maintenance scheduled', `Maintenance has been scheduled for ${id}.`],
  REPAIRED: (id) => ['Marked repaired', `${id} has been marked repaired.`],
  RECURRED: (id) => ['Defect reopened', `${id} recurred after repair and has been reopened.`],
  CANDIDATE: (id) => ['Back under review', `${id} is under review again.`],
};

const UNRESOLVED: DefectStatus[] = ['CANDIDATE', 'CORROBORATED'];

function statusAt(defect: Defect, at: number): DefectStatus {
  let s: DefectStatus = 'CANDIDATE';
  for (const h of defect.history ?? []) if (h.at <= at) s = h.to;
  return s;
}

export function deriveNotifications(
  defects: Defect[],
  issues: CitizenIssue[],
  notices: StoredNotice[],
  userId: string,
): CitizenNotification[] {
  const out: CitizenNotification[] = [];

  for (const d of defects) {
    const mine = d.observations.filter((o) => o.reporterId === userId);
    if (!mine.length) continue;
    const since = Math.min(...mine.map((o) => o.timestamp));

    for (const o of mine) {
      out.push({ id: `SUB-${o.id}`, at: o.timestamp, defectId: d.id, kind: 'SUBMITTED', title: 'Report submitted', body: `Your report ${o.id} was submitted successfully. Digital Defect ID: ${d.id}.` });
      const auto = o.identity?.automaticDecision ?? o.duplicateDecision ?? 'DISTINCT';
      const outcome: [string, string] =
        auto === 'MERGE'
          ? ['Added to an existing defect', `Your report was added as evidence to ${d.id}.`]
          : auto === 'REVIEW'
            ? ['Held for duplicate review', `Your report may show the same defect as ${o.comparedDefectId ?? 'an existing record'}. An authority will decide.`]
            : ['New defect record', `Your report created a new defect record, ${o.duplicateDecision === 'MERGE' ? 'later merged into ' : ''}${d.id}.`];
      out.push({ id: `OUT-${o.id}`, at: o.timestamp, defectId: d.id, kind: 'OUTCOME', title: outcome[0], body: outcome[1] });
    }

    const initial = statusAt(d, since);
    out.push(
      UNRESOLVED.includes(initial)
        ? { id: `UR-${d.id}-${since}`, at: since, defectId: d.id, kind: 'UNDER_REVIEW', title: 'Under review', body: `Your report is under review. ${d.id} is awaiting verification by the road authority.` }
        : { id: `UR-${d.id}-${since}`, at: since, defectId: d.id, kind: 'STATUS', title: 'Joined an existing record', body: `${d.id} was already ${STAGE_META[citizenStage({ ...d, status: initial })].label.toLowerCase()} when your report was added.` },
    );

    (d.history ?? []).forEach((h, i) => {
      if (h.at < since || h.from === null) return;
      const id = `H-${d.id}-${i}-${h.at}`;
      if (h.from !== h.to) {
        const msg = STATUS_MESSAGE[h.to];
        if (msg) {
          const [title, body] = msg(d.id);
          out.push({ id, at: h.at, defectId: d.id, kind: 'STATUS', title, body });
        }
        return;
      }
      const note = h.note ?? '';
      if (note.startsWith('Review: kept distinct')) {
        out.push({ id, at: h.at, defectId: d.id, kind: 'REVIEW', title: 'Duplicate review resolved', body: `An authority reviewed the evidence and kept ${d.id} as a separate defect.` });
      } else if (note.startsWith('Review: merged')) {
        const viaReview = mine.some((o) => o.identity?.automaticDecision === 'REVIEW' && o.duplicateDecision === 'MERGE');
        out.push({
          id,
          at: h.at,
          defectId: d.id,
          kind: 'REVIEW',
          title: viaReview ? 'Merged after review' : 'Record updated',
          body: viaReview
            ? `An authority confirmed your report shows the same defect as ${d.id}. It is now part of that record.`
            : `A duplicate report was merged into ${d.id}.`,
        });
      } else if (note) {
        out.push({ id, at: h.at, defectId: d.id, kind: 'RECORD_UPDATED', title: 'Record updated', body: `${d.id}: ${note}.` });
      }
    });
  }

  for (const issue of issues) {
    if (issue.reporterId !== userId) continue;
    out.push({
      id: `ISS-${issue.id}`,
      at: issue.createdAt,
      defectId: issue.defectId,
      kind: 'ISSUE',
      title: 'Issue received',
      body: `${issue.id} (${CITIZEN_ISSUE_LABELS[issue.issueType]}) was flagged for admin review. Your original report is unchanged.`,
    });
  }

  for (const n of notices) {
    if (n.userId === userId) out.push({ id: n.id, at: n.at, defectId: n.defectId, kind: 'REMOVED', title: n.title, body: n.body });
  }

  return out.sort((a, b) => b.at - a.at);
}

export function unreadCount(notifications: CitizenNotification[], seenAt: number): number {
  return notifications.filter((n) => n.at > seenAt).length;
}
