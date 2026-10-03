import { ref, shallowRef } from 'vue'
import { resolvePoint, roundCoord } from '../engine/nws'

const STORAGE_KEY = 'astrodash.location'

/** Public demo site (never the owner's home). Pre-resolved, so first load needs no NWS call. */
export const DEMO_LOCATION = Object.freeze({
  name: 'Big Bend National Park, TX',
  latitude: 29.33,
  longitude: -103.21,
  elevationM: 1111, // NWS gridpoint MAF 74,18
  timezone: 'America/Chicago',
})

function isValid(loc) {
  return typeof loc?.name === 'string' && typeof loc.timezone === 'string' && loc.timezone !== '' &&
    Number.isFinite(loc.latitude) && Math.abs(loc.latitude) <= 90 &&
    Number.isFinite(loc.longitude) && Math.abs(loc.longitude) <= 180
}

function readStored() {
  try {
    const loc = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (!isValid(loc)) return DEMO_LOCATION
    return { ...loc, latitude: roundCoord(loc.latitude), longitude: roundCoord(loc.longitude) }
  } catch {
    return DEMO_LOCATION
  }
}

function writeStored(loc) {
  try {
    if (loc) localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* storage unavailable: location still applies for this visit */ }
}

const GEO_ERRORS = { 1: 'Location permission was denied', 2: 'Your position is unavailable', 3: 'Locating you timed out' }

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser cannot share your location'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      (e) => reject(new Error(GEO_ERRORS[e.code] ?? 'Could not get your location')),
      { timeout: 10_000, maximumAge: 600_000 })
  })
}

/** The visitor's observing location: saved in this browser, demo by default. */
export function useLocation() {
  const location = shallowRef(readStored())
  const error = ref(null)
  const resolving = ref(false)
  let latest = 0 // only the newest lookup may change the location

  async function setCoordinates(lat, lon) {
    const mine = ++latest
    resolving.value = true
    error.value = null
    try {
      const loc = await resolvePoint(lat, lon)
      if (mine !== latest) return
      location.value = loc
      writeStored(loc)
    } catch (e) {
      if (mine === latest) error.value = e.message
    } finally {
      if (mine === latest) resolving.value = false
    }
  }

  async function locateMe() {
    resolving.value = true
    error.value = null
    let coords
    try {
      coords = await currentPosition()
    } catch (e) {
      error.value = e.message
      resolving.value = false
      return
    }
    await setCoordinates(coords.latitude, coords.longitude)
  }

  function reset() {
    latest++
    writeStored(null)
    location.value = DEMO_LOCATION
    error.value = null
    resolving.value = false
  }

  return { location, error, resolving, setCoordinates, locateMe, reset }
}
