<script setup lang="ts">
import { ref } from 'vue'

const message = ref('')
</script>

<template>
  <div class="container">
    <el-card class="card">
      <h1>Candle + WASM Demo</h1>
      <p v-if="message">{{ message }}</p>
      <p v-else>Loading WASM...</p>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
// SCSS 变量定义
$min-card-width: 560px;
$font-family: Arial, sans-serif;
$primary-color: #333;
$secondary-color: #666;

.container {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  font-family: $font-family;
}

.card {
  width: min($min-card-width, 100%);
}

h1 {
  color: $primary-color;
  margin: 0 0 1em;
  font-size: 28px;
  line-height: 1.2;
}

p {
  color: $secondary-color;
  font-size: 1.2em;
}
</style>
