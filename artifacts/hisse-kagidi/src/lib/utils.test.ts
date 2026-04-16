import { describe, it, expect } from "vitest";
import { trUpperCase } from "./utils";

describe("trUpperCase", () => {
  it("converts lowercase Turkish dotless i (ı) to İ", () => {
    expect(trUpperCase("ışık")).toBe("IŞIK");
  });

  it("converts lowercase i to İ (not I) in Turkish locale", () => {
    expect(trUpperCase("istanbul")).toBe("İSTANBUL");
  });

  it("converts ş to Ş", () => {
    expect(trUpperCase("şeker")).toBe("ŞEKER");
  });

  it("converts ğ to Ğ", () => {
    expect(trUpperCase("ğ")).toBe("Ğ");
  });

  it("converts ö to Ö", () => {
    expect(trUpperCase("öğrenci")).toBe("ÖĞRENCİ");
  });

  it("converts ü to Ü", () => {
    expect(trUpperCase("ülke")).toBe("ÜLKE");
  });

  it("converts ç to Ç", () => {
    expect(trUpperCase("çiçek")).toBe("ÇİÇEK");
  });

  it("handles mixed-case Turkish text", () => {
    expect(trUpperCase("Ahmet Yılmaz")).toBe("AHMET YILMAZ");
  });

  it("handles full name with Turkish chars", () => {
    expect(trUpperCase("mustafa kemal atatürk")).toBe("MUSTAFA KEMAL ATATÜRK");
  });

  it("returns empty string for null input", () => {
    expect(trUpperCase(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(trUpperCase(undefined)).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(trUpperCase("")).toBe("");
  });

  it("leaves numeric strings unchanged in value", () => {
    expect(trUpperCase("123")).toBe("123");
  });

  it("leaves already-uppercase text unchanged", () => {
    expect(trUpperCase("AHMET")).toBe("AHMET");
  });
});
