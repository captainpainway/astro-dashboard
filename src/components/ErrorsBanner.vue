<script setup>
defineProps({ errors: { type: Array, default: () => [] } })
</script>

<template>
  <div v-if="errors.length" class="errors-banner" role="alert">
    <strong>Partial data</strong> — upstream problem:
    <ul><li v-for="e in errors" :key="e">{{ e }}</li></ul>
  </div>
</template>

<style scoped>
.errors-banner { background: #3a1f1f; border: 1px solid var(--warn); border-radius: 8px; padding: 0.75rem 1rem; }
.errors-banner ul { margin: 0.25rem 0 0 1.25rem; }
</style>