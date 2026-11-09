import { describe, expect, it } from "vitest";

import { fieldAria } from "./field-aria";

describe("fieldAria", () => {
  it("describes the field by its description and its error only when each is shown", () => {
    expect(fieldAria("site", false, false).describedBy).toBeUndefined();
    expect(fieldAria("site", true, false).describedBy).toBe("site-description");
    expect(fieldAria("site", false, true).describedBy).toBe("site-error");
    expect(fieldAria("site", true, true)).toEqual({
      describedBy: "site-description site-error",
      descriptionId: "site-description",
      errorId: "site-error",
    });
  });
});
