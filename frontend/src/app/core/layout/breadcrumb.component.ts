import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { filter, map, startWith } from 'rxjs';

/** Route data key holding the translation key of a breadcrumb segment. */
export const BREADCRUMB = 'breadcrumb';

@Component({
  selector: 'app-breadcrumb',
  imports: [BreadcrumbModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p-breadcrumb [model]="items()" [home]="home" styleClass="bg-transparent! p-0!" />`,
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly home: MenuItem = { icon: 'pi pi-home', routerLink: '/home' };

  private readonly segments = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => collectSegments(this.router.routerState.snapshot.root)),
    ),
    { initialValue: [] },
  );

  // Re-evaluated on language change so labels follow the active language.
  private readonly language = toSignal(this.translate.onLangChange, { initialValue: null });

  protected readonly items = computed<MenuItem[]>(() => {
    this.language();
    return this.segments().map((segment) => ({
      label: this.translate.instant(segment.label),
      routerLink: segment.url,
    }));
  });
}

interface Segment {
  label: string;
  url: string;
}

function collectSegments(route: ActivatedRouteSnapshot): Segment[] {
  const segments: Segment[] = [];
  let url = '';
  let current: ActivatedRouteSnapshot | null = route;
  while (current) {
    const path = current.url.map((part) => part.path).join('/');
    if (path) {
      url += `/${path}`;
    }
    const label = current.routeConfig?.data?.[BREADCRUMB] as string | undefined;
    if (label && path) {
      segments.push({ label, url });
    }
    current = current.firstChild;
  }
  return segments;
}
