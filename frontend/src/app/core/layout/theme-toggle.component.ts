import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ThemeService } from '../theme/theme.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [TranslatePipe, ButtonModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button
      [icon]="theme.darkMode() ? 'pi pi-sun' : 'pi pi-moon'"
      [text]="true"
      [rounded]="true"
      severity="secondary"
      [pTooltip]="label() | translate"
      tooltipPosition="bottom"
      [ariaLabel]="label() | translate"
      (onClick)="theme.toggle()"
    />
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly label = computed(() =>
    this.theme.darkMode() ? 'layout.lightMode' : 'layout.darkMode',
  );
}
