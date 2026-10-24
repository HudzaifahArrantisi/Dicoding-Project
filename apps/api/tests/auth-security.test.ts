import { describe, expect, it } from "bun:test";
import { getAuthUser, sessionCookie, validCsrf } from "../src/plugins/auth";

describe("session boundary", () => {
  it("does not authenticate an old bearer token without a session cookie", async () => {
    expect(await getAuthUser({ authorization: "Bearer old-or-forged-token" })).toBeNull();
  });

  it("requires a matching CSRF header for mutations", () => {
    const expected = "a".repeat(43);
    expect(validCsrf({}, expected)).toBe(false);
    expect(validCsrf({ "x-csrf-token": "b".repeat(43) }, expected)).toBe(false);
    expect(validCsrf({ "x-csrf-token": expected }, expected)).toBe(true);
  });

  it("marks the session cookie as HttpOnly and SameSite Strict", () => {
    const cookie = sessionCookie("a".repeat(43));
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
  });
});
