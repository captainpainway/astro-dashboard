import { ref, shallowRef } from 'vue'
import { fetchTonight } from '../api'

export function useTonight() {
  const data = shallowRef(null)
  const loading = ref(false)
  const error = ref(null)

  async function load({ at, include } = {}) {
    loading.value = true
    error.value = null
    try {
      data.value = await fetchTonight({ at, include })
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
}