/**
 * Finding the teacher's phone with zero configuration.
 * The phone hosts the hotspot, so it is the TV's gateway. Hotspot gateways are
 * usually `x.y.z.1`, iPhones always use 172.20.10.1, and older Android phones
 * 192.168.43.1. If none answer, sweep the TV's own /24 subnet.
 */

export const WELL_KNOWN_HOTSPOT_HOSTS = ['172.20.10.1', '192.168.43.1', '192.168.49.1', '192.168.137.1'] as const;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function parseIPv4(ip: string | null | undefined): [number, number, number, number] | null {
  const match = ip ? IPV4.exec(ip.trim()) : null;
  if (!match) return null;
  const parts = match.slice(1).map(Number) as [number, number, number, number];
  return parts.every((p) => p >= 0 && p <= 255) ? parts : null;
}

/**
 * Hosts to try, most likely first, without duplicates.
 * @param ownIp the TV's own address on the hotspot, if known
 * @param preferred e.g. the last host that worked, or a developer override
 */
export function candidateHosts(ownIp: string | null, preferred: readonly string[] = []): string[] {
  const hosts: string[] = [...preferred];
  const own = parseIPv4(ownIp);
  if (own) {
    const [a, b, c, d] = own;
    hosts.push(`${a}.${b}.${c}.1`);
    hosts.push(...WELL_KNOWN_HOTSPOT_HOSTS);
    for (let i = 2; i <= 254; i++) if (i !== d) hosts.push(`${a}.${b}.${c}.${i}`);
  } else {
    hosts.push(...WELL_KNOWN_HOTSPOT_HOSTS);
  }
  return [...new Set(hosts.filter((h) => h.length > 0 && h !== ownIp))];
}

export const teacherUrl = (host: string, port: number) => `ws://${host}:${port}`;
