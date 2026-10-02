import { useMemo } from 'react';
import { useDefects, useIssues, useNotices, useNotificationsSeenAt } from '../../api/mockBackend';
import { deriveNotifications, unreadCount, type CitizenNotification } from '../../services/citizenStatus';

/** In-app notifications for one citizen, derived live from the shared store. */
export function useNotifications(userId: string): { notifications: CitizenNotification[]; unread: number; seenAt: number } {
  const defects = useDefects();
  const issues = useIssues();
  const notices = useNotices();
  const seenAt = useNotificationsSeenAt(userId);
  const notifications = useMemo(() => deriveNotifications(defects, issues, notices, userId), [defects, issues, notices, userId]);
  return { notifications, unread: unreadCount(notifications, seenAt), seenAt };
}
