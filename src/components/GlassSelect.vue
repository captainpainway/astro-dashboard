<script setup>
// Glass listbox used instead of <select>: the native popup can't take the glass styling
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'

const props = defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true }, // [{ value, label }]
  label: { type: String, default: '' }, // visible caption; falls back to ariaLabel
  ariaLabel: { type: String, default: '' },
  align: { type: String, default: 'left' }, // which edge of the trigger the menu lines up with
})
const emit = defineEmits(['update:modelValue'])

const id = useId()
const open = ref(false)
const activeIndex = ref(0)
const root = ref(null)
const trigger = ref(null)
const menu = ref(null)
const currentLabel = computed(() => props.options.find((o) => o.value === props.modelValue)?.label ?? props.modelValue)
const optId = (i) => `${id}-opt-${i}`

function scrollActiveIntoView() {
  document.getElementById(optId(activeIndex.value))?.scrollIntoView?.({ block: 'nearest' })
}
async function openMenu() {
  activeIndex.value = Math.max(0, props.options.findIndex((o) => o.value === props.modelValue))
  open.value = true
  await nextTick()
  menu.value?.focus()
  scrollActiveIntoView()
}
function closeMenu(refocus = true) {
  open.value = false
  if (refocus) trigger.value?.focus()
}
function choose(i) {
  emit('update:modelValue', props.options[i].value)
  closeMenu()
}
function onTriggerKey(e) {
  if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu() }
}
function onMenuKey(e) {
  const last = props.options.length - 1
  switch (e.key) {
    case 'ArrowDown': activeIndex.value = Math.min(last, activeIndex.value + 1); break
    case 'ArrowUp': activeIndex.value = Math.max(0, activeIndex.value - 1); break
    case 'Home': activeIndex.value = 0; break
    case 'End': activeIndex.value = last; break
    case 'Enter': case ' ': choose(activeIndex.value); return e.preventDefault()
    case 'Escape': closeMenu(); return e.preventDefault()
    case 'Tab': closeMenu(false); return
    default: return
  }
  e.preventDefault()
  scrollActiveIntoView()
}
function onOutside(e) {
  if (open.value && !root.value?.contains(e.target)) closeMenu(false)
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <div ref="root" class="glass-select">
    <span v-if="label" :id="`${id}-label`" class="glass-select-label">{{ label }}</span>
    <button ref="trigger" type="button" class="glass-select-trigger" aria-haspopup="listbox" :aria-expanded="open"
            :aria-label="label ? undefined : `${ariaLabel} ${currentLabel}`"
            :aria-labelledby="label ? `${id}-label ${id}-current` : undefined"
            @click="open ? closeMenu() : openMenu()" @keydown="onTriggerKey">
      <span :id="`${id}-current`">{{ currentLabel }}</span>
    </button>
    <ul v-if="open" ref="menu" :class="['glass-select-menu', `align-${align}`]" role="listbox" tabindex="-1"
        :aria-labelledby="label ? `${id}-label` : undefined" :aria-label="label ? undefined : ariaLabel"
        :aria-activedescendant="optId(activeIndex)" @keydown="onMenuKey">
      <li v-for="(o, i) in options" :id="optId(i)" :key="o.value" role="option"
          :aria-selected="o.value === modelValue" :class="{ highlighted: i === activeIndex }"
          @click="choose(i)" @mouseenter="activeIndex = i">{{ o.label }}</li>
    </ul>
  </div>
</template>
