<template>
  <div class="grid gap-5">
    <section class="cms-panel">
      <h2 class="m-0 text-xl">部署设置</h2>
      <p class="text-sm text-[var(--text-2)]">
        发布内容后通过 Cloudflare Pages Production Deploy Hook 生成网站。
      </p>
      <label class="cms-label max-w-4xl">
        Deploy Hook URL
        <div class="flex gap-2 max-sm:flex-col">
          <input
            v-model="hook"
            class="cms-field flex-1"
            type="url"
            placeholder="https://api.cloudflare.com/..."
          />
          <button
            class="cms-button"
            type="button"
            :disabled="busy"
            @click="$emit('save-hook', hook)"
          >
            保存设置
          </button>
          <button class="cms-button" type="button" :disabled="busy" @click="$emit('retry-deploy')">
            测试构建
          </button>
        </div>
      </label>
    </section>
    <section class="cms-panel">
      <h2 class="m-0 text-xl">登录安全</h2>
      <p class="text-sm text-[var(--text-2)]">
        修改密码后所有设备会退出。原始密码只在浏览器中派生。
      </p>
      <p v-if="managedByEnvironment" class="text-sm text-[var(--text-muted)]">
        当前密码由 Cloudflare 加密变量管理，请在项目设置中更新。
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
import { ref, watch } from 'vue'
const props = defineProps<{
  deploymentHook: string
  managedByEnvironment: boolean
  busy: boolean
}>()
const emit = defineEmits<{
  'save-hook': [value: string]
  'change-password': [value: string]
  'retry-deploy': []
}>()
const hook = ref(props.deploymentHook),
  password = ref(''),
  confirmation = ref(''),
  passwordError = ref('')
watch(
  () => props.deploymentHook,
  (value) => {
    hook.value = value
  },
)
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
