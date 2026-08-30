import { ref, shallowRef } from 'vue'
import { fetchDiscover } from '../api'

export function useDiscover() {
  const data = shallowRef(null)
  const loading = ref(false)
  const error = ref(null)
  const loaded = ref(false)

  async function load({ limit, charts } = {}) {
    loading.value = true
    error.value = null
    try {
      data.value = await fetchDiscover({ limit, charts })
      loaded.value = true
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, loaded, load }
}