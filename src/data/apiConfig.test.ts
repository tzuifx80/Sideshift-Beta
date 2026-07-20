import { describe, expect, it } from 'vitest'
import { buildApiUrl, resolveApiBaseUrl } from './apiConfig'

describe('SideShift API environment routing', () => {
  it('keeps browser development on the Vite relative proxy', () => {
    expect(resolveApiBaseUrl({ mode: 'development', platform: 'web' })).toBe('')
    expect(buildApiUrl('/api/health', { mode: 'development', platform: 'web' })).toBe('/api/health')
  })

  it('uses the Android emulator host only for an explicitly selected emulator build', () => {
    expect(resolveApiBaseUrl({ mode: 'development', platform: 'android', androidTarget: 'emulator' })).toBe('http://10.0.2.2:8787')
    expect(buildApiUrl('/api/ai/basic/capability', { mode: 'development', platform: 'android', androidTarget: 'emulator' })).toBe('http://10.0.2.2:8787/api/ai/basic/capability')
  })

  it('requires an explicit API URL for a physical Android development build', () => {
    expect(() => resolveApiBaseUrl({ mode: 'development', platform: 'android', androidTarget: 'device' })).toThrow(/VITE_API_BASE_URL/i)
    expect(resolveApiBaseUrl({ mode: 'development', platform: 'android', androidTarget: 'device', apiBaseUrl: 'http://192.0.2.10:8787/' })).toBe('http://192.0.2.10:8787')
  })

  it('requires a public HTTPS API URL in production', () => {
    expect(() => resolveApiBaseUrl({ mode: 'production', platform: 'web' })).toThrow(/HTTPS/i)
    expect(() => resolveApiBaseUrl({ mode: 'production', platform: 'web', apiBaseUrl: 'http://api.example.test' })).toThrow(/HTTPS/i)
    expect(() => resolveApiBaseUrl({ mode: 'production', platform: 'web', apiBaseUrl: 'https://localhost:8787' })).toThrow(/localhost|private/i)
    expect(resolveApiBaseUrl({ mode: 'production', platform: 'android', apiBaseUrl: 'https://api.example.test/' })).toBe('https://api.example.test')
  })
})
