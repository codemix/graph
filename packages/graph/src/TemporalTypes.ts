/**
 * TemporalTypes - Cypher temporal value types.
 *
 * This module provides temporal value classes that support property access
 * for component extraction (e.g., date.year, date.month, date.day).
 */

/**
 * Common interface for temporal values that support property access.
 */
export interface TemporalValue {
  /** Get a component property of this temporal value */
  get(property: string): unknown;
  /** Convert to ISO string representation */
  toString(): string;
  /** Type identifier for instanceof-like checks */
  readonly temporalType: string;
}

/**
 * Check if a value is a temporal value.
 */
export function isTemporalValue(value: unknown): value is TemporalValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "temporalType" in value &&
    typeof (value as TemporalValue).get === "function"
  );
}

/**
 * DateValue - Represents a Cypher date value (year, month, day).
 *
 * Supports property access for:
 * - year: The year component
 * - month: The month component (1-12)
 * - day: The day component (1-31)
 * - week: ISO week number (1-53)
 * - dayOfWeek: Day of week (1=Monday, 7=Sunday)
 * - quarter: Quarter of year (1-4)
 * - ordinalDay: Day of year (1-366)
 */
export class DateValue implements TemporalValue {
  public readonly temporalType = "date";

  #year: number;
  #month: number;
  #day: number;

  public constructor(year: number, month: number, day: number) {
    this.#year = year;
    this.#month = month;
    this.#day = day;
  }

  /**
   * Create a DateValue from an ISO date string (YYYY-MM-DD).
   */
  public static fromString(iso: string): DateValue | null {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match || !match[1] || !match[2] || !match[3]) return null;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    return new DateValue(year, month, day);
  }

  /**
   * Create a DateValue from a map of components.
   */
  public static fromMap(map: Record<string, unknown>): DateValue | null {
    const year = map.year;
    const month = map.month;
    const day = map.day;
    if (typeof year !== "number" || typeof month !== "number" || typeof day !== "number") {
      return null;
    }
    return new DateValue(year, month, day);
  }

  public get year(): number {
    return this.#year;
  }

  public get month(): number {
    return this.#month;
  }

  public get day(): number {
    return this.#day;
  }

  /**
   * Get the ISO week number (1-53).
   * Uses the ISO 8601 definition where week 1 is the week containing January 4th.
   */
  public get week(): number {
    const date = new Date(Date.UTC(this.#year, this.#month - 1, this.#day));
    // Set to nearest Thursday: current date + 4 - current day number (making Sunday=7)
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    // Get first day of year
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    // Calculate full weeks between
    const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNo;
  }

  /**
   * Get the day of week (1=Monday, 7=Sunday).
   */
  public get dayOfWeek(): number {
    const date = new Date(this.#year, this.#month - 1, this.#day);
    const dow = date.getDay();
    // Convert from JS (0=Sunday) to ISO (1=Monday, 7=Sunday)
    return dow === 0 ? 7 : dow;
  }

  /**
   * Get the quarter (1-4).
   */
  public get quarter(): number {
    return Math.ceil(this.#month / 3);
  }

  /**
   * Get the ordinal day (day of year, 1-366).
   */
  public get ordinalDay(): number {
    const date = new Date(Date.UTC(this.#year, this.#month - 1, this.#day));
    const startOfYear = new Date(Date.UTC(this.#year, 0, 0));
    const diff = date.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  /**
   * Get a component property of this date.
   */
  public get(property: string): unknown {
    switch (property) {
      case "year":
        return this.year;
      case "month":
        return this.month;
      case "day":
        return this.day;
      case "week":
        return this.week;
      case "dayOfWeek":
        return this.dayOfWeek;
      case "quarter":
        return this.quarter;
      case "ordinalDay":
        return this.ordinalDay;
      default:
        return null;
    }
  }

  /**
   * Convert to ISO string (YYYY-MM-DD).
   */
  public toString(): string {
    const y = String(this.#year).padStart(4, "0");
    const m = String(this.#month).padStart(2, "0");
    const d = String(this.#day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * Compare two dates for sorting.
   * Returns negative if this < other, positive if this > other, 0 if equal.
   */
  public compareTo(other: DateValue): number {
    if (this.#year !== other.#year) return this.#year - other.#year;
    if (this.#month !== other.#month) return this.#month - other.#month;
    return this.#day - other.#day;
  }
}

/**
 * LocalTimeValue - Represents a Cypher local time value (no timezone).
 *
 * Supports property access for:
 * - hour: The hour component (0-23)
 * - minute: The minute component (0-59)
 * - second: The second component (0-59)
 * - millisecond: Milliseconds (0-999)
 * - microsecond: Microseconds (0-999999)
 * - nanosecond: Nanoseconds (0-999999999)
 */
export class LocalTimeValue implements TemporalValue {
  public readonly temporalType = "localtime";

  #hour: number;
  #minute: number;
  #second: number;
  #nanosecond: number;

  public constructor(hour: number, minute: number, second: number, nanosecond: number = 0) {
    this.#hour = hour;
    this.#minute = minute;
    this.#second = second;
    this.#nanosecond = nanosecond;
  }

  /**
   * Create a LocalTimeValue from an ISO time string (HH:MM:SS.nnnnnnnnn).
   */
  public static fromString(iso: string): LocalTimeValue | null {
    // Match time format: HH:MM:SS or HH:MM:SS.fractional
    const match = iso.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/);
    if (!match || !match[1] || !match[2] || !match[3]) return null;

    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const second = parseInt(match[3], 10);

    // Parse fractional seconds as nanoseconds
    let nanosecond = 0;
    if (match[4]) {
      // Pad to 9 digits
      const frac = match[4].padEnd(9, "0");
      nanosecond = parseInt(frac, 10);
    }

    return new LocalTimeValue(hour, minute, second, nanosecond);
  }

  /**
   * Create a LocalTimeValue from a map of components.
   */
  public static fromMap(map: Record<string, unknown>): LocalTimeValue | null {
    const hour = typeof map.hour === "number" ? map.hour : 0;
    const minute = typeof map.minute === "number" ? map.minute : 0;
    const second = typeof map.second === "number" ? map.second : 0;
    const nanosecond = typeof map.nanosecond === "number" ? map.nanosecond : 0;

    return new LocalTimeValue(hour, minute, second, nanosecond);
  }

  public get hour(): number {
    return this.#hour;
  }

  public get minute(): number {
    return this.#minute;
  }

  public get second(): number {
    return this.#second;
  }

  public get millisecond(): number {
    return Math.floor(this.#nanosecond / 1_000_000);
  }

  public get microsecond(): number {
    return Math.floor(this.#nanosecond / 1_000);
  }

  public get nanosecond(): number {
    return this.#nanosecond;
  }

  public get(property: string): unknown {
    switch (property) {
      case "hour":
        return this.hour;
      case "minute":
        return this.minute;
      case "second":
        return this.second;
      case "millisecond":
        return this.millisecond;
      case "microsecond":
        return this.microsecond;
      case "nanosecond":
        return this.nanosecond;
      default:
        return null;
    }
  }

  /**
   * Convert to ISO string (HH:MM:SS.nnnnnnnnn).
   */
  public toString(): string {
    const h = String(this.#hour).padStart(2, "0");
    const m = String(this.#minute).padStart(2, "0");
    const s = String(this.#second).padStart(2, "0");

    if (this.#nanosecond === 0) {
      return `${h}:${m}:${s}`;
    }

    // Format nanoseconds, removing trailing zeros
    let nanos = String(this.#nanosecond).padStart(9, "0");
    nanos = nanos.replace(/0+$/, "");
    return `${h}:${m}:${s}.${nanos}`;
  }

  public compareTo(other: LocalTimeValue): number {
    if (this.#hour !== other.#hour) return this.#hour - other.#hour;
    if (this.#minute !== other.#minute) return this.#minute - other.#minute;
    if (this.#second !== other.#second) return this.#second - other.#second;
    return this.#nanosecond - other.#nanosecond;
  }
}

/**
 * TimeValue - Represents a Cypher time value with timezone offset.
 *
 * Supports property access for:
 * - hour, minute, second, millisecond, microsecond, nanosecond (from LocalTimeValue)
 * - offset: The timezone offset in seconds
 * - offsetMinutes: The timezone offset in minutes
 */
export class TimeValue implements TemporalValue {
  public readonly temporalType = "time";

  #hour: number;
  #minute: number;
  #second: number;
  #nanosecond: number;
  #offsetSeconds: number;

  public constructor(
    hour: number,
    minute: number,
    second: number,
    nanosecond: number = 0,
    offsetSeconds: number = 0,
  ) {
    this.#hour = hour;
    this.#minute = minute;
    this.#second = second;
    this.#nanosecond = nanosecond;
    this.#offsetSeconds = offsetSeconds;
  }

  /**
   * Create a TimeValue from an ISO time string with timezone offset.
   * Format: HH:MM:SS.nnnnnnnnn+HH:MM or HH:MM:SS.nnnnnnnnnZ
   */
  public static fromString(iso: string): TimeValue | null {
    // Match time with timezone: HH:MM:SS.frac+HH:MM or Z
    const match = iso.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/);
    if (!match || !match[1] || !match[2] || !match[3]) return null;

    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const second = parseInt(match[3], 10);

    // Parse fractional seconds as nanoseconds
    let nanosecond = 0;
    if (match[4]) {
      const frac = match[4].padEnd(9, "0");
      nanosecond = parseInt(frac, 10);
    }

    // Parse timezone offset
    let offsetSeconds = 0;
    if (match[5] !== "Z" && match[6] && match[7] && match[8]) {
      const sign = match[6] === "+" ? 1 : -1;
      const offsetHours = parseInt(match[7], 10);
      const offsetMins = parseInt(match[8], 10);
      offsetSeconds = sign * (offsetHours * 3600 + offsetMins * 60);
    }

    return new TimeValue(hour, minute, second, nanosecond, offsetSeconds);
  }

  /**
   * Create a TimeValue from a map of components.
   */
  public static fromMap(map: Record<string, unknown>): TimeValue | null {
    const hour = typeof map.hour === "number" ? map.hour : 0;
    const minute = typeof map.minute === "number" ? map.minute : 0;
    const second = typeof map.second === "number" ? map.second : 0;
    const nanosecond = typeof map.nanosecond === "number" ? map.nanosecond : 0;
    const offsetSeconds = typeof map.offset === "number" ? map.offset : 0;

    return new TimeValue(hour, minute, second, nanosecond, offsetSeconds);
  }

  public get hour(): number {
    return this.#hour;
  }

  public get minute(): number {
    return this.#minute;
  }

  public get second(): number {
    return this.#second;
  }

  public get millisecond(): number {
    return Math.floor(this.#nanosecond / 1_000_000);
  }

  public get microsecond(): number {
    return Math.floor(this.#nanosecond / 1_000);
  }

  public get nanosecond(): number {
    return this.#nanosecond;
  }

  public get offset(): number {
    return this.#offsetSeconds;
  }

  public get offsetMinutes(): number {
    return Math.floor(this.#offsetSeconds / 60);
  }

  public get(property: string): unknown {
    switch (property) {
      case "hour":
        return this.hour;
      case "minute":
        return this.minute;
      case "second":
        return this.second;
      case "millisecond":
        return this.millisecond;
      case "microsecond":
        return this.microsecond;
      case "nanosecond":
        return this.nanosecond;
      case "offset":
        return this.offset;
      case "offsetMinutes":
        return this.offsetMinutes;
      default:
        return null;
    }
  }

  /**
   * Format timezone offset as +HH:MM or -HH:MM.
   */
  #formatOffset(): string {
    if (this.#offsetSeconds === 0) return "Z";

    const sign = this.#offsetSeconds >= 0 ? "+" : "-";
    const absSeconds = Math.abs(this.#offsetSeconds);
    const hours = Math.floor(absSeconds / 3600);
    const mins = Math.floor((absSeconds % 3600) / 60);

    return `${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  /**
   * Convert to ISO string with timezone offset.
   */
  public toString(): string {
    const h = String(this.#hour).padStart(2, "0");
    const m = String(this.#minute).padStart(2, "0");
    const s = String(this.#second).padStart(2, "0");

    let timeStr = `${h}:${m}:${s}`;
    if (this.#nanosecond > 0) {
      let nanos = String(this.#nanosecond).padStart(9, "0");
      nanos = nanos.replace(/0+$/, "");
      timeStr += `.${nanos}`;
    }

    return timeStr + this.#formatOffset();
  }

  public compareTo(other: TimeValue): number {
    // Compare by normalized UTC time
    const thisUTC = this.#hour * 3600 + this.#minute * 60 + this.#second - this.#offsetSeconds;
    const otherUTC = other.#hour * 3600 + other.#minute * 60 + other.#second - other.#offsetSeconds;

    if (thisUTC !== otherUTC) return thisUTC - otherUTC;
    return this.#nanosecond - other.#nanosecond;
  }
}

/**
 * LocalDateTimeValue - Represents a Cypher local datetime value (no timezone).
 *
 * Supports property access for:
 * - year, month, day, week, dayOfWeek, quarter, ordinalDay (from DateValue)
 * - hour, minute, second, millisecond, microsecond, nanosecond (from LocalTimeValue)
 */
export class LocalDateTimeValue implements TemporalValue {
  public readonly temporalType = "localdatetime";

  #year: number;
  #month: number;
  #day: number;
  #hour: number;
  #minute: number;
  #second: number;
  #nanosecond: number;

  public constructor(
    year: number,
    month: number,
    day: number,
    hour: number = 0,
    minute: number = 0,
    second: number = 0,
    nanosecond: number = 0,
  ) {
    this.#year = year;
    this.#month = month;
    this.#day = day;
    this.#hour = hour;
    this.#minute = minute;
    this.#second = second;
    this.#nanosecond = nanosecond;
  }

  /**
   * Create a LocalDateTimeValue from an ISO datetime string.
   * Format: YYYY-MM-DDTHH:MM:SS.nnnnnnnnn
   */
  public static fromString(iso: string): LocalDateTimeValue | null {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/);
    if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5] || !match[6])
      return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = parseInt(match[6], 10);

    let nanosecond = 0;
    if (match[7]) {
      const frac = match[7].padEnd(9, "0");
      nanosecond = parseInt(frac, 10);
    }

    return new LocalDateTimeValue(year, month, day, hour, minute, second, nanosecond);
  }

  /**
   * Create a LocalDateTimeValue from a map of components.
   */
  public static fromMap(map: Record<string, unknown>): LocalDateTimeValue | null {
    const year = typeof map.year === "number" ? map.year : null;
    const month = typeof map.month === "number" ? map.month : null;
    const day = typeof map.day === "number" ? map.day : null;

    if (year === null || month === null || day === null) return null;

    const hour = typeof map.hour === "number" ? map.hour : 0;
    const minute = typeof map.minute === "number" ? map.minute : 0;
    const second = typeof map.second === "number" ? map.second : 0;
    const nanosecond = typeof map.nanosecond === "number" ? map.nanosecond : 0;

    return new LocalDateTimeValue(year, month, day, hour, minute, second, nanosecond);
  }

  // Date properties
  public get year(): number {
    return this.#year;
  }

  public get month(): number {
    return this.#month;
  }

  public get day(): number {
    return this.#day;
  }

  public get week(): number {
    const date = new Date(Date.UTC(this.#year, this.#month - 1, this.#day));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  public get dayOfWeek(): number {
    const date = new Date(this.#year, this.#month - 1, this.#day);
    const dow = date.getDay();
    return dow === 0 ? 7 : dow;
  }

  public get quarter(): number {
    return Math.ceil(this.#month / 3);
  }

  public get ordinalDay(): number {
    const date = new Date(Date.UTC(this.#year, this.#month - 1, this.#day));
    const startOfYear = new Date(Date.UTC(this.#year, 0, 0));
    const diff = date.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  // Time properties
  public get hour(): number {
    return this.#hour;
  }

  public get minute(): number {
    return this.#minute;
  }

  public get second(): number {
    return this.#second;
  }

  public get millisecond(): number {
    return Math.floor(this.#nanosecond / 1_000_000);
  }

  public get microsecond(): number {
    return Math.floor(this.#nanosecond / 1_000);
  }

  public get nanosecond(): number {
    return this.#nanosecond;
  }

  public get(property: string): unknown {
    switch (property) {
      case "year":
        return this.year;
      case "month":
        return this.month;
      case "day":
        return this.day;
      case "week":
        return this.week;
      case "dayOfWeek":
        return this.dayOfWeek;
      case "quarter":
        return this.quarter;
      case "ordinalDay":
        return this.ordinalDay;
      case "hour":
        return this.hour;
      case "minute":
        return this.minute;
      case "second":
        return this.second;
      case "millisecond":
        return this.millisecond;
      case "microsecond":
        return this.microsecond;
      case "nanosecond":
        return this.nanosecond;
      default:
        return null;
    }
  }

  /**
   * Convert to ISO string (YYYY-MM-DDTHH:MM:SS.nnnnnnnnn).
   */
  public toString(): string {
    const y = String(this.#year).padStart(4, "0");
    const mo = String(this.#month).padStart(2, "0");
    const d = String(this.#day).padStart(2, "0");
    const h = String(this.#hour).padStart(2, "0");
    const mi = String(this.#minute).padStart(2, "0");
    const s = String(this.#second).padStart(2, "0");

    let result = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
    if (this.#nanosecond > 0) {
      let nanos = String(this.#nanosecond).padStart(9, "0");
      nanos = nanos.replace(/0+$/, "");
      result += `.${nanos}`;
    }

    return result;
  }

  public compareTo(other: LocalDateTimeValue): number {
    if (this.#year !== other.#year) return this.#year - other.#year;
    if (this.#month !== other.#month) return this.#month - other.#month;
    if (this.#day !== other.#day) return this.#day - other.#day;
    if (this.#hour !== other.#hour) return this.#hour - other.#hour;
    if (this.#minute !== other.#minute) return this.#minute - other.#minute;
    if (this.#second !== other.#second) return this.#second - other.#second;
    return this.#nanosecond - other.#nanosecond;
  }
}

/**
 * DateTimeValue - Represents a Cypher datetime value with timezone.
 *
 * Supports property access for:
 * - All properties from LocalDateTimeValue
 * - offset: The timezone offset in seconds
 * - offsetMinutes: The timezone offset in minutes
 * - timezone: The timezone name (if provided)
 */
export class DateTimeValue implements TemporalValue {
  public readonly temporalType = "datetime";

  #year: number;
  #month: number;
  #day: number;
  #hour: number;
  #minute: number;
  #second: number;
  #nanosecond: number;
  #offsetSeconds: number;
  #timezone: string | null;

  public constructor(
    year: number,
    month: number,
    day: number,
    hour: number = 0,
    minute: number = 0,
    second: number = 0,
    nanosecond: number = 0,
    offsetSeconds: number = 0,
    timezone: string | null = null,
  ) {
    this.#year = year;
    this.#month = month;
    this.#day = day;
    this.#hour = hour;
    this.#minute = minute;
    this.#second = second;
    this.#nanosecond = nanosecond;
    this.#offsetSeconds = offsetSeconds;
    this.#timezone = timezone;
  }

  /**
   * Create a DateTimeValue from an ISO datetime string with timezone.
   * Format: YYYY-MM-DDTHH:MM:SS.nnnnnnnnn+HH:MM or YYYY-MM-DDTHH:MM:SS.nnnnnnnnn[TZ]
   */
  public static fromString(iso: string): DateTimeValue | null {
    // Match datetime with timezone offset or named timezone
    const match = iso.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))?(?:\[([^\]]+)\])?$/,
    );
    if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5] || !match[6])
      return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = parseInt(match[6], 10);

    let nanosecond = 0;
    if (match[7]) {
      const frac = match[7].padEnd(9, "0");
      nanosecond = parseInt(frac, 10);
    }

    // Parse timezone offset
    let offsetSeconds = 0;
    if (match[8] === "Z") {
      offsetSeconds = 0;
    } else if (match[9] && match[10] && match[11]) {
      const sign = match[9] === "+" ? 1 : -1;
      const offsetHours = parseInt(match[10], 10);
      const offsetMins = parseInt(match[11], 10);
      offsetSeconds = sign * (offsetHours * 3600 + offsetMins * 60);
    }

    // Named timezone
    const timezone = match[12] || null;

    // If we have a named timezone but no offset, try to compute offset
    // For now, just store the timezone name without computing offset
    // A full implementation would use a timezone database

    return new DateTimeValue(
      year,
      month,
      day,
      hour,
      minute,
      second,
      nanosecond,
      offsetSeconds,
      timezone,
    );
  }

  /**
   * Create a DateTimeValue from a map of components.
   */
  public static fromMap(map: Record<string, unknown>): DateTimeValue | null {
    const year = typeof map.year === "number" ? map.year : null;
    const month = typeof map.month === "number" ? map.month : null;
    const day = typeof map.day === "number" ? map.day : null;

    if (year === null || month === null || day === null) return null;

    const hour = typeof map.hour === "number" ? map.hour : 0;
    const minute = typeof map.minute === "number" ? map.minute : 0;
    const second = typeof map.second === "number" ? map.second : 0;
    const nanosecond = typeof map.nanosecond === "number" ? map.nanosecond : 0;
    const offsetSeconds = typeof map.offset === "number" ? map.offset : 0;
    const timezone = typeof map.timezone === "string" ? map.timezone : null;

    return new DateTimeValue(
      year,
      month,
      day,
      hour,
      minute,
      second,
      nanosecond,
      offsetSeconds,
      timezone,
    );
  }

  // Date properties
  public get year(): number {
    return this.#year;
  }

  public get month(): number {
    return this.#month;
  }

  public get day(): number {
    return this.#day;
  }

  public get week(): number {
    const date = new Date(Date.UTC(this.#year, this.#month - 1, this.#day));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  public get dayOfWeek(): number {
    const date = new Date(this.#year, this.#month - 1, this.#day);
    const dow = date.getDay();
    return dow === 0 ? 7 : dow;
  }

  public get quarter(): number {
    return Math.ceil(this.#month / 3);
  }

  public get ordinalDay(): number {
    const date = new Date(Date.UTC(this.#year, this.#month - 1, this.#day));
    const startOfYear = new Date(Date.UTC(this.#year, 0, 0));
    const diff = date.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  // Time properties
  public get hour(): number {
    return this.#hour;
  }

  public get minute(): number {
    return this.#minute;
  }

  public get second(): number {
    return this.#second;
  }

  public get millisecond(): number {
    return Math.floor(this.#nanosecond / 1_000_000);
  }

  public get microsecond(): number {
    return Math.floor(this.#nanosecond / 1_000);
  }

  public get nanosecond(): number {
    return this.#nanosecond;
  }

  // Timezone properties
  public get offset(): number {
    return this.#offsetSeconds;
  }

  public get offsetMinutes(): number {
    return Math.floor(this.#offsetSeconds / 60);
  }

  public get timezone(): string | null {
    return this.#timezone;
  }

  /**
   * Get the epoch seconds (seconds since 1970-01-01T00:00:00Z).
   */
  public get epochSeconds(): number {
    const date = new Date(
      Date.UTC(this.#year, this.#month - 1, this.#day, this.#hour, this.#minute, this.#second),
    );
    // Adjust for timezone offset
    const ms = date.getTime() - this.#offsetSeconds * 1000;
    return Math.floor(ms / 1000) + Math.floor(this.#nanosecond / 1_000_000_000);
  }

  /**
   * Get the epoch milliseconds (milliseconds since 1970-01-01T00:00:00Z).
   */
  public get epochMillis(): number {
    const date = new Date(
      Date.UTC(this.#year, this.#month - 1, this.#day, this.#hour, this.#minute, this.#second),
    );
    // Adjust for timezone offset
    const ms = date.getTime() - this.#offsetSeconds * 1000;
    return ms + Math.floor(this.#nanosecond / 1_000_000);
  }

  public get(property: string): unknown {
    switch (property) {
      case "year":
        return this.year;
      case "month":
        return this.month;
      case "day":
        return this.day;
      case "week":
        return this.week;
      case "dayOfWeek":
        return this.dayOfWeek;
      case "quarter":
        return this.quarter;
      case "ordinalDay":
        return this.ordinalDay;
      case "hour":
        return this.hour;
      case "minute":
        return this.minute;
      case "second":
        return this.second;
      case "millisecond":
        return this.millisecond;
      case "microsecond":
        return this.microsecond;
      case "nanosecond":
        return this.nanosecond;
      case "offset":
        return this.offset;
      case "offsetMinutes":
        return this.offsetMinutes;
      case "timezone":
        return this.timezone;
      case "epochSeconds":
        return this.epochSeconds;
      case "epochMillis":
        return this.epochMillis;
      default:
        return null;
    }
  }

  /**
   * Format timezone offset as +HH:MM or -HH:MM.
   */
  #formatOffset(): string {
    if (this.#offsetSeconds === 0 && !this.#timezone) return "Z";

    const sign = this.#offsetSeconds >= 0 ? "+" : "-";
    const absSeconds = Math.abs(this.#offsetSeconds);
    const hours = Math.floor(absSeconds / 3600);
    const mins = Math.floor((absSeconds % 3600) / 60);

    return `${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  /**
   * Convert to ISO string with timezone.
   */
  public toString(): string {
    const y = String(this.#year).padStart(4, "0");
    const mo = String(this.#month).padStart(2, "0");
    const d = String(this.#day).padStart(2, "0");
    const h = String(this.#hour).padStart(2, "0");
    const mi = String(this.#minute).padStart(2, "0");
    const s = String(this.#second).padStart(2, "0");

    let result = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
    if (this.#nanosecond > 0) {
      let nanos = String(this.#nanosecond).padStart(9, "0");
      nanos = nanos.replace(/0+$/, "");
      result += `.${nanos}`;
    }

    result += this.#formatOffset();

    if (this.#timezone) {
      result += `[${this.#timezone}]`;
    }

    return result;
  }

  public compareTo(other: DateTimeValue): number {
    // Compare by UTC instant
    const thisUTC =
      new Date(
        Date.UTC(this.#year, this.#month - 1, this.#day, this.#hour, this.#minute, this.#second),
      ).getTime() -
      this.#offsetSeconds * 1000;
    const otherUTC =
      new Date(
        Date.UTC(
          other.#year,
          other.#month - 1,
          other.#day,
          other.#hour,
          other.#minute,
          other.#second,
        ),
      ).getTime() -
      other.#offsetSeconds * 1000;

    if (thisUTC !== otherUTC) return thisUTC - otherUTC;
    return this.#nanosecond - other.#nanosecond;
  }
}

/**
 * DurationValue - Represents a Cypher duration value.
 *
 * Duration in Cypher has four components:
 * - months: Number of months (can be negative)
 * - days: Number of days (can be negative)
 * - seconds: Number of seconds (can be negative)
 * - nanoseconds: Additional nanoseconds (can be negative)
 *
 * ISO 8601 duration format: P[n]Y[n]M[n]DT[n]H[n]M[n]S
 * Examples:
 * - P1Y2M3D = 1 year, 2 months, 3 days
 * - PT1H30M = 1 hour, 30 minutes
 * - P1DT12H = 1 day, 12 hours
 * - P14D = 14 days (or P2W)
 */
export class DurationValue implements TemporalValue {
  public readonly temporalType = "duration";

  #months: number;
  #days: number;
  #seconds: number;
  #nanoseconds: number;

  public constructor(
    months: number = 0,
    days: number = 0,
    seconds: number = 0,
    nanoseconds: number = 0,
  ) {
    this.#months = months;
    this.#days = days;
    this.#seconds = seconds;
    this.#nanoseconds = nanoseconds;
  }

  /**
   * Create a DurationValue from an ISO 8601 duration string.
   * Format: P[n]Y[n]M[n]W[n]DT[n]H[n]M[n]S
   */
  public static fromString(iso: string): DurationValue | null {
    // Handle negative durations
    let isNegative = false;
    let str = iso;
    if (str.startsWith("-")) {
      isNegative = true;
      str = str.substring(1);
    }

    if (!str.startsWith("P")) return null;
    str = str.substring(1);

    let months = 0;
    let days = 0;
    let seconds = 0;
    let nanoseconds = 0;

    // Split by T to separate date and time parts
    const parts = str.split("T");
    const datePart = parts[0] || "";
    const timePart = parts[1] || "";

    // Parse date part (years, months, weeks, days)
    // Match patterns like "1Y", "2M", "1W", "3D"
    const datePattern = /(-?\d+(?:\.\d+)?)(Y|M|W|D)/g;
    let match: RegExpExecArray | null;
    while ((match = datePattern.exec(datePart)) !== null) {
      const value = parseFloat(match[1] ?? "0");
      const unit = match[2];
      switch (unit) {
        case "Y":
          months += value * 12;
          break;
        case "M":
          months += value;
          break;
        case "W":
          days += value * 7;
          break;
        case "D":
          days += value;
          break;
      }
    }

    // Parse time part (hours, minutes, seconds)
    // Match patterns like "1H", "30M", "15.5S"
    const timePattern = /(-?\d+(?:\.\d+)?)(H|M|S)/g;
    while ((match = timePattern.exec(timePart)) !== null) {
      const value = parseFloat(match[1] ?? "0");
      const unit = match[2];
      switch (unit) {
        case "H":
          seconds += value * 3600;
          break;
        case "M":
          seconds += value * 60;
          break;
        case "S":
          // Handle fractional seconds
          const wholePart = Math.trunc(value);
          const fracPart = value - wholePart;
          seconds += wholePart;
          nanoseconds += Math.round(fracPart * 1_000_000_000);
          break;
      }
    }

    // Apply negation if needed
    if (isNegative) {
      months = -months;
      days = -days;
      seconds = -seconds;
      nanoseconds = -nanoseconds;
    }

    return new DurationValue(months, days, seconds, nanoseconds);
  }

  /**
   * Create a DurationValue from a map of components.
   */
  public static fromMap(map: Record<string, unknown>): DurationValue | null {
    let months = 0;
    let days = 0;
    let seconds = 0;
    let nanoseconds = 0;

    // Handle years
    if (typeof map.years === "number") {
      months += map.years * 12;
    }
    // Handle months
    if (typeof map.months === "number") {
      months += map.months;
    }
    // Handle weeks
    if (typeof map.weeks === "number") {
      days += map.weeks * 7;
    }
    // Handle days
    if (typeof map.days === "number") {
      days += map.days;
    }
    // Handle hours
    if (typeof map.hours === "number") {
      seconds += map.hours * 3600;
    }
    // Handle minutes
    if (typeof map.minutes === "number") {
      seconds += map.minutes * 60;
    }
    // Handle seconds
    if (typeof map.seconds === "number") {
      seconds += map.seconds;
    }
    // Handle milliseconds
    if (typeof map.milliseconds === "number") {
      nanoseconds += map.milliseconds * 1_000_000;
    }
    // Handle microseconds
    if (typeof map.microseconds === "number") {
      nanoseconds += map.microseconds * 1_000;
    }
    // Handle nanoseconds
    if (typeof map.nanoseconds === "number") {
      nanoseconds += map.nanoseconds;
    }

    return new DurationValue(months, days, seconds, nanoseconds);
  }

  // Component accessors
  public get months(): number {
    return this.#months;
  }

  public get days(): number {
    return this.#days;
  }

  public get seconds(): number {
    return this.#seconds;
  }

  public get nanoseconds(): number {
    return this.#nanoseconds;
  }

  // Derived accessors (per Cypher spec)
  public get years(): number {
    return Math.trunc(this.#months / 12);
  }

  public get monthsOfYear(): number {
    return this.#months % 12;
  }

  public get hours(): number {
    return Math.trunc(this.#seconds / 3600);
  }

  public get minutesOfHour(): number {
    return Math.trunc((this.#seconds % 3600) / 60);
  }

  public get secondsOfMinute(): number {
    return this.#seconds % 60;
  }

  public get milliseconds(): number {
    return Math.trunc(this.#nanoseconds / 1_000_000);
  }

  public get microsecondsOfSecond(): number {
    return Math.trunc(this.#nanoseconds / 1_000);
  }

  public get nanosecondsOfSecond(): number {
    return this.#nanoseconds;
  }

  public get(property: string): unknown {
    switch (property) {
      case "years":
        return this.years;
      case "months":
        return this.#months;
      case "monthsOfYear":
        return this.monthsOfYear;
      case "days":
        return this.#days;
      case "hours":
        return this.hours;
      case "minutesOfHour":
        return this.minutesOfHour;
      case "seconds":
        return this.#seconds;
      case "secondsOfMinute":
        return this.secondsOfMinute;
      case "milliseconds":
        return this.milliseconds;
      case "microsecondsOfSecond":
        return this.microsecondsOfSecond;
      case "nanoseconds":
        return this.#nanoseconds;
      case "nanosecondsOfSecond":
        return this.nanosecondsOfSecond;
      default:
        return null;
    }
  }

  /**
   * Convert to ISO 8601 duration string.
   */
  public toString(): string {
    const parts: string[] = [];

    // Determine if overall negative
    const isNegative = this.#months < 0 || this.#days < 0 || this.#seconds < 0;

    // Use absolute values for formatting
    const absMonths = Math.abs(this.#months);
    const absDays = Math.abs(this.#days);
    const absSeconds = Math.abs(this.#seconds);
    const absNanos = Math.abs(this.#nanoseconds);

    // Date part
    const years = Math.trunc(absMonths / 12);
    const monthsOfYear = absMonths % 12;
    if (years > 0) parts.push(`${years}Y`);
    if (monthsOfYear > 0) parts.push(`${monthsOfYear}M`);
    if (absDays > 0) parts.push(`${absDays}D`);

    // Time part
    const timeParts: string[] = [];
    const hours = Math.trunc(absSeconds / 3600);
    const minutes = Math.trunc((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;

    if (hours > 0) timeParts.push(`${hours}H`);
    if (minutes > 0) timeParts.push(`${minutes}M`);
    if (secs > 0 || absNanos > 0) {
      if (absNanos > 0) {
        // Format with fractional seconds
        let nanosStr = String(absNanos).padStart(9, "0");
        nanosStr = nanosStr.replace(/0+$/, ""); // Remove trailing zeros
        timeParts.push(`${secs}.${nanosStr}S`);
      } else {
        timeParts.push(`${secs}S`);
      }
    }

    let result = "P";
    if (parts.length > 0) {
      result += parts.join("");
    }
    if (timeParts.length > 0) {
      result += "T" + timeParts.join("");
    }

    // Handle empty duration
    if (result === "P") {
      result = "PT0S";
    }

    return isNegative ? "-" + result : result;
  }

  /**
   * Add this duration to another duration.
   */
  public plus(other: DurationValue): DurationValue {
    return new DurationValue(
      this.#months + other.#months,
      this.#days + other.#days,
      this.#seconds + other.#seconds,
      this.#nanoseconds + other.#nanoseconds,
    );
  }

  /**
   * Subtract another duration from this duration.
   */
  public minus(other: DurationValue): DurationValue {
    return new DurationValue(
      this.#months - other.#months,
      this.#days - other.#days,
      this.#seconds - other.#seconds,
      this.#nanoseconds - other.#nanoseconds,
    );
  }

  /**
   * Multiply this duration by a scalar.
   */
  public multiply(scalar: number): DurationValue {
    return new DurationValue(
      Math.trunc(this.#months * scalar),
      Math.trunc(this.#days * scalar),
      Math.trunc(this.#seconds * scalar),
      Math.trunc(this.#nanoseconds * scalar),
    );
  }

  /**
   * Divide this duration by a scalar.
   */
  public divide(scalar: number): DurationValue {
    if (scalar === 0) return new DurationValue(0, 0, 0, 0);
    return new DurationValue(
      Math.trunc(this.#months / scalar),
      Math.trunc(this.#days / scalar),
      Math.trunc(this.#seconds / scalar),
      Math.trunc(this.#nanoseconds / scalar),
    );
  }

  /**
   * Negate this duration.
   */
  public negate(): DurationValue {
    return new DurationValue(-this.#months, -this.#days, -this.#seconds, -this.#nanoseconds);
  }

  /**
   * Compare two durations for equality.
   * Note: Durations with different representations may be equal (e.g., P14D = P2W)
   */
  public equals(other: DurationValue): boolean {
    return (
      this.#months === other.#months &&
      this.#days === other.#days &&
      this.#seconds === other.#seconds &&
      this.#nanoseconds === other.#nanoseconds
    );
  }
}

/**
 * Helper to get the last day of a month.
 */
function getLastDayOfMonth(year: number, month: number): number {
  // Month is 1-indexed (1 = January)
  // Create date for first day of next month, then go back one day
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Add months to a date with proper month-end handling.
 * If the original day exceeds the days in the target month, clamp to the last day.
 * For example: January 31 + 1 month = February 28 (or 29 in leap year)
 */
function addMonthsToDate(
  year: number,
  month: number,
  day: number,
  monthsToAdd: number,
): { year: number; month: number; day: number } {
  // Calculate target year and month
  let totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;

  // Handle negative months
  let finalYear = targetYear;
  let finalMonth = targetMonth;
  if (finalMonth <= 0) {
    finalYear -= 1;
    finalMonth += 12;
  }

  // Clamp day to last day of target month if necessary
  const lastDay = getLastDayOfMonth(finalYear, finalMonth);
  const finalDay = Math.min(day, lastDay);

  return { year: finalYear, month: finalMonth, day: finalDay };
}

/**
 * Add a duration to a temporal value.
 */
export function addDuration(
  temporal: TemporalValue,
  duration: DurationValue,
): TemporalValue | null {
  if (temporal instanceof DateValue) {
    // Add months with proper month-end handling
    const afterMonths = addMonthsToDate(
      temporal.year,
      temporal.month,
      temporal.day,
      duration.months,
    );

    // Now add days
    const date = new Date(
      Date.UTC(afterMonths.year, afterMonths.month - 1, afterMonths.day + duration.days),
    );

    // Add time components (convert to days)
    const totalSeconds = duration.seconds + duration.nanoseconds / 1_000_000_000;
    const additionalDays = Math.floor(totalSeconds / 86400);
    date.setUTCDate(date.getUTCDate() + additionalDays);

    return new DateValue(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  if (temporal instanceof LocalTimeValue) {
    // Add duration to local time (only time components matter, wraps at 24h)
    let totalNanos =
      temporal.hour * 3_600_000_000_000 +
      temporal.minute * 60_000_000_000 +
      temporal.second * 1_000_000_000 +
      temporal.nanosecond +
      duration.seconds * 1_000_000_000 +
      duration.nanoseconds;

    // Handle days overflow (wrap around 24 hours)
    const nanosPerDay = 86_400_000_000_000;
    totalNanos = ((totalNanos % nanosPerDay) + nanosPerDay) % nanosPerDay;

    const hour = Math.floor(totalNanos / 3_600_000_000_000);
    const remainingAfterHours = totalNanos % 3_600_000_000_000;
    const minute = Math.floor(remainingAfterHours / 60_000_000_000);
    const remainingAfterMinutes = remainingAfterHours % 60_000_000_000;
    const second = Math.floor(remainingAfterMinutes / 1_000_000_000);
    const nanosecond = Math.round(remainingAfterMinutes % 1_000_000_000);

    return new LocalTimeValue(hour, minute, second, nanosecond);
  }

  if (temporal instanceof TimeValue) {
    // Add duration to time with offset
    let totalNanos =
      temporal.hour * 3_600_000_000_000 +
      temporal.minute * 60_000_000_000 +
      temporal.second * 1_000_000_000 +
      temporal.nanosecond +
      duration.seconds * 1_000_000_000 +
      duration.nanoseconds;

    // Handle days overflow (wrap around 24 hours)
    const nanosPerDay = 86_400_000_000_000;
    totalNanos = ((totalNanos % nanosPerDay) + nanosPerDay) % nanosPerDay;

    const hour = Math.floor(totalNanos / 3_600_000_000_000);
    const remainingAfterHours = totalNanos % 3_600_000_000_000;
    const minute = Math.floor(remainingAfterHours / 60_000_000_000);
    const remainingAfterMinutes = remainingAfterHours % 60_000_000_000;
    const second = Math.floor(remainingAfterMinutes / 1_000_000_000);
    const nanosecond = Math.round(remainingAfterMinutes % 1_000_000_000);

    return new TimeValue(hour, minute, second, nanosecond, temporal.offset);
  }

  if (temporal instanceof LocalDateTimeValue) {
    // Add months with proper month-end handling
    const afterMonths = addMonthsToDate(
      temporal.year,
      temporal.month,
      temporal.day,
      duration.months,
    );

    // Add duration to local datetime (days are added directly)
    const date = new Date(
      Date.UTC(
        afterMonths.year,
        afterMonths.month - 1,
        afterMonths.day + duration.days,
        temporal.hour,
        temporal.minute,
        temporal.second,
      ),
    );

    // Add seconds and nanoseconds
    // Note: Nanosecond precision beyond milliseconds is preserved in the nanosecond component,
    // but the Date object only has millisecond precision for the time calculation.
    const totalMs =
      date.getTime() + (duration.seconds * 1000 + Math.floor(duration.nanoseconds / 1_000_000));
    const resultDate = new Date(totalMs);

    // Compute nanoseconds - preserve sub-millisecond precision
    const nanosecondRemainder = duration.nanoseconds % 1_000_000;
    const resultNanos = temporal.nanosecond + nanosecondRemainder;
    const normalizedNanos = ((resultNanos % 1_000_000_000) + 1_000_000_000) % 1_000_000_000;

    return new LocalDateTimeValue(
      resultDate.getUTCFullYear(),
      resultDate.getUTCMonth() + 1,
      resultDate.getUTCDate(),
      resultDate.getUTCHours(),
      resultDate.getUTCMinutes(),
      resultDate.getUTCSeconds(),
      normalizedNanos,
    );
  }

  if (temporal instanceof DateTimeValue) {
    // Add months with proper month-end handling
    const afterMonths = addMonthsToDate(
      temporal.year,
      temporal.month,
      temporal.day,
      duration.months,
    );

    // Add duration to datetime with timezone (days are added directly)
    const date = new Date(
      Date.UTC(
        afterMonths.year,
        afterMonths.month - 1,
        afterMonths.day + duration.days,
        temporal.hour,
        temporal.minute,
        temporal.second,
      ),
    );

    // Add seconds and nanoseconds
    // Note: Nanosecond precision beyond milliseconds is preserved in the nanosecond component,
    // but the Date object only has millisecond precision for the time calculation.
    const totalMs =
      date.getTime() + (duration.seconds * 1000 + Math.floor(duration.nanoseconds / 1_000_000));
    const resultDate = new Date(totalMs);

    // Compute nanoseconds - preserve sub-millisecond precision
    const nanosecondRemainder = duration.nanoseconds % 1_000_000;
    const resultNanos = temporal.nanosecond + nanosecondRemainder;
    const normalizedNanos = ((resultNanos % 1_000_000_000) + 1_000_000_000) % 1_000_000_000;

    return new DateTimeValue(
      resultDate.getUTCFullYear(),
      resultDate.getUTCMonth() + 1,
      resultDate.getUTCDate(),
      resultDate.getUTCHours(),
      resultDate.getUTCMinutes(),
      resultDate.getUTCSeconds(),
      normalizedNanos,
      temporal.offset,
      temporal.timezone,
    );
  }

  return null;
}

/**
 * Subtract a duration from a temporal value.
 */
export function subtractDuration(
  temporal: TemporalValue,
  duration: DurationValue,
): TemporalValue | null {
  return addDuration(temporal, duration.negate());
}

/**
 * Compute the duration between two temporal values.
 */
export function durationBetween(start: TemporalValue, end: TemporalValue): DurationValue | null {
  // Handle dates
  if (start instanceof DateValue && end instanceof DateValue) {
    const _startDate = new Date(Date.UTC(start.year, start.month - 1, start.day));
    const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day));

    // Calculate difference in months
    let months = (end.year - start.year) * 12 + (end.month - start.month);

    // Adjust for day difference
    if (end.day < start.day) {
      months--;
    }

    // Calculate remaining days
    const adjustedStart = new Date(Date.UTC(start.year, start.month - 1 + months, start.day));
    const days = Math.round((endDate.getTime() - adjustedStart.getTime()) / (24 * 60 * 60 * 1000));

    return new DurationValue(months, days, 0, 0);
  }

  // Handle local times
  if (start instanceof LocalTimeValue && end instanceof LocalTimeValue) {
    const startNanos =
      start.hour * 3_600_000_000_000 +
      start.minute * 60_000_000_000 +
      start.second * 1_000_000_000 +
      start.nanosecond;
    const endNanos =
      end.hour * 3_600_000_000_000 +
      end.minute * 60_000_000_000 +
      end.second * 1_000_000_000 +
      end.nanosecond;

    const diffNanos = endNanos - startNanos;
    const seconds = Math.trunc(diffNanos / 1_000_000_000);
    const nanoseconds = diffNanos % 1_000_000_000;

    return new DurationValue(0, 0, seconds, nanoseconds);
  }

  // Handle times with offset (convert to common reference)
  if (start instanceof TimeValue && end instanceof TimeValue) {
    const startNanos =
      (start.hour * 3600 + start.minute * 60 + start.second - start.offset) * 1_000_000_000 +
      start.nanosecond;
    const endNanos =
      (end.hour * 3600 + end.minute * 60 + end.second - end.offset) * 1_000_000_000 +
      end.nanosecond;

    const diffNanos = endNanos - startNanos;
    const seconds = Math.trunc(diffNanos / 1_000_000_000);
    const nanoseconds = diffNanos % 1_000_000_000;

    return new DurationValue(0, 0, seconds, nanoseconds);
  }

  // Handle local datetimes
  if (start instanceof LocalDateTimeValue && end instanceof LocalDateTimeValue) {
    // Calculate months difference
    let months = (end.year - start.year) * 12 + (end.month - start.month);
    if (end.day < start.day) {
      months--;
    }

    // Calculate days
    const adjustedStart = new Date(
      Date.UTC(
        start.year,
        start.month - 1 + months,
        start.day,
        start.hour,
        start.minute,
        start.second,
      ),
    );
    const endDatetime = new Date(
      Date.UTC(end.year, end.month - 1, end.day, end.hour, end.minute, end.second),
    );

    const diffMs = endDatetime.getTime() - adjustedStart.getTime();
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const remainingMs = diffMs % (24 * 60 * 60 * 1000);
    const seconds = Math.floor(remainingMs / 1000);
    const nanoseconds = (remainingMs % 1000) * 1_000_000 + (end.nanosecond - start.nanosecond);

    return new DurationValue(months, days, seconds, nanoseconds);
  }

  // Handle datetimes with timezone
  if (start instanceof DateTimeValue && end instanceof DateTimeValue) {
    // Calculate months difference
    let months = (end.year - start.year) * 12 + (end.month - start.month);
    if (end.day < start.day) {
      months--;
    }

    // Calculate days (accounting for offset)
    const adjustedStart = new Date(
      Date.UTC(
        start.year,
        start.month - 1 + months,
        start.day,
        start.hour,
        start.minute,
        start.second,
      ),
    );
    adjustedStart.setTime(adjustedStart.getTime() - start.offset * 1000);

    const endDatetime = new Date(
      Date.UTC(end.year, end.month - 1, end.day, end.hour, end.minute, end.second),
    );
    endDatetime.setTime(endDatetime.getTime() - end.offset * 1000);

    const diffMs = endDatetime.getTime() - adjustedStart.getTime();
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const remainingMs = diffMs % (24 * 60 * 60 * 1000);
    const seconds = Math.floor(remainingMs / 1000);
    const nanoseconds = (remainingMs % 1000) * 1_000_000 + (end.nanosecond - start.nanosecond);

    return new DurationValue(months, days, seconds, nanoseconds);
  }

  return null;
}

/**
 * Compute the duration between two temporal values in months only.
 */
export function durationInMonths(start: TemporalValue, end: TemporalValue): DurationValue | null {
  if (
    (start instanceof DateValue ||
      start instanceof LocalDateTimeValue ||
      start instanceof DateTimeValue) &&
    (end instanceof DateValue || end instanceof LocalDateTimeValue || end instanceof DateTimeValue)
  ) {
    const startYear = start.year;
    const startMonth = start.month;
    const endYear = end.year;
    const endMonth = end.month;

    let months = (endYear - startYear) * 12 + (endMonth - startMonth);
    const startDay = start.day;
    const endDay = end.day;

    if (endDay < startDay) {
      months--;
    }

    return new DurationValue(months, 0, 0, 0);
  }
  return null;
}

/**
 * Compute the duration between two temporal values in days only.
 */
export function durationInDays(start: TemporalValue, end: TemporalValue): DurationValue | null {
  if (
    (start instanceof DateValue ||
      start instanceof LocalDateTimeValue ||
      start instanceof DateTimeValue) &&
    (end instanceof DateValue || end instanceof LocalDateTimeValue || end instanceof DateTimeValue)
  ) {
    const startDate = new Date(Date.UTC(start.year, start.month - 1, start.day));
    const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day));
    const diffMs = endDate.getTime() - startDate.getTime();
    const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
    return new DurationValue(0, days, 0, 0);
  }
  return null;
}

/**
 * Compute the duration between two temporal values in seconds only.
 */
export function durationInSeconds(start: TemporalValue, end: TemporalValue): DurationValue | null {
  // Handle time types
  if (
    (start instanceof LocalTimeValue || start instanceof TimeValue) &&
    (end instanceof LocalTimeValue || end instanceof TimeValue)
  ) {
    let startSeconds: number;
    let endSeconds: number;

    if (start instanceof TimeValue) {
      startSeconds = start.hour * 3600 + start.minute * 60 + start.second - start.offset;
    } else {
      startSeconds = start.hour * 3600 + start.minute * 60 + start.second;
    }

    if (end instanceof TimeValue) {
      endSeconds = end.hour * 3600 + end.minute * 60 + end.second - end.offset;
    } else {
      endSeconds = end.hour * 3600 + end.minute * 60 + end.second;
    }

    const seconds = endSeconds - startSeconds;
    const nanoseconds =
      (end instanceof LocalTimeValue ? end.nanosecond : end.nanosecond) -
      (start instanceof LocalTimeValue ? start.nanosecond : start.nanosecond);

    return new DurationValue(0, 0, seconds, nanoseconds);
  }

  // Handle datetime types
  if (
    (start instanceof LocalDateTimeValue || start instanceof DateTimeValue) &&
    (end instanceof LocalDateTimeValue || end instanceof DateTimeValue)
  ) {
    const startDate = new Date(
      Date.UTC(start.year, start.month - 1, start.day, start.hour, start.minute, start.second),
    );
    if (start instanceof DateTimeValue) {
      startDate.setTime(startDate.getTime() - start.offset * 1000);
    }

    const endDate = new Date(
      Date.UTC(end.year, end.month - 1, end.day, end.hour, end.minute, end.second),
    );
    if (end instanceof DateTimeValue) {
      endDate.setTime(endDate.getTime() - end.offset * 1000);
    }

    const diffMs = endDate.getTime() - startDate.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const nanoseconds = (diffMs % 1000) * 1_000_000 + (end.nanosecond - start.nanosecond);

    return new DurationValue(0, 0, seconds, nanoseconds);
  }

  return null;
}

/**
 * Truncation units for temporal values
 */
export type TruncateUnit =
  | "millennium"
  | "century"
  | "decade"
  | "year"
  | "quarter"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "millisecond"
  | "microsecond";

/**
 * Truncate a date to a specific unit
 */
export function truncateDate(
  unit: TruncateUnit,
  date: DateValue,
  overrides?: Record<string, number>,
): DateValue {
  let year = date.year;
  let month = 1;
  let day = 1;

  switch (unit) {
    case "millennium":
      year = Math.floor((year - 1) / 1000) * 1000 + 1;
      break;
    case "century":
      year = Math.floor((year - 1) / 100) * 100 + 1;
      break;
    case "decade":
      year = Math.floor(year / 10) * 10;
      break;
    case "year":
      // Keep year, reset to Jan 1
      break;
    case "quarter":
      month = Math.floor((date.month - 1) / 3) * 3 + 1;
      break;
    case "month":
      month = date.month;
      break;
    case "week": {
      // Find Monday of the week (ISO week starts on Monday)
      const jsDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
      const dayOfWeek = jsDate.getUTCDay() || 7; // Convert Sunday=0 to 7
      jsDate.setUTCDate(jsDate.getUTCDate() - (dayOfWeek - 1));
      return new DateValue(
        jsDate.getUTCFullYear(),
        jsDate.getUTCMonth() + 1,
        overrides?.day ?? jsDate.getUTCDate(),
      );
    }
    case "day":
      month = date.month;
      day = date.day;
      break;
    default:
      // For time-based units, just return the date as-is
      month = date.month;
      day = date.day;
      break;
  }

  // Apply overrides
  if (overrides) {
    if (overrides.day !== undefined) day = overrides.day;
    if (overrides.month !== undefined) month = overrides.month;
  }

  return new DateValue(year, month, day);
}

/**
 * Truncate a datetime to a specific unit
 */
export function truncateDateTime(
  unit: TruncateUnit,
  dt: DateTimeValue,
  overrides?: Record<string, number>,
): DateTimeValue {
  let year = dt.year;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let nanosecond = 0;

  switch (unit) {
    case "millennium":
      year = Math.floor((year - 1) / 1000) * 1000 + 1;
      break;
    case "century":
      year = Math.floor((year - 1) / 100) * 100 + 1;
      break;
    case "decade":
      year = Math.floor(year / 10) * 10;
      break;
    case "year":
      break;
    case "quarter":
      month = Math.floor((dt.month - 1) / 3) * 3 + 1;
      break;
    case "month":
      month = dt.month;
      break;
    case "week": {
      const jsDate = new Date(Date.UTC(dt.year, dt.month - 1, dt.day));
      const dayOfWeek = jsDate.getUTCDay() || 7;
      jsDate.setUTCDate(jsDate.getUTCDate() - (dayOfWeek - 1));
      year = jsDate.getUTCFullYear();
      month = jsDate.getUTCMonth() + 1;
      day = overrides?.day ?? jsDate.getUTCDate();
      break;
    }
    case "day":
      month = dt.month;
      day = dt.day;
      break;
    case "hour":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      break;
    case "minute":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      minute = dt.minute;
      break;
    case "second":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      minute = dt.minute;
      second = dt.second;
      break;
    case "millisecond":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      minute = dt.minute;
      second = dt.second;
      nanosecond = Math.floor(dt.nanosecond / 1_000_000) * 1_000_000;
      break;
    case "microsecond":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      minute = dt.minute;
      second = dt.second;
      nanosecond = Math.floor(dt.nanosecond / 1_000) * 1_000;
      break;
  }

  // Apply overrides
  if (overrides) {
    if (overrides.day !== undefined) day = overrides.day;
    if (overrides.month !== undefined) month = overrides.month;
    if (overrides.hour !== undefined) hour = overrides.hour;
    if (overrides.minute !== undefined) minute = overrides.minute;
    if (overrides.second !== undefined) second = overrides.second;
  }

  return new DateTimeValue(
    year,
    month,
    day,
    hour,
    minute,
    second,
    nanosecond,
    dt.offset,
    dt.timezone,
  );
}

/**
 * Truncate a localdatetime to a specific unit
 */
export function truncateLocalDateTime(
  unit: TruncateUnit,
  dt: LocalDateTimeValue,
  overrides?: Record<string, number>,
): LocalDateTimeValue {
  let year = dt.year;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let nanosecond = 0;

  switch (unit) {
    case "millennium":
      year = Math.floor((year - 1) / 1000) * 1000 + 1;
      break;
    case "century":
      year = Math.floor((year - 1) / 100) * 100 + 1;
      break;
    case "decade":
      year = Math.floor(year / 10) * 10;
      break;
    case "year":
      break;
    case "quarter":
      month = Math.floor((dt.month - 1) / 3) * 3 + 1;
      break;
    case "month":
      month = dt.month;
      break;
    case "week": {
      const jsDate = new Date(Date.UTC(dt.year, dt.month - 1, dt.day));
      const dayOfWeek = jsDate.getUTCDay() || 7;
      jsDate.setUTCDate(jsDate.getUTCDate() - (dayOfWeek - 1));
      year = jsDate.getUTCFullYear();
      month = jsDate.getUTCMonth() + 1;
      day = overrides?.day ?? jsDate.getUTCDate();
      break;
    }
    case "day":
      month = dt.month;
      day = dt.day;
      break;
    case "hour":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      break;
    case "minute":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      minute = dt.minute;
      break;
    case "second":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      minute = dt.minute;
      second = dt.second;
      break;
    case "millisecond":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      minute = dt.minute;
      second = dt.second;
      nanosecond = Math.floor(dt.nanosecond / 1_000_000) * 1_000_000;
      break;
    case "microsecond":
      month = dt.month;
      day = dt.day;
      hour = dt.hour;
      minute = dt.minute;
      second = dt.second;
      nanosecond = Math.floor(dt.nanosecond / 1_000) * 1_000;
      break;
  }

  // Apply overrides
  if (overrides) {
    if (overrides.day !== undefined) day = overrides.day;
    if (overrides.month !== undefined) month = overrides.month;
    if (overrides.hour !== undefined) hour = overrides.hour;
    if (overrides.minute !== undefined) minute = overrides.minute;
    if (overrides.second !== undefined) second = overrides.second;
  }

  return new LocalDateTimeValue(year, month, day, hour, minute, second, nanosecond);
}

/**
 * Truncate a time to a specific unit
 */
export function truncateTime(
  unit: TruncateUnit,
  t: TimeValue,
  overrides?: Record<string, number>,
): TimeValue {
  let hour = 0;
  let minute = 0;
  let second = 0;
  let nanosecond = 0;

  switch (unit) {
    case "hour":
      hour = t.hour;
      break;
    case "minute":
      hour = t.hour;
      minute = t.minute;
      break;
    case "second":
      hour = t.hour;
      minute = t.minute;
      second = t.second;
      break;
    case "millisecond":
      hour = t.hour;
      minute = t.minute;
      second = t.second;
      nanosecond = Math.floor(t.nanosecond / 1_000_000) * 1_000_000;
      break;
    case "microsecond":
      hour = t.hour;
      minute = t.minute;
      second = t.second;
      nanosecond = Math.floor(t.nanosecond / 1_000) * 1_000;
      break;
    default:
      // For date-based units, return full time
      hour = t.hour;
      minute = t.minute;
      second = t.second;
      nanosecond = t.nanosecond;
      break;
  }

  // Apply overrides
  if (overrides) {
    if (overrides.hour !== undefined) hour = overrides.hour;
    if (overrides.minute !== undefined) minute = overrides.minute;
    if (overrides.second !== undefined) second = overrides.second;
  }

  return new TimeValue(hour, minute, second, nanosecond, t.offset);
}

/**
 * Truncate a localtime to a specific unit
 */
export function truncateLocalTime(
  unit: TruncateUnit,
  t: LocalTimeValue,
  overrides?: Record<string, number>,
): LocalTimeValue {
  let hour = 0;
  let minute = 0;
  let second = 0;
  let nanosecond = 0;

  switch (unit) {
    case "hour":
      hour = t.hour;
      break;
    case "minute":
      hour = t.hour;
      minute = t.minute;
      break;
    case "second":
      hour = t.hour;
      minute = t.minute;
      second = t.second;
      break;
    case "millisecond":
      hour = t.hour;
      minute = t.minute;
      second = t.second;
      nanosecond = Math.floor(t.nanosecond / 1_000_000) * 1_000_000;
      break;
    case "microsecond":
      hour = t.hour;
      minute = t.minute;
      second = t.second;
      nanosecond = Math.floor(t.nanosecond / 1_000) * 1_000;
      break;
    default:
      // For date-based units, return full time
      hour = t.hour;
      minute = t.minute;
      second = t.second;
      nanosecond = t.nanosecond;
      break;
  }

  // Apply overrides
  if (overrides) {
    if (overrides.hour !== undefined) hour = overrides.hour;
    if (overrides.minute !== undefined) minute = overrides.minute;
    if (overrides.second !== undefined) second = overrides.second;
  }

  return new LocalTimeValue(hour, minute, second, nanosecond);
}
