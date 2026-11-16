/**
 * The bundled examples (public/samples/*.fh): what the New dialog and the
 * menu list, in this order. Each one is small enough to read at a glance and
 * shows one feature of the app. scripts/verify.ts checks this list against
 * the files.
 */
export interface SampleInfo {
  /** File name without the extension. */
  value: string;
  label: string;
  /** One plain line: who it is for and what it makes. */
  blurb: string;
  /** The feature it shows off. */
  shows: string;
}

export const SAMPLES: SampleInfo[] = [
  {
    value: "photo-shoots",
    label: "Photo shoots",
    blurb: "One dated folder per shoot: RAW, selects, edits, delivered.",
    shows: "Fill-in names",
  },
  {
    value: "client-work",
    label: "Client work",
    blurb: "A folder per client, and a folder per project inside it.",
    shows: "A block inside a block",
  },
  {
    value: "book-series",
    label: "Book series",
    blurb: "Manuscript, cover, interior and launch for every book.",
    shows: "One block, used many times",
  },
  {
    value: "home-paperwork",
    label: "Home paperwork",
    blurb: "Taxes, home, vehicles, medical and receipts, by year.",
    shows: "A block in two places",
  },
  {
    value: "video-channel",
    label: "Video channel",
    blurb: "Script, footage, audio and exports for every video.",
    shows: "Dates in names",
  },
  {
    value: "code-project",
    label: "Code project",
    blurb: "Source, tests and docs, with starter files.",
    shows: "Files as well as folders",
  },
  {
    value: "studio",
    label: "Creative studio",
    blurb: "Departments, years, clients and projects: a big one.",
    shows: "A large structure from small blocks",
  },
];

/** The structure a brand-new profile opens on (not listed as an example). */
export const STARTUP_SAMPLE = "startup";

const cache = new Map<string, Promise<string>>();

/** The .fh text of a bundled sample. Fetched once, then remembered. */
export function fetchSample(value: string): Promise<string> {
  let hit = cache.get(value);
  if (!hit) {
    hit = fetch(`${import.meta.env.BASE_URL}samples/${value}.fh`).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    });
    // A failed fetch is not remembered, so the next try can succeed.
    hit.catch(() => cache.delete(value));
    cache.set(value, hit);
  }
  return hit;
}
