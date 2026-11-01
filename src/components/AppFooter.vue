<script setup>
/** Page footer: links to the source and to the credits for the data, images and libraries the app uses. */
const REPO = 'https://github.com/captainpainway/astro-dashboard'
const CREDITS = `${import.meta.env.BASE_URL}credits.txt` // public/credits.txt, served beside the page
</script>

<template>
  <footer class="app-footer small muted">
    <a :href="REPO" target="_blank" rel="noopener">GitHub</a>
    <span aria-hidden="true">·</span>
    <a :href="CREDITS" target="_blank" rel="noopener">credits</a>
  </footer>
</template>
