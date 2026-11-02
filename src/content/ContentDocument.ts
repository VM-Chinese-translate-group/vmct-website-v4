import { defineComponent, h, type Component, type PropType, type VNodeChild } from 'vue'
import DownloadLinks from '@/components/DownloadPage/DownloadLinks.vue'
import DocSupport from '@/components/DocSupport.vue'
import DonateLayout from '@/layout/DonateLayout.vue'
import JoinGroupCard from '@/components/JoinGroupCard.vue'
import Card from '@/components/Card/Card.vue'
import type { ContentNode } from './store'

const components: Record<string, Component> = {
  DownloadLinks,
  DocSupport,
  DonateLayout,
  JoinGroupCard,
  Card,
}
function renderNode(node: ContentNode | string): VNodeChild {
  if (typeof node === 'string') return node
  const children = node.children?.map(renderNode)
  const component = Object.hasOwn(components, node.tag) ? components[node.tag] : undefined
  return component
    ? h(component, node.props, children?.length ? { default: () => children } : undefined)
    : h(node.tag, node.props, children)
}
export default defineComponent({
  name: 'ContentDocument',
  props: { nodes: { type: Array as PropType<Array<ContentNode | string>>, required: true } },
  setup: (props) => () => props.nodes.map(renderNode),
})
