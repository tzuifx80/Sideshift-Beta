import { describe, expect, it } from 'vitest'
import { getCorsDecision } from './cors.mjs'

describe('SideShift API CORS', () => {
  it('allows the narrow local development origins and SideShift headers', () => {
    const result = getCorsDecision('https://localhost', new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'https://localhost']))
    expect(result).toEqual({
      allowed: true,
      headers: {
        'access-control-allow-origin': 'https://localhost',
        'access-control-allow-headers': 'authorization, apikey, content-type, x-request-id, x-sideshift-user-id',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        vary: 'Origin',
      },
    })
  })

  it('denies origins outside the configured allow-list', () => {
    expect(getCorsDecision('http://evil.example', new Set(['https://localhost']))).toEqual({ allowed: false, headers: {} })
  })

  it('allows Vite web dev origins when unioned with a device-only allow-list', () => {
    const devOrigins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'https://localhost'])
    expect(getCorsDecision('http://127.0.0.1:5173', devOrigins).allowed).toBe(true)
    expect(getCorsDecision('https://localhost', devOrigins).allowed).toBe(true)
  })
})
