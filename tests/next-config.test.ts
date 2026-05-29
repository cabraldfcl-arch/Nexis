import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("Next.js local preview config", () => {
  it("allows the 127.0.0.1 dev origin used by browser previews", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});
