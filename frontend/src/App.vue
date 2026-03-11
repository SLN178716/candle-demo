<script setup lang="ts">
import { ref, onMounted } from 'vue'
import init, { greet } from './wasm-pkg/wasm'

const message = ref('')

onMounted(async () => {
  await init()
  message.value = greet('Vue 3')
})
</script>

<template>
  <div class="container">
    <div class="card">
      <h1>Candle + WASM Demo</h1>
      <p v-if="message">{{ message }}</p>
      <p v-else>Loading WASM...</p>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  font-family: Arial, sans-serif;
}

.card {
  padding: 2em;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  text-align: center;
  background: #f9f9f9;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 100%;
}

h1 {
  color: #333;
  margin-bottom: 1em;
}

p {
  color: #666;
  font-size: 1.2em;
}
</style>
