<template>
  <div class="flex flex-col">
    <NavBar v-if="!embedded" />
    <SiteAnnouncement v-if="!embedded && !route.path.startsWith('/admin')" />

    <router-view />

    <Footer v-if="!embedded" />
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

import NavBar from '@/components/NavBar/NavBar.vue'
import SiteAnnouncement from '@/components/SiteAnnouncement.vue'
import Footer from '@/components/Footer/Footer.vue'
import { useSiteContent } from '@/content/store'

const route = useRoute()
const { embedded } = useSiteContent()

</script>
