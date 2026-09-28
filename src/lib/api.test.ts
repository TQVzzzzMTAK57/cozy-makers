import { describe, it, expect, beforeEach } from "vitest";
import { mediaUrl, BACKEND_URL, setToken, clearAuth } from "./api";

describe("mediaUrl", () => {
  beforeEach(() => clearAuth());

  it("returns empty string for missing urls", () => {
    expect(mediaUrl(null)).toBe("");
    expect(mediaUrl(undefined)).toBe("");
  });

  it("appends the auth token to relative upload urls", () => {
    setToken("abc.def");
    expect(mediaUrl("/uploads/a.jpg")).toBe("/uploads/a.jpg?token=abc.def");
  });

  it("points straight at the backend when direct is set", () => {
    setToken("t");
    expect(mediaUrl("/uploads/v.mp4", { direct: true })).toBe(`${BACKEND_URL}/uploads/v.mp4?token=t`);
  });

  it("url-encodes the token and respects existing query strings", () => {
    setToken("a+b/c");
    expect(mediaUrl("/uploads/a.jpg?x=1")).toBe("/uploads/a.jpg?x=1&token=a%2Bb%2Fc");
  });

  it("leaves absolute urls untouched and works without a token", () => {
    setToken("t");
    expect(mediaUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
    clearAuth();
    expect(mediaUrl("/uploads/a.jpg")).toBe("/uploads/a.jpg");
  });
});
