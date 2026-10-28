export const SCHEDULE_STATUSES = ['ACTIVE', 'DISABLED', 'DELETED'] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

/** Statuses selectable in filters and toggles (DELETED only comes from deleting). */
export const EDITABLE_SCHEDULE_STATUSES: ScheduleStatus[] = ['ACTIVE', 'DISABLED'];
