import { ref, shallowRef } from 'vue'
import { fetchTonight, tonightPlan } from '../api'

/** `location`: ref to the observing location (see useLocation). */
export function useTonight(location) {
  const data = shallowRef(null)
  const loading = ref(false)
  const error = ref(null)

  async function load({ at, include } = {}) {
    loading.value = true
    error.value = null
    try {
      // The plan needs no network: on first load show it at once (weather: null), then the full result.
      if (!data.value) data.value = tonightPlan({ at, include, location: location.value })
      data.value = await fetchTonight({ at, include, location: location.value })
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
}
