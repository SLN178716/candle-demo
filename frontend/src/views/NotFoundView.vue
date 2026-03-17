<template>
  <div class="not-found">
    <el-card class="card">
      <el-empty description="页面不存在">
        <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
      </el-empty>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
// SCSS 变量定义
$min-card-width: 560px;

.not-found {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.card {
  width: min($min-card-width, 100%);
}
</style>
