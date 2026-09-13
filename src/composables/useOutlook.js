import { ref, shallowRef } from 'vue'
import { fetchOutlook } from '../api'

export function useOutlook() {
  const data = shallowRef(null)
  const loading = ref(false)
  const error = ref(null)
  const loaded = ref(false)

  async function load({ nights } = {}) {
    loading.value = true
    error.value = null
    try {
      data.value = await fetchOutlook({ nights })
      loaded.value = true
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, loaded, load }
}