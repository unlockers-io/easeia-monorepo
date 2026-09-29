import { blobPublicUrl, buildBlobKey, type UploadInput, type UploadResult } from "./index";

export type FakeBlobStore = {
  contents: () => ReadonlyMap<string, { bytes: Uint8Array; mime: string; url: string }>;
  listForSite: (siteId: string) => Promise<Array<{ key: string; size: number; url: string }>>;
  remove: (key: string) => Promise<void>;
  reset: () => void;
  upload: (input: UploadInput) => Promise<UploadResult>;
};

export const createFakeBlobStore = (urlBase = "https://fake.blob"): FakeBlobStore => {
  const store = new Map<string, { bytes: Uint8Array; mime: string; url: string }>();
  return {
    contents: () => store,
    listForSite: (siteId) => {
      const prefix = `sites/${siteId}/`;
      return Promise.resolve(
        [...store.entries()].flatMap(([key, { bytes, url }]) =>
          key.startsWith(prefix) ? [{ key, size: bytes.byteLength, url }] : [],
        ),
      );
    },
    remove: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
    reset: () => {
      store.clear();
    },
    upload: (input) => {
      const key = buildBlobKey(input);
      const url = blobPublicUrl(urlBase, key);
      store.set(key, { bytes: input.bytes, mime: input.mime, url });
      return Promise.resolve({ key, url });
    },
  };
};
