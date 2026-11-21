export interface AnnouncementMessage {
  action: string
  body: string
  label: string
}

export const announcementConfig = {
  enabled: true,
  link: '/modpacks/prominence2',
  messages: {
    'zh-CN': {
      label: '站点公告',
      body: '8月最新成果！卓越 II 汉化现已发布！',
      action: '查看',
    },
    'zh-TW': {
      label: '站點公告',
      body: '8月最新成果！卓越 II 漢化現已釋出！',
      action: '檢視',
    },
    'en-US': {
      label: 'Site announcement',
      body: 'Latest August release: Prominence II localization is now available!',
      action: 'View',
    },
  },
} satisfies {
  enabled: boolean
  link: string
  messages: Record<'zh-CN' | 'zh-TW' | 'en-US', AnnouncementMessage>
}
