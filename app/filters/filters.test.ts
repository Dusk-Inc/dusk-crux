import { coerceToSampleType } from "./filters";

describe("coerceToSampleType", () => {
  test("coerces numeric strings when sample is number", () => {
    expect(coerceToSampleType("42", 0)).toBe(42);
    expect(coerceToSampleType("3.14", 0)).toBeCloseTo(3.14);
  });

  test("does not coerce non-numeric strings when sample is number", () => {
    expect(coerceToSampleType("abc", 0)).toBe("abc");
    expect(coerceToSampleType("", "abc")).toBe("");
    expect(coerceToSampleType(" 7 ", 0)).toBe(7);
  });

  test("coerces 'true'/'false' (any case) when sample is boolean", () => {
    expect(coerceToSampleType("true", false)).toBe(true);
    expect(coerceToSampleType("FALSE", true)).toBe(false);
    expect(coerceToSampleType("TrUe", false)).toBe(true);
  });

  test("does not coerce other truthy/falsey strings for boolean sample", () => {
    expect(coerceToSampleType("1", false)).toBe("1");
    expect(coerceToSampleType("yes", true)).toBe("yes");
    expect(coerceToSampleType(" true ", false)).toBe(" true ");
  });

  test("returns original value for non-number/boolean samples", () => {
    expect(coerceToSampleType("123", "sample")).toBe("123");
    expect(coerceToSampleType("x", null as any)).toBe("x");
    expect(coerceToSampleType("y", undefined as any)).toBe("y");
    expect(coerceToSampleType("z", {} as any)).toBe("z");
  });
});
