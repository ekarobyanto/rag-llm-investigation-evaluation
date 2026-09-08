// Web Audio API procedural sound effects for Noir Detective corkboard

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume()
  }
  return audioCtx
}

let isMutedState: boolean = false

if (typeof window !== "undefined") {
  isMutedState = localStorage.getItem("noir_audio_muted") === "true"
}

export const soundFx = {
  isMuted(): boolean {
    return isMutedState
  },

  toggleMute(): boolean {
    isMutedState = !isMutedState
    if (typeof window !== "undefined") {
      localStorage.setItem("noir_audio_muted", isMutedState ? "true" : "false")
    }
    return isMutedState
  },

  playClick() {
    if (isMutedState) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "triangle"
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04)

      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.04)
    } catch {
      // Audio context might be restricted before first interaction
    }
  },

  playPin() {
    if (isMutedState) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(1400, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.08)

      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.08)
    } catch {}
  },

  playStamp() {
    if (isMutedState) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(120, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.18)

      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.18)
    } catch {}
  },

  playPaper() {
    if (isMutedState) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const bufferSize = ctx.sampleRate * 0.06
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }

      const noise = ctx.createBufferSource()
      noise.buffer = buffer

      const filter = ctx.createBiquadFilter()
      filter.type = "bandpass"
      filter.frequency.value = 1800
      filter.Q.value = 1.2

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06)

      noise.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      noise.start()
      noise.stop(ctx.currentTime + 0.06)
    } catch {}
  },

  playVictory() {
    if (isMutedState) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const notes = [261.63, 329.63, 392.0, 523.25]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "triangle"
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12)

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12)
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.12 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.45)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(ctx.currentTime + idx * 0.12)
        osc.stop(ctx.currentTime + idx * 0.12 + 0.45)
      })
    } catch {}
  },
}
