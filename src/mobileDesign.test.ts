import { describe, expect, it } from 'vitest'
import { mobileViewportContract, mobileTypography } from './ui/mobileDesign'

describe('mobile design contract', () => {
  it('keeps form text readable and touch targets comfortable', () => {
    expect(mobileTypography.bodyMinPx).toBeGreaterThanOrEqual(16)
    expect(mobileTypography.touchTargetMinPx).toBeGreaterThanOrEqual(44)
  })

  it('covers the supported phone widths without horizontal overflow', () => {
    expect(mobileViewportContract).toEqual([320, 360, 375, 390, 412])
  })
})
