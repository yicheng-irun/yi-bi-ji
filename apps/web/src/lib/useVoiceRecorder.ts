import { useCallback, useEffect, useRef, useState } from 'react'

export const TARGET_SAMPLE_RATE = 16000

function resampleLinear(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples
  const ratio = to / from
  const outLen = Math.max(1, Math.floor(samples.length * ratio))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const src = i / ratio
    const i0 = Math.floor(src)
    const i1 = Math.min(samples.length - 1, i0 + 1)
    const frac = src - i0
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac
  }
  return out
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let off = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    off += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/** 把 MediaRecorder 产出的 blob（webm/ogg 等）解码后重编码为 16kHz 单声道 WAV */
async function blobToWav(blob: Blob): Promise<Blob> {
  const buf = await blob.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(buf)
    const samples = decoded.getChannelData(0)
    const rate = decoded.sampleRate
    const final = rate === TARGET_SAMPLE_RATE ? samples : resampleLinear(samples, rate, TARGET_SAMPLE_RATE)
    return encodeWav(final, TARGET_SAMPLE_RATE)
  } finally {
    void ctx.close().catch(() => {})
  }
}

/** 推按说话录音：按下开始（MediaRecorder），松开停止并把录音转成 16kHz 单声道 WAV Blob。 */
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async () => {
    if (activeRef.current) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()
      recorderRef.current = recorder
      streamRef.current = stream
      activeRef.current = true
      setRecording(true)
    } catch (e) {
      setError((e as Error).message || '无法访问麦克风')
    }
  }, [])

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current
      const stream = streamRef.current
      recorderRef.current = null
      streamRef.current = null
      activeRef.current = false
      setRecording(false)
      if (!recorder || !stream) {
        reject(new Error('未在录音'))
        return
      }
      stream.getTracks().forEach((t) => t.stop())
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        chunksRef.current = []
        void blobToWav(blob)
          .then(resolve)
          .catch((e) => reject(e as Error))
      }
      recorder.stop()
    })
  }, [])

  useEffect(() => {
    return () => {
      if (activeRef.current) {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        try {
          recorderRef.current?.stop()
        } catch {
          /* noop */
        }
        activeRef.current = false
      }
    }
  }, [])

  return { recording, error, start, stop }
}
