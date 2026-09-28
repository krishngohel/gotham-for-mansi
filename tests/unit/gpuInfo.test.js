import { describe, it, expect } from 'vitest';
import { gpuShortName, looksIntegrated } from '../../src/ui/gpuInfo.js';

describe('gpu info', () => {
  it('shortens ANGLE renderer strings', () => {
    expect(gpuShortName('ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028A0) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('NVIDIA GeForce RTX 4060 Laptop GPU');
    expect(gpuShortName('ANGLE (Intel, Intel(R) UHD Graphics 770 (0x0000A780) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('Intel(R) UHD Graphics 770');
    expect(gpuShortName('Apple M2')).toBe('Apple M2');
  });
  it('flags integrated GPUs only', () => {
    expect(looksIntegrated('ANGLE (Intel, Intel(R) UHD Graphics 770 (0x0000A780) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(looksIntegrated('ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001681) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(looksIntegrated('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe(true);
    expect(looksIntegrated('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true);
    expect(looksIntegrated('ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028A0) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
    expect(looksIntegrated('ANGLE (AMD, AMD Radeon RX 7600 (0x00007480) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
    expect(looksIntegrated('ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false);
  });
});
