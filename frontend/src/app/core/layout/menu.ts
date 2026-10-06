export interface AppMenuItem {
  /** Translation key of the label. */
  label: string;
  icon: string;
  route: string;
}

/** Main navigation. Each feature adds its entry when it is implemented. */
export const APP_MENU: AppMenuItem[] = [{ label: 'menu.home', icon: 'pi pi-home', route: '/home' }];
