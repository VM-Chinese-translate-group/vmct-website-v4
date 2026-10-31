<template>
  <section
    class="mx-auto mt-[10vh] w-[min(26rem,100%)] rounded-2xl border border-[var(--switcher-border)] bg-[var(--bg-alt)] p-7 shadow-[var(--switcher-shadow)]"
  >
    <p class="mb-2 text-xs font-800 tracking-[0.14em] text-[var(--info-1)]">CONTENT CMS</p>
    <h1 class="m-0 text-2xl">{{ ssoOrigin ? 'VMPM 统一登录' : needsSetup ? '设置后台密码' : '后台登录' }}</h1>
    <p class="mb-0 mt-2 text-sm text-[var(--text-2)]">登录后可管理网站内容、发布状态和历史版本。</p>
    <div v-if="ssoOrigin" class="mt-6 grid gap-3">
      <p v-if="embedded" class="m-0 text-sm">正在使用 VMPM 管理员身份连接；如连接失败，可重试。</p>
      <button v-if="embedded" class="cms-primary-button" :disabled="busy" @click="$emit('sso')">重新连接</button>
      <a v-else class="cms-primary-button text-center no-underline" :href="ssoOrigin + '/website-content'">前往 VMPM 管理官网内容</a>
    </div>
    <form v-else class="mt-6 grid gap-3" @submit.prevent="$emit('submit', password)">
      <input
        v-model="password"
        type="password"
        placeholder="至少 6 位，可含数字、字母或符号"
        class="cms-field"
        minlength="6"
        required
        autofocus
      />
      <button class="cms-primary-button" :disabled="busy">
        {{ busy ? '请稍候…' : needsSetup ? '设置并进入后台' : '登录' }}
      </button>
    </form>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ needsSetup: boolean; busy: boolean; ssoOrigin: string; embedded: boolean }>()
defineEmits<{ submit: [password: string]; sso: [] }>()
const password = ref('')
</script>
