import { monthlyCron, parseMonthlyCron } from './monthly-cron';

describe('monthly cron', () => {
  it('builds day-of-month and last-day expressions', () => {
    expect(monthlyCron(15)).toBe('0 0 0 15 * *');
    expect(monthlyCron('L')).toBe('0 0 0 L * *');
  });

  it('recognizes simple expressions only', () => {
    expect(parseMonthlyCron('0 0 0 5 * *')).toBe(5);
    expect(parseMonthlyCron(' 0 0 0 L * * ')).toBe('L');
    expect(parseMonthlyCron('0 0 0 32 * *')).toBeNull();
    expect(parseMonthlyCron('0 0 0 15 */2 *')).toBeNull();
    expect(parseMonthlyCron(null)).toBeNull();
  });
});
