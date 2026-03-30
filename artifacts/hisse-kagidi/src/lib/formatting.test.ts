import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatDate, formatDateTime, formatTime, formatKesildiTime, formatNoteTime, timeSince } from "./formatting";

describe("formatDate", () => {
  it("formats a valid ISO date string", () => {
    const result = formatDate("2024-06-15T10:30:00Z");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });

  it("returns 'Invalid Date' for invalid input", () => {
    expect(formatDate("not-a-date")).toBe("Invalid Date");
  });
});

describe("formatDateTime", () => {
  it("includes time components for valid date", () => {
    const result = formatDateTime("2024-06-15T14:30:00Z");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2024/);
  });

  it("returns 'Invalid Date' for invalid input", () => {
    expect(formatDateTime("invalid")).toBe("Invalid Date");
  });
});

describe("formatTime", () => {
  it("formats time portion of ISO string", () => {
    const result = formatTime("2024-06-15T14:30:00Z");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("returns 'Invalid Date' for invalid input", () => {
    expect(formatTime("bad")).toBe("Invalid Date");
  });
});

describe("formatKesildiTime", () => {
  it("returns empty string for null input", () => {
    expect(formatKesildiTime(null)).toBe("");
  });

  it("formats time for valid ISO string", () => {
    const result = formatKesildiTime("2024-06-15T14:30:00Z");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe("formatNoteTime", () => {
  it("shows only time for today's date", () => {
    const now = new Date();
    const result = formatNoteTime(now.toISOString());
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("shows date + time for past dates", () => {
    const pastDate = new Date("2023-01-15T10:00:00Z");
    const result = formatNoteTime(pastDate.toISOString());
    expect(result.length).toBeGreaterThan(5);
  });

  it("returns non-empty for invalid date (no throw)", () => {
    const result = formatNoteTime("bad-date");
    expect(result).toContain("Invalid Date");
  });
});

describe("timeSince", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Bugün' for today", () => {
    expect(timeSince("2024-06-15T08:00:00Z")).toBe("Bugün");
  });

  it("returns 'Dün' for yesterday", () => {
    expect(timeSince("2024-06-14T08:00:00Z")).toBe("Dün");
  });

  it("returns days ago for less than a week", () => {
    expect(timeSince("2024-06-12T08:00:00Z")).toBe("3 gün önce");
  });

  it("returns weeks ago for less than a month", () => {
    expect(timeSince("2024-06-01T08:00:00Z")).toBe("2 hafta önce");
  });

  it("returns months ago for less than a year", () => {
    expect(timeSince("2024-03-15T08:00:00Z")).toBe("3 ay önce");
  });

  it("returns years ago for over a year", () => {
    expect(timeSince("2022-06-15T08:00:00Z")).toBe("2 yıl önce");
  });

  it("returns NaN-containing string for invalid date (no throw)", () => {
    const result = timeSince("not-a-date");
    expect(result).toContain("NaN");
  });
});
