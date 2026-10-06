import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import { readStorage, writeStorage } from '../storage/local-storage';
import { DARK_MODE_CLASS } from './accountant-preset';

const STORAGE_KEY = 'accountant:dark-mode';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly darkMode = signal(this.initialDarkMode());

  constructor() {
    effect(() => {
      const dark = this.darkMode();
      this.document.documentElement.classList.toggle(DARK_MODE_CLASS, dark);
      writeStorage(STORAGE_KEY, String(dark));
    });
  }

  toggle(): void {
    this.darkMode.update((dark) => !dark);
  }

  private initialDarkMode(): boolean {
    const stored = readStorage(STORAGE_KEY);
    if (stored !== null) {
      return stored === 'true';
    }
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
