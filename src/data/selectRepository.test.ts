import { describe, expect, it } from 'vitest'
import { selectRepository } from './selectRepository'

describe('repository selection', () => {
  it('defaults to local development mode', () => {
    const repository = selectRepository({})
    expect(repository.backend).toBe('local')
  })

  it('fails fast when supabase is requested without configuration', () => {
    expect(() => selectRepository({ VITE_DATA_BACKEND: 'supabase' })).toThrow('Supabase backend selected')
  })

  it('rejects invalid and production-local configurations', () => {
    expect(() => selectRepository({ VITE_DATA_BACKEND: 'postgres' })).toThrow('Unsupported data backend')
    expect(() => selectRepository({ VITE_DATA_BACKEND: 'local', PROD: 'true' })).toThrow('Production builds must use the Supabase backend')
  })
})
