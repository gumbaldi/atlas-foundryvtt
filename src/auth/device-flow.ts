import { getBaseUrl } from '../settings';

export interface DeviceFlowStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export interface DeviceFlowApproved {
  status: 'approved';
  token: string;
  tokenId: string;
  campaignId: string;
  expiresAt: string;
}

export type DeviceFlowPollResult =
  | { status: 'pending' }
  | { status: 'slow_down' }
  | DeviceFlowApproved
  | { status: 'denied' }
  | { status: 'expired' };

export async function startDeviceFlow(params: {
  worldId: string;
  worldName?: string;
  campaignId?: string;
  foundryUserName?: string;
}): Promise<DeviceFlowStart> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error('Atlas Foundry: base URL not configured');

  const response = await fetch(`${baseUrl}/api/v1/foundry/device/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(`Atlas Foundry: device/start failed (HTTP ${response.status})`);
  return (await response.json()) as DeviceFlowStart;
}

async function pollOnce(deviceCode: string, signal: AbortSignal): Promise<DeviceFlowPollResult> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/foundry/device/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode }),
    signal,
  });
  if (!response.ok) throw new Error(`Atlas Foundry: device/poll failed (HTTP ${response.status})`);
  return (await response.json()) as DeviceFlowPollResult;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * Polls until approved/denied/expired or `signal` aborts. A transient
 * network failure (fetch throw, not an abort) is swallowed and retried at
 * the same interval rather than failing the whole login — per the plan's
 * "Poll bricht ab (Netzwerk) → Retry mit Backoff bis expiresIn" edge case.
 */
export async function pollDeviceFlow(
  start: DeviceFlowStart,
  signal: AbortSignal,
): Promise<DeviceFlowApproved | { status: 'denied' } | { status: 'expired' }> {
  let intervalMs = start.interval * 1000;
  const deadline = Date.now() + start.expiresIn * 1000;

  for (;;) {
    if (Date.now() >= deadline) return { status: 'expired' };

    await sleep(intervalMs, signal);

    let result: DeviceFlowPollResult;
    try {
      result = await pollOnce(start.deviceCode, signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      continue;
    }

    if (result.status === 'pending') continue;
    if (result.status === 'slow_down') {
      intervalMs += 5000;
      continue;
    }
    return result;
  }
}
