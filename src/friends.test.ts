import { describe, expect, it } from 'vitest'
import friendsSource from './Friends.tsx?raw'

describe('Friends avatar ownership boundary', () => {
  it('keeps avatar editing out of the Friends surface while retaining profile navigation', () => {
    expect(friendsSource).not.toContain('AvatarPhotoPicker')
    expect(friendsSource).not.toContain('uploadAvatar')
    expect(friendsSource).not.toContain('removeAvatar')
    expect(friendsSource).toContain('openProfile')
    expect(friendsSource).toContain('profile-preview-link')
  })
})
