import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { STARS, CONSTELLATIONS } from '../data/stars'
import type { Star, ObservationNote } from '../types'

const STORAGE_KEY = 'sky-observation-notes'

export const useSkyStore = defineStore('sky', () => {
  const viewDate = ref(new Date())
  const zoom = ref(1.0)
  const panX = ref(0)
  const panY = ref(0)
  const showLabels = ref(true)
  const showConstLines = ref(true)
  const showGrid = ref(true)
  const selectedStar = ref<Star | null>(null)
  const searchQuery = ref('')
  const latitude = ref(39.9) // Beijing default

  const notes = ref<ObservationNote[]>(loadNotes())

  function loadNotes(): ObservationNote[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  watch(notes, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  const notesByStar = computed(() => {
    const map: Record<string, ObservationNote[]> = {}
    for (const n of notes.value) {
      if (!map[n.starName]) map[n.starName] = []
      map[n.starName].push(n)
    }
    for (const k in map) map[k].sort((a, b) => b.createdAt - a.createdAt)
    return map
  })

  const notesByDate = computed(() => {
    const map: Record<string, ObservationNote[]> = {}
    for (const n of notes.value) {
      if (!map[n.date]) map[n.date] = []
      map[n.date].push(n)
    }
    const sortedKeys = Object.keys(map).sort((a, b) => b.localeCompare(a))
    return { map, sortedKeys }
  })

  function addNote(starName: string, content: string, date: string) {
    const note: ObservationNote = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      starName,
      content,
      date,
      createdAt: Date.now()
    }
    notes.value.unshift(note)
    return note
  }

  function deleteNote(id: string) {
    notes.value = notes.value.filter(n => n.id !== id)
  }

  function getNotesForStar(starName: string): ObservationNote[] {
    return notesByStar.value[starName] || []
  }

  const localSiderealTime = computed(() => {
    const d = viewDate.value
    const jd = d.getTime() / 86400000 + 2440587.5
    const T = (jd - 2451545.0) / 36525.0
    let lst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + T * T * (0.000387933 - T / 38710000)
    lst = ((lst % 360) + 360) % 360
    return lst / 15 // convert to hours
  })

  const filteredStars = computed(() => {
    if (!searchQuery.value) return []
    const q = searchQuery.value.toLowerCase()
    return STARS.filter(s => s.name.toLowerCase().includes(q)).slice(0, 5)
  })

  function projectStar(ra: number, dec: number, cx: number, cy: number, scale: number): [number, number] {
    const ha = (localSiderealTime.value - ra) * 15 * Math.PI / 180
    const decRad = dec * Math.PI / 180
    const latRad = latitude.value * Math.PI / 180

    const alt = Math.asin(Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(ha))
    const az = Math.atan2(-Math.cos(decRad) * Math.sin(ha), Math.sin(decRad) * Math.cos(latRad) - Math.cos(decRad) * Math.sin(latRad) * Math.cos(ha))

    if (alt < -0.1) return [-999, -999] // below horizon

    const r = (Math.PI / 2 - alt) * scale * 0.45
    const x = cx + panX.value + r * Math.sin(az)
    const y = cy + panY.value - r * Math.cos(az)
    return [x, y]
  }

  function starRadius(mag: number): number {
    return Math.max(1, 5 - mag) * zoom.value
  }

  function spectralColor(spectral: string): string {
    const colors: Record<string, string> = {
      'O': '#9bb0ff', 'B': '#aabfff', 'A': '#cad7ff',
      'F': '#f8f7ff', 'G': '#fff4ea', 'K': '#ffd2a1', 'M': '#ffcc6f'
    }
    return colors[spectral] || '#ffffff'
  }

  function selectStar(x: number, y: number, cx: number, cy: number, scale: number) {
    let closest: Star | null = null
    let minDist = 20
    for (const star of STARS) {
      const [sx, sy] = projectStar(star.ra, star.dec, cx, cy, scale)
      const dist = Math.hypot(sx - x, sy - y)
      if (dist < minDist) { minDist = dist; closest = star }
    }
    selectedStar.value = closest
  }

  return {
    viewDate, zoom, panX, panY, showLabels, showConstLines, showGrid,
    selectedStar, searchQuery, latitude, localSiderealTime, filteredStars,
    notes, notesByStar, notesByDate,
    projectStar, starRadius, spectralColor, selectStar,
    addNote, deleteNote, getNotesForStar,
    STARS, CONSTELLATIONS
  }
})
