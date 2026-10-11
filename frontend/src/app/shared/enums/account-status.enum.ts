export const ACCOUNT_STATUSES = ['ACTIVE', 'DISABLED', 'DELETED'] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Statuses selectable in forms and filters (DELETED only comes from deleting). */
export const EDITABLE_ACCOUNT_STATUSES: AccountStatus[] = ['ACTIVE', 'DISABLED'];
