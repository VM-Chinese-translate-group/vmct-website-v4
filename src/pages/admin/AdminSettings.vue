<template>
  <div class="grid gap-5">
    <section class="cms-panel">
      <h2 class="m-0 text-xl">内容发布</h2>
      <p class="text-sm text-[var(--text-2)]">
        发布后网站会读取最新内容，无需重新构建。需要重新读取已发布内容时，可刷新站点缓存。
      </p>
      <button class="cms-button" type="button" :disabled="busy" @click="$emit('retry-deploy')">
        刷新站点缓存
      </button>
    </section>
    <section class="cms-panel">
      <h2 class="m-0 text-xl">登录安全</h2>
      <p class="text-sm text-[var(--text-2)]">
        修改密码后所有设备会退出。原始密码只在浏览器中派生。
      </p>
      <p v-if="managedByEnvironment" class="text-sm text-[var(--text-muted)]">
        {{
          unifiedLogin
            ? '登录身份与管理权限由 VMPM 统一管理。'
            : '当前密码由 ECS 环境变量管理，请在服务器配置中更新。'
        }}
      </p>
      <form v-else class="grid max-w-lg gap-2" @submit.prevent="submitPassword">
        <input
          v-model="password"
          class="cms-field"
          type="password"
          minlength="6"
          placeholder="新密码（至少 6 位）"
          required
        />
        <input
          v-model="confirmation"
          class="cms-field"
          type="password"
          minlength="6"
          placeholder="再次输入新密码"
          required
        />
        <small v-if="passwordError" class="text-red-600 dark:text-red-400">
          {{ passwordError }}
        </small>
        <button class="cms-button w-fit" :disabled="busy">修改密码</button>
      </form>
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
defineProps<{
  managedByEnvironment: boolean
  unifiedLogin: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  'change-password': [value: string]
  'retry-deploy': []
}>()
const password = ref(''),
  confirmation = ref(''),
  passwordError = ref('')
function submitPassword() {
  if (password.value !== confirmation.value) {
    passwordError.value = '两次输入的新密码不一致。'
    return
  }
  passwordError.value = ''
  emit('change-password', password.value)
  password.value = ''
  confirmation.value = ''
}
</script>
