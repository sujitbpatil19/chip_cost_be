/**
 * Shared time-unit constants for converting engineering effort
 * (hours/days/months) into a common "months" basis.
 */

const HOURS_PER_DAY = 8;
const DAYS_PER_MONTH = 22;
const HOURS_PER_MONTH = HOURS_PER_DAY * DAYS_PER_MONTH; // 176

/**
 * Convert a duration in the given unit to months.
 */
function toMonths(duration, unit) {
  switch (unit) {
    case "hours":
      return duration / HOURS_PER_MONTH;
    case "days":
      return duration / DAYS_PER_MONTH;
    case "months":
      return duration;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

module.exports = {
  HOURS_PER_DAY,
  DAYS_PER_MONTH,
  HOURS_PER_MONTH,
  toMonths
};
