import { describe, expect, it } from 'vitest'
import { assetFingerprint } from './usePwa'

const page = (js: string, css: string) => `<!doctype html><html><head>
  <link rel="manifest" href="./manifest.webmanifest" />
  <script type="module" crossorigin src="./assets/${js}"></script>
  <link rel="stylesheet" crossorigin href="./assets/${css}">
  <link rel="icon" href="./icons/icon.svg" /></head></html>`

describe('assetFingerprint', () => {
  it('lists the hashed script and stylesheet a build references', () => {
    expect(assetFingerprint(page('index-7PA_BeWL.js', 'index-BswxBviq.css'))).toBe(
      'assets/index-7PA_BeWL.js assets/index-BswxBviq.css',
    )
  })

  it('changes when the code changes and not otherwise', () => {
    const a = assetFingerprint(page('index-aaa.js', 'index-ccc.css'))
    expect(assetFingerprint(page('index-aaa.js', 'index-ccc.css'))).toBe(a)
    expect(assetFingerprint(page('index-bbb.js', 'index-ccc.css'))).not.toBe(a)
  })

  it('is empty for a sign-in page or anything that is not the app', () => {
    expect(assetFingerprint('<html><body>Sign in to your account</body></html>')).toBe('')
  })
})
