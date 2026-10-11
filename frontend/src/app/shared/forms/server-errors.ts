import { AbstractControl, FormGroup } from '@angular/forms';
import { ApiProblem } from '../models/api-problem.model';

export const SERVER_ERROR = 'server';

/**
 * Puts backend field errors (`errors: { field: CODE }`) on the matching form controls as
 * `{ server: CODE }`. Returns true when at least one field error was applied.
 */
export function applyServerErrors(form: FormGroup, problem: ApiProblem): boolean {
  let applied = false;
  for (const [field, code] of Object.entries(problem.errors ?? {})) {
    const control: AbstractControl | null = form.get(field);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), [SERVER_ERROR]: code });
      control.markAsTouched();
      applied = true;
    }
  }
  return applied;
}
