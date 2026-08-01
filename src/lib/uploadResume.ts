import { supabase } from './supabase'

export interface UploadProgress {
  percent: number       // 0-100
  attempt: number        // 1-based
  maxAttempts: number
}

/**
 * Uploads a file to the 'resumes' bucket with real progress feedback and
 * automatic retry on slow/dropped connections.
 *
 * Why not the plain supabase-js `.upload()`: it gives no progress events, so
 * a slow upload looks identical to a hung one — the user can't tell it's
 * still working and gives up. It also has no way to distinguish "still
 * transferring, just slowly" from "actually stalled", so any fixed timeout
 * either kills real slow-but-working uploads too early or leaves truly dead
 * ones hanging too long.
 *
 * This uses a signed upload URL + raw XHR so we get real byte-level
 * progress, and a STALL timeout (resets on every progress tick) instead of
 * a flat deadline — a connection making any progress at all, however slow,
 * is left alone; only a connection that goes fully silent gets killed and
 * retried.
 */
export async function uploadResumeWithProgress(
  file: File,
  path: string,
  onProgress?: (p: UploadProgress) => void
): Promise<void> {
  const MAX_ATTEMPTS = 4
  const STALL_TIMEOUT_MS = 20_000 // no progress at all for 20s = treat as dead
  const RETRY_DELAYS_MS = [1_500, 4_000, 8_000]

  let lastError: Error = new Error('Upload failed')

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data: signed, error: signErr } = await supabase
        .storage.from('resumes')
        .createSignedUploadUrl(path, { upsert: true })
      if (signErr || !signed) {
        console.error('[resume-upload] createSignedUploadUrl failed:', signErr?.message ?? 'no data returned')
        throw signErr ?? new Error('Could not prepare upload')
      }

      await uploadToSignedUrlWithStallTimeout(signed.signedUrl, file, STALL_TIMEOUT_MS, (percent) => {
        onProgress?.({ percent, attempt, maxAttempts: MAX_ATTEMPTS })
      })
      return // success
    } catch (err) {
      lastError = err as Error
      console.error(`[resume-upload] attempt ${attempt} failed:`, lastError.message)
      if (attempt < MAX_ATTEMPTS) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? 8_000
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  console.error('[resume-upload] all attempts exhausted, giving up')
  throw lastError
}

function uploadToSignedUrlWithStallTimeout(
  signedUrl: string,
  file: File,
  stallTimeoutMs: number,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let stallTimer: ReturnType<typeof setTimeout>

    const resetStallTimer = () => {
      clearTimeout(stallTimer)
      stallTimer = setTimeout(() => {
        xhr.abort()
        reject(new Error('Connection stalled, no data sent for 20s.'))
      }, stallTimeoutMs)
    }

    xhr.upload.addEventListener('loadstart', () => {
      resetStallTimer()
    })
    xhr.upload.addEventListener('progress', (e) => {
      resetStallTimer()
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('readystatechange', () => {
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        resetStallTimer()
      }
    })
    xhr.addEventListener('load', () => {
      clearTimeout(stallTimer)
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (status ${xhr.status}).`))
    })
    xhr.addEventListener('error', () => {
      clearTimeout(stallTimer)
      console.error('[resume-upload] xhr error event, readyState:', xhr.readyState, 'status:', xhr.status)
      reject(new Error('Network error during upload.'))
    })
    xhr.addEventListener('abort', () => {
      clearTimeout(stallTimer)
      // rejection already fired by the stall timer in that case
    })

    // Matches supabase-js's own uploadToSignedUrl wire format: multipart
    // form body with the file under an empty-string field name plus a
    // cacheControl field. A plain binary PUT body (what a naive XHR upload
    // would send) is NOT what the signed-upload endpoint expects.
    const body = new FormData()
    body.append('cacheControl', '3600')
    body.append('', file)

    xhr.open('PUT', signedUrl)
    resetStallTimer()
    xhr.send(body)
  })
}
