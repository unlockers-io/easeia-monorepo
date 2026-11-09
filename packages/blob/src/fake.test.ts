import { describe, expect, it } from "vitest";

import { createFakeBlobStore } from "./fake";

describe("createFakeBlobStore", () => {
  it("keeps every upload under its derived key and URL", async () => {
    const store = createFakeBlobStore();

    const a = await store.upload({
      bytes: new Uint8Array([1]),
      filename: "a.jpg",
      mime: "image/jpeg",
      postId: "p1",
      siteId: "s1",
    });

    const b = await store.upload({
      bytes: new Uint8Array([2]),
      filename: "b.png",
      mime: "image/png",
      postId: "p2",
      siteId: "s1",
    });

    expect([...store.contents().keys()].toSorted()).toEqual([a.key, b.key].toSorted());
    expect(store.contents().get(a.key)).toMatchObject({ mime: "image/jpeg", url: a.url });
  });

  it("remove deletes by key", async () => {
    const store = createFakeBlobStore();

    const { key } = await store.upload({
      bytes: new Uint8Array([1]),
      filename: "a.jpg",
      mime: "image/jpeg",
      postId: "p1",
      siteId: "s1",
    });

    await store.remove(key);
    expect(store.contents().has(key)).toBe(false);
  });

  it("reset clears everything", async () => {
    const store = createFakeBlobStore();
    await store.upload({
      bytes: new Uint8Array([1]),
      filename: "a.jpg",
      mime: "image/jpeg",
      postId: "p1",
      siteId: "s1",
    });
    store.reset();
    expect(store.contents().size).toBe(0);
  });

  it("uses the same key derivation as buildBlobKey", async () => {
    const store = createFakeBlobStore();

    const { key } = await store.upload({
      bytes: new Uint8Array([1, 2, 3, 4, 5]),
      filename: "hero.jpg",
      mime: "image/jpeg",
      postId: "post_xyz",
      siteId: "site_abc",
    });

    expect(key).toBe("sites/site_abc/posts/post_xyz/74f81fe167d99b4c.jpg");
  });
});

describe("fake store URL composition", () => {
  it("matches the real join for a base with no trailing slash", async () => {
    const store = createFakeBlobStore("https://img.easeia.com");

    const { url } = await store.upload({
      bytes: new Uint8Array([1]),
      filename: "a.jpg",
      mime: "image/jpeg",
      postId: "p1",
      siteId: "s1",
    });

    // Previously produced "https://img.easeia.comsites/..." because the fake
    // kept the separator inside its default argument.
    expect(url.startsWith("https://img.easeia.com/sites/s1/")).toBe(true);
  });

  it("matches the real join for a base with a trailing slash", async () => {
    const store = createFakeBlobStore("https://img.easeia.com/");

    const { url } = await store.upload({
      bytes: new Uint8Array([1]),
      filename: "a.jpg",
      mime: "image/jpeg",
      postId: "p1",
      siteId: "s1",
    });

    expect(url).not.toContain("//sites/");
  });
});
