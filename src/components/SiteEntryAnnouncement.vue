<template>
  <span v-if="false" aria-hidden="true"></span>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { isAprilFoolsSkippedPath } from '@/utils/aprilFools'
import 'sweetalert2/dist/sweetalert2.min.css'

const ANNOUNCEMENT_ID = 'official-account'
const ANNOUNCEMENT_STORAGE_KEY = `site-announcement:${ANNOUNCEMENT_ID}`
const ANNOUNCEMENT_SOURCE = 'https://www.bilibili.com/opus/1251946408080048130'

const route = useRoute()
const { locale } = useI18n()

let isOpening = false
let dismissedInMemory = false

const wasDismissed = () => {
  if (dismissedInMemory) return true

  try {
    return window.localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

const rememberDismissal = () => {
  dismissedInMemory = true

  try {
    window.localStorage.setItem(
      ANNOUNCEMENT_STORAGE_KEY,
      JSON.stringify({
        id: ANNOUNCEMENT_ID,
        dismissedAt: new Date().toISOString(),
        source: ANNOUNCEMENT_SOURCE,
      }),
    )
  } catch {
    // 隐私模式可能禁用 localStorage；内存标记仍可避免本次访问重复弹出。
  }
}

const showAnnouncement = async () => {
  if (
    typeof window === 'undefined' ||
    isOpening ||
    locale.value !== 'zh-CN' ||
    isAprilFoolsSkippedPath(route.path) ||
    wasDismissed()
  ) {
    return
  }

  isOpening = true

  try {
    const { default: Swal } = await import('sweetalert2')

    await Swal.fire({
      title: 'VM汉化组官方新账号启用说明',
      html: `
        <div class="entry-announcement-content">
          <p><strong>重要公告！请关注我们的新B站号！！</strong></p>
          <p>因组内人员变动与业务调整需要，受限于此前账号所有人与实际管理人员不同，各类业务开展繁琐，现统一更换为本独立账号进行运营。</p>
          <p>关于账号交接及近期的各项安排，说明如下：</p>
          <h3>1. 账号唯一性与旧号状态</h3>
          <p>即日起，新的@VM汉化组 是我们Bilibili的唯一官方发布渠道。原B站账号已彻底停更，且原账号内的历史视频后续可能会陆续进行隐藏处理。</p>
          <h3>2. 汉化业务、下载方式与官网说明</h3>
          <p>本次仅调整 B 站运营账号，组内各项汉化工作照常推进。<strong>所有汉化资源的获取与下载方式完全保持不变</strong>，大家无需担心。</p>
          <h3>3. 视频重传安排</h3>
          <p>历史视频的迁移工作正在开展中。团队会陆续补齐旧作，并优先重传以往较为重要的视频，尽量将原有的视频全部搬运至本账号，力争不影响大家的观看。</p>
          <h3>4. QQ交流群重建通知</h3>
          <p>汉化组的QQ群目前正在重新筹建，新群信息确认后会第一时间在本账号动态发布。需要说明的是，原有的旧QQ群自即日起已与VM汉化组无关，请大家留意甄别。</p>
          <p>感谢大家的耐心等待与关注，期待在此与大家继续同行。</p>
          <p class="entry-announcement-signature">VM汉化组<br>2026年9月26日</p>
          <p class="entry-announcement-source"><a href="${ANNOUNCEMENT_SOURCE}" target="_blank" rel="noopener noreferrer">查看 Bilibili 原公告</a></p>
        </div>
      `,
      confirmButtonText: '我知道了',
      confirmButtonColor: '#277038',
      showCloseButton: true,
      width: 'min(720px, calc(100vw - 24px))',
      customClass: {
        popup: 'entry-announcement-popup',
        htmlContainer: 'entry-announcement-html',
      },
    })

    rememberDismissal()
  } finally {
    isOpening = false
  }
}

watch([() => route.path, locale], () => void showAnnouncement(), {
  immediate: true,
  flush: 'post',
})
</script>

<style>
.entry-announcement-popup {
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: min(860px, calc(100dvh - 24px));
  overflow: hidden;
}

.entry-announcement-html {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.entry-announcement-popup .swal2-close {
  position: absolute;
  inset: 0 0 auto auto;
}

.entry-announcement-content {
  color: var(--text-primary, #26332b);
  text-align: left;
  font-size: 0.96rem;
  line-height: 1.7;
}

.entry-announcement-content p {
  margin: 0 0 0.85em;
}

.entry-announcement-content h3 {
  margin: 1.15em 0 0.35em;
  color: #277038;
  font-size: 1rem;
}

.entry-announcement-content a {
  color: #277038;
  overflow-wrap: anywhere;
}

.entry-announcement-signature {
  text-align: right;
}

.entry-announcement-source {
  margin-bottom: 0 !important;
  text-align: center;
  font-size: 0.88rem;
}

.dark .entry-announcement-popup {
  background: #18201b;
  color: #eef7f0;
}

.dark .entry-announcement-popup .swal2-title,
.dark .entry-announcement-content {
  color: #eef7f0;
}

.dark .entry-announcement-content h3,
.dark .entry-announcement-content a {
  color: #89e8bd;
}

@media (max-width: 600px) {
  .entry-announcement-popup {
    padding: 1em 0.75em 0.8em;
  }

  .entry-announcement-popup .swal2-title {
    padding-inline: 0.5em;
    font-size: 1.35rem;
  }

  .entry-announcement-html {
    margin-inline: 0.35em;
  }
}
</style>
