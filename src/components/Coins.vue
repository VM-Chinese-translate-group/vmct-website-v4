<template>
  <div slide-enter>
    <div class="one-time-donations">
      <div class="flex flex-row flex-wrap items-center justify-center">
        <a
          v-for="(payment, key) in paymentList"
          :key="key"
          :href="`#${key}`"
          :title="payment.name"
          class="flex flex-auto select-none items-center justify-center px-2 py-3 text-center text-4 text-[var(--text-1)] font-600 indent-2 no-underline transition-transform duration-300 @hover:-translate-y-0.75 active:-translate-y-0.75"
        >
          <img :src="`/imgs/svg/${key}.svg`" class="mr-1.5 h-[7%] w-[7%] align-middle" />
          {{ payment.name }}
        </a>
      </div>
    </div>

    <div
      v-if="selectedPayment && coins[selectedPayment]"
      class="slide-enter mt-8 flex items-center justify-around"
    >
      <p
        class="inline-block w-100 overflow-hidden text-ellipsis whitespace-nowrap font-bold max-[788px]:hidden!"
      >
        <img :src="iconSrc" class="animate-whirling mb-3 ml-4 block h-20 w-20" />
        {{ coins[selectedPayment].name }}：
        <br />
        <a
          :href="coins[selectedPayment].address"
          :title="coins[selectedPayment].name"
          target="_blank"
          rel="noopener noreferrer"
          class="font-normal"
        >
          {{ coins[selectedPayment].address }}
        </a>
      </p>
      <img
        :src="qrcode"
        alt="QR Code"
        v-if="qrcode"
        class="rounded-1 bg-white p-1 shadow-[var(--vp-shadow-1)] transition-filter duration-300 dark:filter-invert dark:brightness-90"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useQRCode } from '@vueuse/integrations/useQRCode'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const coins = computed(() => ({
  bilibili: {
    name: 'bilibili',
    address: 'https://space.bilibili.com/3546956559288550',
  },
  afdian: {
    name: t('supportUs.afdText'),
    address: 'https://afdian.com/a/VMhanhuazu',
  },
}))

const paymentList = computed(() => coins.value)
const selectedPayment = ref('')

const iconSrc = computed(() => {
  if (!selectedPayment.value) return ''
  return `/imgs/svg/${selectedPayment.value}.svg`
})

const qrcode = useQRCode(
  () => {
    return coins.value[selectedPayment.value]?.address || ''
  },
  {
    margin: 2,
  },
)

const updatePaymentType = () => {
  const hash = window.location.hash.slice(1)
  selectedPayment.value = hash && coins.value[hash] ? hash : ''
}

onMounted(() => {
  updatePaymentType()
  window.addEventListener('hashchange', updatePaymentType)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', updatePaymentType)
})
</script>
