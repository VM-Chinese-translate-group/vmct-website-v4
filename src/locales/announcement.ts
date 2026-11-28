export interface AnnouncementMessage {
  action: string
  body: string
  label: string
}

export const announcementConfig = {
  enabled: true,
  link: '/map/eisoptrophobia',
  messages: {
    'zh-CN': {
      label: '站点公告',
      body: '11月最新成果！恐镜症汉化现已发布！',
      action: '查看',
    },
    'zh-TW': {
      label: '站點公告',
      body: '11月最新成果！恐镜症漢化現已釋出！',
      action: '檢視',
    },
    'en-US': {
      label: 'Site announcement',
      body: 'Latest November release: Eisoptrophobia localization is now available!',
      action: 'View',
    },
  },
} satisfies {
  enabled: boolean
  link: string
  messages: Record<'zh-CN' | 'zh-TW' | 'en-US', AnnouncementMessage>
}
