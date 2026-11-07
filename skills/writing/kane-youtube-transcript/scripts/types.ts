export type Format = "md" | "srt" | "vtt" | "txt" | "json"

export interface Video {
  id: string
  title: string
  channel: string
  url: string
  duration: number
  language: string
}

export interface Track {
  code: string
  name: string
  kind: "manual" | "generated"
  translated: boolean
  sourceCode: string
  url: string
}

export interface Cue {
  startMs: number
  durationMs: number
  text: string
}

export interface Source {
  video: Video
  tracks: Track[]
  download(track: Track): Promise<string>
  close(): Promise<void>
}
