<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import SuccessStatusIcon from '@/components/SuccessStatusIcon.vue'
import { announcements } from '@/data/announcements'
import { formatUpdateDate } from '@/utils/dateFormat'

defineProps<{
  idPrefix: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()
const { locale, t } = useI18n()

function isImageIcon(icon: string) {
  return (
    icon.startsWith('/') ||
    icon.startsWith('https://') ||
    icon.startsWith('http://')
  )
}
</script>

<template>
  <ul v-if="announcements.length" class="announcement-list">
    <li v-for="item in announcements" :key="item.id">
      <button
        :id="`${idPrefix}-${encodeURIComponent(item.id)}`"
        type="button"
        class="announcement-list-item"
        @click="emit('select', item.id)"
      >
        <img
          v-if="item.icon && isImageIcon(item.icon)"
          :src="item.icon"
          class="announcement-item-icon"
          alt=""
          aria-hidden="true"
        />
        <Icon
          v-else
          :icon="item.icon || (item.pinned ? 'lucide:pin' : 'lucide:megaphone')"
          class="announcement-item-icon"
          aria-hidden="true"
        />
        <span class="announcement-item-text">
          <span v-if="item.pinned" class="announcement-item-pinned">
            {{ t('announcements.pinned') }}
          </span>
          {{ item.title }}
          <time
            v-if="item.publishedAt"
            class="announcement-item-date"
            :datetime="item.publishedAt"
            :title="t('announcements.publishedAt')"
          >
            {{ formatUpdateDate(item.publishedAt, locale) }}
          </time>
        </span>
        <Icon icon="lucide:arrow-right" class="announcement-item-arrow" aria-hidden="true" />
      </button>
    </li>
  </ul>
  <div v-else class="announcement-empty">
    <SuccessStatusIcon class="announcement-empty-status" />
    <p>{{ t('announcements.empty') }}</p>
  </div>
</template>

<style scoped>
.announcement-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.announcement-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  padding: 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-dark);
  font: inherit;
  line-height: 1.5;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.announcement-list-item:hover {
  background: var(--bg-soft);
}
.announcement-list-item:focus-visible {
  outline: 2px solid var(--info-1);
  outline-offset: -2px;
}
.announcement-item-icon {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  color: var(--nav-primary);
  object-fit: contain;
}
.announcement-item-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.announcement-item-pinned {
  display: inline-flex;
  align-items: center;
  margin-right: 6px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--info-soft);
  color: var(--nav-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  vertical-align: middle;
}
.announcement-item-date {
  display: block;
  margin-top: 4px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.announcement-item-arrow {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  color: var(--text-2);
}
.announcement-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  box-sizing: border-box;
  min-height: 170px;
  padding: 16px;
  color: var(--text-2);
  text-align: center;
}
.announcement-empty p {
  margin: 0;
}
.announcement-empty .announcement-empty-status {
  width: 48px;
  height: 48px;
  box-shadow: 0 0 0 6px var(--bg-soft);
}
.announcement-empty :deep(.success-status-check) {
  width: 24px;
  height: 24px;
}
</style>
