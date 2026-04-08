/**
 * Tests for date() temporal function and date component accessors.
 */
import { describe, expect, test } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { InMemoryGraphStorage } from "../GraphStorage.js";
import {
  DateValue,
  LocalTimeValue,
  TimeValue,
  LocalDateTimeValue,
  DateTimeValue,
} from "../TemporalTypes.js";
import { parse } from "../grammar.js";
import { anyAstToSteps } from "../astToSteps.js";
import { createTraverser } from "../Steps.js";
import type { GraphSchema } from "../GraphSchema.js";
import type { Query, UnionQuery, MultiStatement } from "../AST.js";

function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix",
      validate: (value) => {
        return { value: value as T };
      },
    },
  };
}

const schema = {
  vertices: {
    Event: {
      properties: {
        name: { type: makeType<string>("") },
        date: { type: makeType<unknown>(null) },
      },
    },
  },
  edges: {},
} as const satisfies GraphSchema;

function createTestGraph() {
  return new Graph({ schema, storage: new InMemoryGraphStorage() });
}

function executeQuery(graph: Graph<GraphSchema>, queryString: string): unknown[] {
  const ast = parse(queryString) as Query | UnionQuery | MultiStatement;
  const steps = anyAstToSteps(ast);
  const traverser = createTraverser(steps);
  return Array.from(traverser.traverse(graph, []));
}

function query(q: string) {
  const graph = createTestGraph();
  return executeQuery(graph, q);
}

describe("DateValue class", () => {
  test("fromString parses ISO date correctly", () => {
    const date = DateValue.fromString("1984-10-11");
    expect(date).not.toBeNull();
    expect(date!.year).toBe(1984);
    expect(date!.month).toBe(10);
    expect(date!.day).toBe(11);
  });

  test("fromString returns null for invalid format", () => {
    expect(DateValue.fromString("1984-10")).toBeNull();
    expect(DateValue.fromString("1984/10/11")).toBeNull();
    expect(DateValue.fromString("invalid")).toBeNull();
  });

  test("fromMap creates date from components", () => {
    const date = DateValue.fromMap({ year: 2023, month: 6, day: 15 });
    expect(date).not.toBeNull();
    expect(date!.year).toBe(2023);
    expect(date!.month).toBe(6);
    expect(date!.day).toBe(15);
  });

  test("toString returns ISO format", () => {
    const date = new DateValue(1984, 10, 11);
    expect(date.toString()).toBe("1984-10-11");
  });

  test("get() returns component values", () => {
    const date = new DateValue(1984, 10, 11);
    expect(date.get("year")).toBe(1984);
    expect(date.get("month")).toBe(10);
    expect(date.get("day")).toBe(11);
    expect(date.get("unknown")).toBeNull();
  });

  test("week returns ISO week number", () => {
    // October 11, 1984 is in week 41
    const date = new DateValue(1984, 10, 11);
    expect(date.week).toBe(41);
  });

  test("dayOfWeek returns ISO day of week (1=Monday)", () => {
    // October 11, 1984 was a Thursday (day 4)
    const date = new DateValue(1984, 10, 11);
    expect(date.dayOfWeek).toBe(4);
  });

  test("quarter returns quarter of year", () => {
    expect(new DateValue(2023, 1, 15).quarter).toBe(1);
    expect(new DateValue(2023, 4, 15).quarter).toBe(2);
    expect(new DateValue(2023, 7, 15).quarter).toBe(3);
    expect(new DateValue(2023, 10, 15).quarter).toBe(4);
  });

  test("ordinalDay returns day of year", () => {
    // October 11 is day 285 of 1984 (leap year)
    const date = new DateValue(1984, 10, 11);
    expect(date.ordinalDay).toBe(285);
  });

  test("compareTo compares dates correctly", () => {
    const d1 = new DateValue(1984, 10, 11);
    const d2 = new DateValue(1984, 10, 12);
    const d3 = new DateValue(1984, 10, 11);
    expect(d1.compareTo(d2)).toBeLessThan(0);
    expect(d2.compareTo(d1)).toBeGreaterThan(0);
    expect(d1.compareTo(d3)).toBe(0);
  });
});

describe("ISO week calculation edge cases", () => {
  // ISO 8601 week numbering: Week 1 is the week containing January 4th,
  // or equivalently, the week containing the first Thursday of the year.

  test("Dec 31 can be in week 1 of next year", () => {
    // Dec 31, 2020 is a Thursday - it's in week 53 of 2020
    const dec31_2020 = new DateValue(2020, 12, 31);
    expect(dec31_2020.week).toBe(53);

    // Dec 31, 2019 is a Tuesday - it's in week 1 of 2020
    const dec31_2019 = new DateValue(2019, 12, 31);
    expect(dec31_2019.week).toBe(1);

    // Dec 31, 2026 is a Thursday - it's in week 53 of 2026
    const dec31_2026 = new DateValue(2026, 12, 31);
    expect(dec31_2026.week).toBe(53);
  });

  test("Jan 1 can be in week 52/53 of previous year", () => {
    // Jan 1, 2021 is a Friday - it's in week 53 of 2020
    const jan1_2021 = new DateValue(2021, 1, 1);
    expect(jan1_2021.week).toBe(53);

    // Jan 1, 2022 is a Saturday - it's in week 52 of 2021
    const jan1_2022 = new DateValue(2022, 1, 1);
    expect(jan1_2022.week).toBe(52);

    // Jan 1, 2020 is a Wednesday - it's in week 1 of 2020
    const jan1_2020 = new DateValue(2020, 1, 1);
    expect(jan1_2020.week).toBe(1);
  });

  test("Jan 4 is always in week 1", () => {
    // By definition, Jan 4 is always in week 1
    expect(new DateValue(2020, 1, 4).week).toBe(1);
    expect(new DateValue(2021, 1, 4).week).toBe(1);
    expect(new DateValue(2022, 1, 4).week).toBe(1);
    expect(new DateValue(2023, 1, 4).week).toBe(1);
    expect(new DateValue(2024, 1, 4).week).toBe(1);
  });

  test("week number for known dates", () => {
    // Some known reference dates
    // March 15, 2024 is a Friday in week 11
    expect(new DateValue(2024, 3, 15).week).toBe(11);

    // June 15, 2024 is a Saturday in week 24
    expect(new DateValue(2024, 6, 15).week).toBe(24);

    // Sept 1, 2024 is a Sunday in week 35
    expect(new DateValue(2024, 9, 1).week).toBe(35);
  });

  test("dayOfWeek at year boundaries", () => {
    // Verify dayOfWeek is consistent with week calculations
    // Jan 1, 2024 is a Monday (day 1)
    expect(new DateValue(2024, 1, 1).dayOfWeek).toBe(1);

    // Jan 1, 2023 is a Sunday (day 7)
    expect(new DateValue(2023, 1, 1).dayOfWeek).toBe(7);

    // Dec 31, 2023 is a Sunday (day 7)
    expect(new DateValue(2023, 12, 31).dayOfWeek).toBe(7);
  });
});

describe("date() function", () => {
  test("date(string) creates date from ISO string", () => {
    const result = query("RETURN date('1984-10-11')");
    expect(result).toHaveLength(1);
    const d = result[0];
    expect(d).toBeInstanceOf(DateValue);
    expect((d as DateValue).toString()).toBe("1984-10-11");
  });

  test("date() with no args returns current date", () => {
    const result = query("RETURN date()");
    expect(result).toHaveLength(1);
    const d = result[0];
    expect(d).toBeInstanceOf(DateValue);
    // Just verify it's a valid date (today)
    const today = new Date();
    expect((d as DateValue).year).toBe(today.getFullYear());
    expect((d as DateValue).month).toBe(today.getMonth() + 1);
    expect((d as DateValue).day).toBe(today.getDate());
  });

  test.skip("date(map) creates date from components - requires map literal grammar support", () => {
    // This test is skipped because the grammar doesn't yet support
    // map literals like {year: 2023, month: 6, day: 15} as function arguments
    const result = query("RETURN date({year: 2023, month: 6, day: 15})");
    expect(result).toHaveLength(1);
    const d = result[0];
    expect(d).toBeInstanceOf(DateValue);
    expect((d as DateValue).year).toBe(2023);
    expect((d as DateValue).month).toBe(6);
    expect((d as DateValue).day).toBe(15);
  });

  test("date(null) returns null", () => {
    const result = query("RETURN date(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });
});

describe("date component accessors", () => {
  test("date().year returns year", () => {
    const result = query("RETURN date('1984-10-11').year");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(1984);
  });

  test("date().month returns month", () => {
    const result = query("RETURN date('1984-10-11').month");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(10);
  });

  test("date().day returns day", () => {
    const result = query("RETURN date('1984-10-11').day");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(11);
  });

  test("date().week returns ISO week number", () => {
    const result = query("RETURN date('1984-10-11').week");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(41);
  });

  test("date().dayOfWeek returns ISO day of week", () => {
    const result = query("RETURN date('1984-10-11').dayOfWeek");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(4);
  });

  test("date().quarter returns quarter", () => {
    const result = query("RETURN date('1984-10-11').quarter");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(4);
  });

  test("date().ordinalDay returns day of year", () => {
    const result = query("RETURN date('1984-10-11').ordinalDay");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(285);
  });
});

describe("date comparison", () => {
  test.skip("date < date comparison - requires comparison in RETURN", () => {
    // Skipped: Grammar doesn't yet support comparison expressions in RETURN clause
    const result = query("RETURN date('1984-10-11') < date('1984-10-12')");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(true);
  });

  test.skip("date > date comparison - requires comparison in RETURN", () => {
    // Skipped: Grammar doesn't yet support comparison expressions in RETURN clause
    const result = query("RETURN date('1984-10-12') > date('1984-10-11')");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(true);
  });

  test.skip("date = date comparison - requires comparison in RETURN", () => {
    // Skipped: Grammar doesn't yet support comparison expressions in RETURN clause
    const result = query("RETURN date('1984-10-11') = date('1984-10-11')");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(true);
  });
});

describe("toString(date)", () => {
  test("toString converts date to ISO string", () => {
    const result = query("RETURN toString(date('1984-10-11'))");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("1984-10-11");
  });
});

describe("grammar parsing", () => {
  test("parses date() function call", () => {
    const ast = parse("RETURN date('1984-10-11')") as Query;
    const expr = ast.return?.items[0]?.expression as any;
    expect(expr?.type).toBe("FunctionCall");
    expect(expr?.name).toBe("date");
  });

  test("parses date().year member access", () => {
    const ast = parse("RETURN date('1984-10-11').year") as Query;
    const expr = ast.return?.items[0]?.expression as any;
    expect(expr?.type).toBe("MemberAccess");
    expect(expr?.property).toBe("year");
  });

  test.skip("parses map literal as function argument - requires grammar support", () => {
    // This test is skipped because the grammar doesn't yet support
    // map literals like {year: 2023, month: 1, day: 15} as function arguments
    const ast = parse("RETURN date({year: 2023, month: 1, day: 15}).month") as Query;
    const expr = ast.return?.items[0]?.expression as any;
    expect(expr?.type).toBe("MemberAccess");
    expect(expr?.property).toBe("month");
  });
});

// ========================================
// LocalTimeValue tests
// ========================================

describe("LocalTimeValue class", () => {
  test("fromString parses time correctly", () => {
    const time = LocalTimeValue.fromString("12:31:14.645876123");
    expect(time).not.toBeNull();
    expect(time!.hour).toBe(12);
    expect(time!.minute).toBe(31);
    expect(time!.second).toBe(14);
    expect(time!.nanosecond).toBe(645876123);
  });

  test("fromString parses time without fractional seconds", () => {
    const time = LocalTimeValue.fromString("09:15:30");
    expect(time).not.toBeNull();
    expect(time!.hour).toBe(9);
    expect(time!.minute).toBe(15);
    expect(time!.second).toBe(30);
    expect(time!.nanosecond).toBe(0);
  });

  test("fromString returns null for invalid format", () => {
    expect(LocalTimeValue.fromString("12:31")).toBeNull();
    expect(LocalTimeValue.fromString("12:31:14+01:00")).toBeNull();
    expect(LocalTimeValue.fromString("invalid")).toBeNull();
  });

  test("toString returns correct format", () => {
    const time = new LocalTimeValue(12, 31, 14, 645876123);
    expect(time.toString()).toBe("12:31:14.645876123");
  });

  test("toString removes trailing zeros", () => {
    const time = new LocalTimeValue(12, 31, 14, 500000000);
    expect(time.toString()).toBe("12:31:14.5");
  });

  test("toString without nanoseconds", () => {
    const time = new LocalTimeValue(12, 31, 14, 0);
    expect(time.toString()).toBe("12:31:14");
  });

  test("millisecond accessor", () => {
    const time = new LocalTimeValue(12, 31, 14, 645876123);
    expect(time.millisecond).toBe(645);
  });

  test("microsecond accessor", () => {
    const time = new LocalTimeValue(12, 31, 14, 645876123);
    expect(time.microsecond).toBe(645876);
  });
});

describe("localtime() function", () => {
  test("localtime(string) creates time from ISO string", () => {
    const result = query("RETURN localtime('12:31:14.645876123')");
    expect(result).toHaveLength(1);
    const t = result[0];
    expect(t).toBeInstanceOf(LocalTimeValue);
    expect((t as LocalTimeValue).toString()).toBe("12:31:14.645876123");
  });

  test("localtime() with no args returns current time", () => {
    const result = query("RETURN localtime()");
    expect(result).toHaveLength(1);
    const t = result[0];
    expect(t).toBeInstanceOf(LocalTimeValue);
    // Just verify it's a valid time
    expect((t as LocalTimeValue).hour).toBeGreaterThanOrEqual(0);
    expect((t as LocalTimeValue).hour).toBeLessThanOrEqual(23);
  });

  test("localtime(null) returns null", () => {
    const result = query("RETURN localtime(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test("localtime().hour accessor", () => {
    const result = query("RETURN localtime('12:31:14').hour");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(12);
  });

  test("localtime().minute accessor", () => {
    const result = query("RETURN localtime('12:31:14').minute");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(31);
  });

  test("localtime().second accessor", () => {
    const result = query("RETURN localtime('12:31:14').second");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(14);
  });
});

// ========================================
// TimeValue tests
// ========================================

describe("TimeValue class", () => {
  test("fromString parses time with positive offset", () => {
    const time = TimeValue.fromString("12:31:14.645876123+01:00");
    expect(time).not.toBeNull();
    expect(time!.hour).toBe(12);
    expect(time!.minute).toBe(31);
    expect(time!.second).toBe(14);
    expect(time!.nanosecond).toBe(645876123);
    expect(time!.offset).toBe(3600); // +01:00 = 3600 seconds
  });

  test("fromString parses time with negative offset", () => {
    const time = TimeValue.fromString("12:31:14-05:30");
    expect(time).not.toBeNull();
    expect(time!.offset).toBe(-5 * 3600 - 30 * 60);
  });

  test("fromString parses time with Z offset", () => {
    const time = TimeValue.fromString("12:31:14Z");
    expect(time).not.toBeNull();
    expect(time!.offset).toBe(0);
  });

  test("toString formats correctly", () => {
    const time = new TimeValue(12, 31, 14, 645876123, 3600);
    expect(time.toString()).toBe("12:31:14.645876123+01:00");
  });

  test("toString with Z offset", () => {
    const time = new TimeValue(12, 31, 14, 0, 0);
    expect(time.toString()).toBe("12:31:14Z");
  });

  test("offsetMinutes accessor", () => {
    const time = new TimeValue(12, 31, 14, 0, 5400); // +01:30
    expect(time.offsetMinutes).toBe(90);
  });
});

describe("time() function", () => {
  test("time(string) creates time with offset", () => {
    const result = query("RETURN time('12:31:14.645876123+01:00')");
    expect(result).toHaveLength(1);
    const t = result[0];
    expect(t).toBeInstanceOf(TimeValue);
    expect((t as TimeValue).toString()).toBe("12:31:14.645876123+01:00");
  });

  test("time() with no args returns current time with offset", () => {
    const result = query("RETURN time()");
    expect(result).toHaveLength(1);
    const t = result[0];
    expect(t).toBeInstanceOf(TimeValue);
    // Verify it has an offset (not LocalTimeValue)
    expect((t as TimeValue).temporalType).toBe("time");
  });

  test("time(null) returns null", () => {
    const result = query("RETURN time(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test("time().offset accessor", () => {
    const result = query("RETURN time('12:31:14+01:00').offset");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(3600);
  });
});

// ========================================
// LocalDateTimeValue tests
// ========================================

describe("LocalDateTimeValue class", () => {
  test("fromString parses datetime correctly", () => {
    const dt = LocalDateTimeValue.fromString("1984-10-11T12:31:14.645876123");
    expect(dt).not.toBeNull();
    expect(dt!.year).toBe(1984);
    expect(dt!.month).toBe(10);
    expect(dt!.day).toBe(11);
    expect(dt!.hour).toBe(12);
    expect(dt!.minute).toBe(31);
    expect(dt!.second).toBe(14);
    expect(dt!.nanosecond).toBe(645876123);
  });

  test("fromString parses datetime without fractional seconds", () => {
    const dt = LocalDateTimeValue.fromString("1984-10-11T12:31:14");
    expect(dt).not.toBeNull();
    expect(dt!.nanosecond).toBe(0);
  });

  test("toString returns correct format", () => {
    const dt = new LocalDateTimeValue(1984, 10, 11, 12, 31, 14, 645876123);
    expect(dt.toString()).toBe("1984-10-11T12:31:14.645876123");
  });

  test("date properties work", () => {
    const dt = new LocalDateTimeValue(1984, 10, 11, 12, 31, 14);
    expect(dt.week).toBe(41);
    expect(dt.dayOfWeek).toBe(4);
    expect(dt.quarter).toBe(4);
  });
});

describe("localdatetime() function", () => {
  test("localdatetime(string) creates datetime", () => {
    const result = query("RETURN localdatetime('1984-10-11T12:31:14.645876123')");
    expect(result).toHaveLength(1);
    const dt = result[0];
    expect(dt).toBeInstanceOf(LocalDateTimeValue);
    expect((dt as LocalDateTimeValue).toString()).toBe("1984-10-11T12:31:14.645876123");
  });

  test("localdatetime() with no args returns current datetime", () => {
    const result = query("RETURN localdatetime()");
    expect(result).toHaveLength(1);
    const dt = result[0];
    expect(dt).toBeInstanceOf(LocalDateTimeValue);
    // Verify it's today
    const today = new Date();
    expect((dt as LocalDateTimeValue).year).toBe(today.getFullYear());
  });

  test("localdatetime(null) returns null", () => {
    const result = query("RETURN localdatetime(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test("localdatetime().year accessor", () => {
    const result = query("RETURN localdatetime('1984-10-11T12:31:14').year");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(1984);
  });

  test("localdatetime().hour accessor", () => {
    const result = query("RETURN localdatetime('1984-10-11T12:31:14').hour");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(12);
  });
});

// ========================================
// DateTimeValue tests
// ========================================

describe("DateTimeValue class", () => {
  test("fromString parses datetime with offset", () => {
    const dt = DateTimeValue.fromString("1984-10-11T12:31:14.645876123+01:00");
    expect(dt).not.toBeNull();
    expect(dt!.year).toBe(1984);
    expect(dt!.month).toBe(10);
    expect(dt!.day).toBe(11);
    expect(dt!.hour).toBe(12);
    expect(dt!.minute).toBe(31);
    expect(dt!.second).toBe(14);
    expect(dt!.nanosecond).toBe(645876123);
    expect(dt!.offset).toBe(3600);
    expect(dt!.timezone).toBeNull();
  });

  test("fromString parses datetime with named timezone", () => {
    const dt = DateTimeValue.fromString("1984-10-11T12:31:14.645876123[Europe/Stockholm]");
    expect(dt).not.toBeNull();
    expect(dt!.timezone).toBe("Europe/Stockholm");
    expect(dt!.year).toBe(1984);
  });

  test("fromString parses datetime with offset and named timezone", () => {
    const dt = DateTimeValue.fromString("1984-10-11T12:31:14.645876123+01:00[Europe/Stockholm]");
    expect(dt).not.toBeNull();
    expect(dt!.offset).toBe(3600);
    expect(dt!.timezone).toBe("Europe/Stockholm");
  });

  test("toString formats with offset", () => {
    const dt = new DateTimeValue(1984, 10, 11, 12, 31, 14, 645876123, 3600);
    expect(dt.toString()).toBe("1984-10-11T12:31:14.645876123+01:00");
  });

  test("toString formats with timezone", () => {
    const dt = new DateTimeValue(1984, 10, 11, 12, 31, 14, 645876123, 3600, "Europe/Stockholm");
    expect(dt.toString()).toBe("1984-10-11T12:31:14.645876123+01:00[Europe/Stockholm]");
  });
});

describe("datetime() function", () => {
  test("datetime(string) creates datetime with offset", () => {
    const result = query("RETURN datetime('1984-10-11T12:31:14.645876123+01:00')");
    expect(result).toHaveLength(1);
    const dt = result[0];
    expect(dt).toBeInstanceOf(DateTimeValue);
    expect((dt as DateTimeValue).toString()).toBe("1984-10-11T12:31:14.645876123+01:00");
  });

  test("datetime(string) with named timezone", () => {
    const result = query("RETURN datetime('1984-10-11T12:31:14.645876123[Europe/Stockholm]')");
    expect(result).toHaveLength(1);
    const dt = result[0];
    expect(dt).toBeInstanceOf(DateTimeValue);
    expect((dt as DateTimeValue).timezone).toBe("Europe/Stockholm");
  });

  test("datetime() with no args returns current datetime", () => {
    const result = query("RETURN datetime()");
    expect(result).toHaveLength(1);
    const dt = result[0];
    expect(dt).toBeInstanceOf(DateTimeValue);
    // Verify it's today
    const today = new Date();
    expect((dt as DateTimeValue).year).toBe(today.getFullYear());
  });

  test("datetime(null) returns null", () => {
    const result = query("RETURN datetime(null)");
    expect(result).toHaveLength(1);
    expect(result[0]).toBeNull();
  });

  test("datetime().year accessor", () => {
    const result = query("RETURN datetime('1984-10-11T12:31:14+01:00').year");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(1984);
  });

  test("datetime().offset accessor", () => {
    const result = query("RETURN datetime('1984-10-11T12:31:14+01:00').offset");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(3600);
  });

  test("datetime().timezone accessor", () => {
    const result = query("RETURN datetime('1984-10-11T12:31:14[Europe/Stockholm]').timezone");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Europe/Stockholm");
  });
});

describe("toString with temporal types", () => {
  test("toString(localtime) converts to string", () => {
    const result = query("RETURN toString(localtime('12:31:14'))");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("12:31:14");
  });

  test("toString(time) converts to string with offset", () => {
    const result = query("RETURN toString(time('12:31:14+01:00'))");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("12:31:14+01:00");
  });

  test("toString(localdatetime) converts to string", () => {
    const result = query("RETURN toString(localdatetime('1984-10-11T12:31:14'))");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("1984-10-11T12:31:14");
  });

  test("toString(datetime) converts to string", () => {
    const result = query("RETURN toString(datetime('1984-10-11T12:31:14+01:00'))");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("1984-10-11T12:31:14+01:00");
  });
});
