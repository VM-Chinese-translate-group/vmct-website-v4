import { computed, onMounted, ref } from 'vue'
import { announcements } from '@/data/announcements'

const STORAGE_KEY = 'site-announcements:seen'
const currentVersions = new Map<string, string>()

for (const announcement of announcements) {
  currentVersions.set(
    `markdown:${announcement.id}`,
    JSON.stringify([announcement.title, announcement.publishedAt]),
  )
}

export function useAnnouncementNotifications() {
  const seenVersions = ref<Record<string, string>>({})
  const loaded = ref(false)
  const hasUnread = computed(() => {
    if (!loaded.value) return false
    for (const [id, version] of currentVersions) {
      if (seenVersions.value[id] !== version) return true
    }
    return false
  })

  onMounted(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        seenVersions.value = stored as Record<string, string>
      }
    } catch {
      // 无法读取或记录损坏时，将当前公告视为尚未查看。
    }
    loaded.value = true
  })

  const markSeen = () => {
    if (!hasUnread.value) return
    const next = { ...seenVersions.value }
    for (const [id, version] of currentVersions) next[id] = version
    seenVersions.value = next
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 存储不可用时，仍在当前页面会话中清除提醒。
    }
  }

  return { hasUnread, markSeen }
}
