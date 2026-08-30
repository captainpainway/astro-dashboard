import { ref, shallowRef } from 'vue'
import { fetchForecast } from '../api'

export function useForecast() {
  const data = shallowRef(null)
  const loading = ref(false)
  const error = ref(null)
  const loaded = ref(false)

  async function load({ date } = {}) {
    loading.value = true
    error.value = null
    try {
      data.value = await fetchForecast({ date })
      loaded.value = true
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, loaded, load }
}