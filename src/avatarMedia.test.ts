import { describe, expect, it } from 'vitest'
import { classifyAvatarPickerError } from './avatarMedia'

describe('avatar media picker states', () => {
  it('treats picker cancellation as a recoverable no-op', () => {
    expect(classifyAvatarPickerError(new DOMException('cancelled', 'AbortError'))).toEqual({ status: 'cancelled' })
  })

  it('exposes permission denial without leaking platform details', () => {
    expect(classifyAvatarPickerError(new DOMException('denied', 'NotAllowedError'))).toEqual({ status: 'permission_denied' })
  })

  it('classifies unexpected picker failures as unavailable', () => {
    expect(classifyAvatarPickerError(new Error('native picker failed'))).toEqual({ status: 'unavailable' })
  })
})
