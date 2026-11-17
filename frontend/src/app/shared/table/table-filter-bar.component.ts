import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

/** Toolbar row that hosts the filters of a listing plus a "clear filters" button. */
@Component({
  selector: 'app-table-filter-bar',
  imports: [TranslatePipe, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-4 flex flex-wrap items-end gap-3">
      <ng-content />
      <p-button
        size="small"
        icon="pi pi-filter-slash"
        [label]="'common.clearFilters' | translate"
        [text]="true"
        severity="secondary"
        (onClick)="clear.emit()"
      />
    </div>
  `,
})
export class TableFilterBarComponent {
  readonly clear = output<void>();
}
