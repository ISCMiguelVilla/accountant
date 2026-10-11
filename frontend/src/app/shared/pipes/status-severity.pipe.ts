import { Pipe, PipeTransform } from '@angular/core';

export type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

const SEVERITIES: Record<string, TagSeverity> = {
  ACTIVE: 'success',
  DISABLED: 'secondary',
  DELETED: 'danger',
  ADMIN: 'contrast',
  USER: 'info',
};

/** Tag severity for status / role values. */
@Pipe({ name: 'statusSeverity' })
export class StatusSeverityPipe implements PipeTransform {
  transform(value: string | null | undefined): TagSeverity {
    return (value && SEVERITIES[value]) || 'secondary';
  }
}
