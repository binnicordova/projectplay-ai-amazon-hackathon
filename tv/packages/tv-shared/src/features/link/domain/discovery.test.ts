import { describe, expect, it } from 'vitest';
import { candidateHosts, parseIPv4, teacherUrl } from './discovery';

describe('discovery', () => {
  it('tries the gateway of the TV subnet first, then well-known hotspots, then the sweep', () => {
    const hosts = candidateHosts('192.168.71.23');
    expect(hosts[0]).toBe('192.168.71.1');
    expect(hosts.slice(1, 3)).toEqual(['172.20.10.1', '192.168.43.1']);
    expect(hosts).toContain('192.168.71.200');
    expect(hosts).not.toContain('192.168.71.23');
    expect(new Set(hosts).size).toBe(hosts.length);
    expect(hosts.length).toBeLessThan(260);
  });

  it('puts the last working host first', () => {
    expect(candidateHosts('10.0.0.5', ['10.0.0.9'])[0]).toBe('10.0.0.9');
  });

  it('falls back to well-known hotspot gateways when the TV IP is unknown', () => {
    expect(candidateHosts(null)).toEqual(['172.20.10.1', '192.168.43.1', '192.168.49.1', '192.168.137.1']);
  });

  it('parses only valid IPv4 addresses', () => {
    expect(parseIPv4('192.168.0.10')).toEqual([192, 168, 0, 10]);
    expect(parseIPv4('300.1.1.1')).toBeNull();
    expect(parseIPv4('fe80::1')).toBeNull();
    expect(parseIPv4(null)).toBeNull();
  });

  it('builds websocket urls', () => {
    expect(teacherUrl('172.20.10.1', 8787)).toBe('ws://172.20.10.1:8787');
  });
});
