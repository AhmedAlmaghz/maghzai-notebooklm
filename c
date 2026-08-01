import { describe, it, expect } from "vitest";
import { isRTL, getLocaleFromString, defaultLocale, locales } from "@/i18n";

describe("i18n utilities", () => {
  describe("isRTL", () => {
    it("should return true for Arabic", () => {
      expect(isRTL("ar")).toBe(true);
    });

    it("should return false for English", () => {
      expect(isRTL("en")).toBe(false);
    });
  });

  describe("getLocaleFromString", () => {
    it("should return 'ar' for 'ar'", () => {
      expect(getLocaleFromString("ar")).toBe("ar");
    });

    it("should return 'en' for 'en'", () => {
      expect(getLocaleFromString("en")).toBe("en");
    });

    it("should return default locale for invalid string", () => {
      expect(getLocaleFromString("fr")).toBe(defaultLocale);
    });

    it("should return default locale for undefined", () => {
      expect(getLocaleFromString(undefined)).toBe(defaultLocale);
    });
  });

  describe("locales", () => {
    it("should contain ar and en", () => {
      expect(locales).toContain("ar");
      expect(locales).toContain("en");
    });
  });
});