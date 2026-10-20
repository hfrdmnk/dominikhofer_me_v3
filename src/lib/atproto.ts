import { SITE } from "../site";

let pdsPromise: Promise<string | undefined> | undefined;

/**
 * Resolves the PDS endpoint for the site's DID via the PLC directory.
 * Uses /data because the bare DID document is served as application/did+ld+json.
 */
export function getPds(): Promise<string | undefined> {
  pdsPromise ??= (async () => {
    try {
      const response = await fetch(`https://plc.directory/${SITE.atproto.did}/data`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: any = await response.json();
      return data?.services?.atproto_pds?.endpoint as string | undefined;
    } catch (error) {
      console.warn(`atproto: PLC directory lookup failed: ${error}`);
      return undefined;
    }
  })();
  return pdsPromise;
}

export interface AtprotoRecord<T = Record<string, any>> {
  uri: string;
  cid: string;
  value: T;
}

/** Fetches all records of a collection from the site's PDS, following cursors. */
export async function listRecords<T = Record<string, any>>(
  collection: string,
): Promise<{ ok: boolean; records: AtprotoRecord<T>[] }> {
  const pds = await getPds();
  if (!pds) return { ok: false, records: [] };
  const records: AtprotoRecord<T>[] = [];
  let cursor = "";
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ repo: SITE.atproto.did, collection, limit: "100" });
    if (cursor) query.set("cursor", cursor);
    try {
      const response = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${query}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: any = await response.json();
      records.push(...(data.records ?? []));
      cursor = data.cursor ?? "";
    } catch (error) {
      console.warn(`atproto: fetching ${collection} failed: ${error}`);
      return { ok: false, records };
    }
    if (!cursor) break;
  }
  return { ok: true, records };
}

export async function getRecord<T = Record<string, any>>(
  collection: string,
  rkey: string,
): Promise<AtprotoRecord<T> | undefined> {
  const pds = await getPds();
  if (!pds) return undefined;
  const query = new URLSearchParams({ repo: SITE.atproto.did, collection, rkey });
  try {
    const response = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?${query}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`atproto: fetching ${collection}/${rkey} failed: ${error}`);
    return undefined;
  }
}

export async function blobUrl(cid: string): Promise<string | undefined> {
  const pds = await getPds();
  if (!pds) return undefined;
  return `${pds}/xrpc/com.atproto.sync.getBlob?${new URLSearchParams({ did: SITE.atproto.did, cid })}`;
}
