import { defineComponent, h } from 'vue'
import arrowUpRight from '@iconify-icons/lucide/arrow-up-right'
import badgeCheck from '@iconify-icons/lucide/badge-check'
import blocks from '@iconify-icons/lucide/blocks'
import bold from '@iconify-icons/lucide/bold'
import boxes from '@iconify-icons/lucide/boxes'
import calendar from '@iconify-icons/lucide/calendar'
import calendarClock from '@iconify-icons/lucide/calendar-clock'
import calendarDays from '@iconify-icons/lucide/calendar-days'
import calendarHeart from '@iconify-icons/lucide/calendar-heart'
import check from '@iconify-icons/lucide/check'
import checkCircle2 from '@iconify-icons/lucide/check-circle-2'
import chevronDown from '@iconify-icons/lucide/chevron-down'
import chevronLeft from '@iconify-icons/lucide/chevron-left'
import chevronRight from '@iconify-icons/lucide/chevron-right'
import chevronUp from '@iconify-icons/lucide/chevron-up'
import circle from '@iconify-icons/lucide/circle'
import circleAlert from '@iconify-icons/lucide/circle-alert'
import circleCheck from '@iconify-icons/lucide/circle-check'
import circleDashed from '@iconify-icons/lucide/circle-dashed'
import circlePause from '@iconify-icons/lucide/circle-pause'
import cloudDownload from '@iconify-icons/lucide/cloud-download'
import code from '@iconify-icons/lucide/code'
import code2 from '@iconify-icons/lucide/code-2'
import command from '@iconify-icons/lucide/command'
import download from '@iconify-icons/lucide/download'
import externalLink from '@iconify-icons/lucide/external-link'
import eye from '@iconify-icons/lucide/eye'
import fileText from '@iconify-icons/lucide/file-text'
import flame from '@iconify-icons/lucide/flame'
import folderDown from '@iconify-icons/lucide/folder-down'
import folderOpen from '@iconify-icons/lucide/folder-open'
import heading2 from '@iconify-icons/lucide/heading-2'
import heart from '@iconify-icons/lucide/heart'
import heartHandshake from '@iconify-icons/lucide/heart-handshake'
import heartPlus from '@iconify-icons/lucide/heart-plus'
import image from '@iconify-icons/lucide/image'
import info from '@iconify-icons/lucide/info'
import italic from '@iconify-icons/lucide/italic'
import languages from '@iconify-icons/lucide/languages'
import layers from '@iconify-icons/lucide/layers'
import link from '@iconify-icons/lucide/link'
import list from '@iconify-icons/lucide/list'
import listFilter from '@iconify-icons/lucide/list-filter'
import listOrdered from '@iconify-icons/lucide/list-ordered'
import loader2 from '@iconify-icons/lucide/loader-2'
import loaderCircle from '@iconify-icons/lucide/loader-circle'
import map from '@iconify-icons/lucide/map'
import megaphone from '@iconify-icons/lucide/megaphone'
import messageSquarePlus from '@iconify-icons/lucide/message-square-plus'
import monitor from '@iconify-icons/lucide/monitor'
import moon from '@iconify-icons/lucide/moon'
import packageIcon from '@iconify-icons/lucide/package'
import packageOpen from '@iconify-icons/lucide/package-open'
import pauseCircle from '@iconify-icons/lucide/pause-circle'
import plus from '@iconify-icons/lucide/plus'
import quote from '@iconify-icons/lucide/quote'
import refreshCw from '@iconify-icons/lucide/refresh-cw'
import rotateCcw from '@iconify-icons/lucide/rotate-ccw'
import search from '@iconify-icons/lucide/search'
import searchX from '@iconify-icons/lucide/search-x'
import sparkles from '@iconify-icons/lucide/sparkles'
import sun from '@iconify-icons/lucide/sun'
import tag from '@iconify-icons/lucide/tag'
import trash2 from '@iconify-icons/lucide/trash-2'
import triangleAlert from '@iconify-icons/lucide/triangle-alert'
import users from '@iconify-icons/lucide/users'
import wifiOff from '@iconify-icons/lucide/wifi-off'
import wrench from '@iconify-icons/lucide/wrench'
import x from '@iconify-icons/lucide/x'
import zap from '@iconify-icons/lucide/zap'
import microsoftMinecraft from '@iconify-icons/mdi/microsoft-minecraft'

interface IconData {
  body: string
  width?: number
  height?: number
  left?: number
  top?: number
}

const icons: Record<string, IconData | undefined> = {
  'lucide:arrow-up-right': arrowUpRight,
  'lucide:badge-check': badgeCheck,
  'lucide:blocks': blocks,
  'lucide:bold': bold,
  'lucide:boxes': boxes,
  'lucide:calendar': calendar,
  'lucide:calendar-clock': calendarClock,
  'lucide:calendar-days': calendarDays,
  'lucide:calendar-heart': calendarHeart,
  'lucide:check': check,
  'lucide:check-circle-2': checkCircle2,
  'lucide:chevron-down': chevronDown,
  'lucide:chevron-left': chevronLeft,
  'lucide:chevron-right': chevronRight,
  'lucide:chevron-up': chevronUp,
  'lucide:circle': circle,
  'lucide:circle-alert': circleAlert,
  'lucide:circle-check': circleCheck,
  'lucide:circle-dashed': circleDashed,
  'lucide:circle-pause': circlePause,
  'lucide:cloud-download': cloudDownload,
  'lucide:code': code,
  'lucide:code-2': code2,
  'lucide:command': command,
  'lucide:download': download,
  'lucide:external-link': externalLink,
  'lucide:eye': eye,
  'lucide:file-text': fileText,
  'lucide:flame': flame,
  'lucide:folder-down': folderDown,
  'lucide:folder-open': folderOpen,
  'lucide:heading-2': heading2,
  'lucide:heart': heart,
  'lucide:heart-handshake': heartHandshake,
  'lucide:heart-plus': heartPlus,
  'lucide:image': image,
  'lucide:info': info,
  'lucide:italic': italic,
  'lucide:languages': languages,
  'lucide:layers': layers,
  'lucide:link': link,
  'lucide:list': list,
  'lucide:list-filter': listFilter,
  'lucide:list-ordered': listOrdered,
  'lucide:loader-2': loader2,
  'lucide:loader-circle': loaderCircle,
  'lucide:map': map,
  'lucide:megaphone': megaphone,
  'lucide:message-square-plus': messageSquarePlus,
  'lucide:monitor': monitor,
  'lucide:moon': moon,
  'lucide:package': packageIcon,
  'lucide:package-open': packageOpen,
  'lucide:pause-circle': pauseCircle,
  'lucide:plus': plus,
  'lucide:quote': quote,
  'lucide:refresh-cw': refreshCw,
  'lucide:rotate-ccw': rotateCcw,
  'lucide:search': search,
  'lucide:search-x': searchX,
  'lucide:sparkles': sparkles,
  'lucide:sun': sun,
  'lucide:tag': tag,
  'lucide:trash-2': trash2,
  'lucide:triangle-alert': triangleAlert,
  'lucide:users': users,
  'lucide:wifi-off': wifiOff,
  'lucide:wrench': wrench,
  'lucide:x': x,
  'lucide:zap': zap,
  'mdi:microsoft-minecraft': microsoftMinecraft,
}

export const Icon = defineComponent({
  name: 'Icon',
  inheritAttrs: false,
  props: {
    icon: { type: String, required: true },
    width: [String, Number],
    height: [String, Number],
  },
  setup(props, { attrs }) {
    return () => {
      const data = Object.hasOwn(icons, props.icon) ? icons[props.icon] : undefined
      if (!data) return null

      const { body, left = 0, top = 0, width = 16, height = 16 } = data
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        role: 'img',
        'aria-hidden': true,
        ...attrs,
        width: props.width ?? props.height ?? '1em',
        height: props.height ?? props.width ?? '1em',
        viewBox: `${left} ${top} ${width} ${height}`,
        innerHTML: body,
      })
    }
  },
})
