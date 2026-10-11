/**
 * Backend client.
 *
 * The app is **offline-first**: every function here rejects rather than
 * retrying forever, and every caller falls back to the bundled fixtures. That
 * matters because the shipped APK must stay fully usable with no server
 * running — the network layer is an enhancement, never a dependency.
 *
 * Point it at a real server with an env var at build/run time:
 *
 *   EXPO_PUBLIC_API_BASE=http://192.168.1.20:4000 npx expo start
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

const DEFAULT_PORT = 4000;

/**
 * Android emulators reach the host loopback through 10.0.2.2; iOS simulators
 * and web can use localhost directly. A physical device needs the LAN IP, which
 * is why the env var exists.
 */
function defaultBaseUrl(): string {
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${host}:${DEFAULT_PORT}`;
}

export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? defaultBaseUrl()).replace(/\/+$/, '');

/** Videos as returned by `GET /api/feed`. */
export interface RemoteFeedVideo {
  id: string;
  creatorId: string;
  creator: {
    id: string;
    name: string;
    handle: string;
    avatarUrl: string | null;
    verified: boolean;
    bio: string;
  };
  caption: string;
  tags: string[];
  music: string;
  location: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
  durationSeconds: number;
  metrics: { likes: number; comments: number; favorites: number; shares: number };
  createdAt: string;
}

export interface UploadInput {
  /** Local `file://` (or blob:) URI of the video to send. */
  uri: string;
  fileName: string;
  mimeType: string;
  caption: string;
  tags: string[];
  location?: string;
}

export interface UploadResult {
  id: string;
  status: string;
  coverPath: string | null;
  coverGenerated: boolean;
}

/** Hard ceiling so a dead network cannot hang the UI forever. */
function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

/**
 * Cheap liveness probe used by the publish screen.
 *
 * The timeout is deliberately generous: on a cold emulator the first request
 * can take several seconds, and a 3s ceiling made the app report "server
 * offline" against a server that was in fact perfectly reachable.
 */
export async function checkHealth(timeoutMs = 8000): Promise<boolean> {
  const { signal, done } = withTimeout(timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/api/health`, { signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    done();
  }
}

/** Approved videos from the server. Rejects when offline or on a bad status. */
export async function fetchFeed(limit = 10, timeoutMs = 5000): Promise<RemoteFeedVideo[]> {
  const { signal, done } = withTimeout(timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/api/feed?limit=${limit}`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as { items?: RemoteFeedVideo[] };
    return json.items ?? [];
  } finally {
    done();
  }
}

/**
 * Uploads a video. It lands in the review queue (`pending`), so it does not
 * appear in the feed until an admin approves it in the console.
 */
export async function uploadVideo(input: UploadInput, timeoutMs = 120_000): Promise<UploadResult> {
  const form = new FormData();

  if (Platform.OS === 'web') {
    // The DOM's FormData only accepts a real Blob for a file part.
    const blob = await (await fetch(input.uri)).blob();
    form.append('file', blob, input.fileName);
  } else {
    // Do NOT use React Native's `{uri, name, type}` shape here. Since SDK 54
    // the global `fetch` is Expo's WinterCG implementation, whose FormData
    // converter accepts only a string, a `Blob`, or an object exposing
    // `bytes()` — anything else throws "Unsupported FormDataPart
    // implementation". `FileSystem.File` implements `Blob`, so it goes through.
    // (The RN shape still works with the old networking stack, which is why
    // this looked correct and only failed on a real device.)
    form.append('file', new File(input.uri) as unknown as Blob);
  }

  form.append('caption', input.caption);
  form.append('tags', JSON.stringify(input.tags));
  if (input.location) form.append('location', input.location);

  const { signal, done } = withTimeout(timeoutMs);
  try {
    // No Content-Type header: fetch must set it itself so the multipart
    // boundary matches the body it generates.
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: form,
      signal,
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(json?.error?.message ?? `上传失败（HTTP ${response.status}）`);
    }
    return json.video as UploadResult;
  } finally {
    done();
  }
}
