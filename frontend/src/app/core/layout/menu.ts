export interface AppMenuItem {
  /** Translation key of the label. */
  label: string;
  icon: string;
  route: string;
  adminOnly?: boolean;
}

export interface AppMenuSection {
  /** Translation key of the section title; the first section has none. */
  title?: string;
  items: AppMenuItem[];
}

/** Main navigation. Each feature adds its entry when it is implemented. */
export const APP_MENU: AppMenuSection[] = [
  {
    items: [
      { label: 'menu.home', icon: 'pi pi-home', route: '/home' },
      { label: 'menu.accounts', icon: 'pi pi-wallet', route: '/accounts' },
      { label: 'menu.transactions', icon: 'pi pi-arrow-right-arrow-left', route: '/transactions' },
      { label: 'menu.schedules', icon: 'pi pi-calendar-clock', route: '/schedules' },
    ],
  },
  {
    title: 'menu.admin',
    items: [
      { label: 'menu.users', icon: 'pi pi-users', route: '/admin/users', adminOnly: true },
      {
        label: 'menu.currencies',
        icon: 'pi pi-money-bill',
        route: '/admin/currencies',
        adminOnly: true,
      },
    ],
  },
];
