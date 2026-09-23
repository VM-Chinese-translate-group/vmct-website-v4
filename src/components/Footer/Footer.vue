<template>
  <footer class="[background:var(--footer-bg-gradient)] text-[var(--text-medium)]">
    <div
      class="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-4 py-8 max-[768px]:flex-col max-[768px]:text-center"
    >
      <div class="flex min-w-48 flex-col items-center">
        <img class="h-40 w-40" v-lazy="siteLogo" />
        <p class="max-w-[300px] break-words text-center max-[768px]:max-w-[200px]">
          {{ $t('footer.copyright') }}
        </p>

        <div>
          <p class="mb-0.5">
            {{ $t('footer.buildInfo', { branch: branchName }) }}@
            <a
              :href="`https://github.com/${repoPath}/commit/${commitId}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--text-medium)] no-underline transition-colors duration-300 hover:text-[var(--footer-link-hover)]"
            >
              {{ commitId }}
            </a>
          </p>
          <p class="text-center text-[0.85rem] text-[var(--text-medium)]">{{ commitDate }}</p>
        </div>
      </div>

      <div
        class="flex flex-1 flex-wrap justify-around gap-[clamp(2rem,8vw,5rem)] max-[768px]:justify-center max-[768px]:gap-8"
      >
        <div class="column">
          <h3 class="mb-[0.8rem] text-[var(--text-dark)] font-bold">{{ $t('footer.about') }}</h3>
          <ul class="m-0 list-none p-0">
            <li>
              <a href="/community" class="vm-link-underline mb-2">
                {{ $t('footer.joinUs') }}
              </a>
            </li>
            <li>
              <a href="/support-us" class="vm-link-underline mb-2">{{ $t('footer.supportUs') }}</a>
            </li>
            <li>
              <a href="/friends-links" class="vm-link-underline mb-2">
                {{ $t('footer.friendsLinks') }}
              </a>
            </li>
            <li>
              <a href="/credits" class="vm-link-underline mb-2">{{ $t('footer.credits') }}</a>
            </li>
          </ul>
        </div>
        <div class="column">
          <h3 class="mb-[0.8rem] text-[var(--text-dark)] font-bold">
            {{ $t('footer.policy') }}
          </h3>
          <ul class="m-0 list-none p-0">
            <li>
              <a href="/privacy" class="vm-link-underline mb-2">{{ $t('footer.privacy') }}</a>
            </li>
            <li>
              <a href="/agreement" class="vm-link-underline mb-2">
                {{ $t('footer.agreement') }}
              </a>
            </li>
          </ul>
        </div>
        <div class="column">
          <h3 class="mb-[0.8rem] text-[var(--text-dark)] font-bold">
            {{ $t('footer.products') }}
          </h3>
          <ul class="m-0 list-none p-0">
            <li>
              <a href="/modpacks" class="vm-link-underline mb-2">{{ $t('footer.modpacks') }}</a>
            </li>
            <li>
              <a href="/map" class="vm-link-underline mb-2">{{ $t('footer.maps') }}</a>
            </li>
            <li>
              <a href="https://dict.vmct-cn.top/" class="vm-link-underline mb-2">
                {{ $t('footer.dict') }}
              </a>
            </li>
            <li>
              <a href="https://docs.vmct-cn.top/vmtu/" class="vm-link-underline mb-2">
                {{ $t('footer.vmtu') }}
              </a>
            </li>
            <li>
              <a href="/tools" class="vm-link-underline mb-2">{{ $t('footer.tools') }}</a>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="text-center text-[0.85rem] text-[var(--text-medium)]">
      <p>{{ $t('footer.disclaimer') }}</p>
    </div>

    <!-- 国内版备案信息 -->
    <div class="mt-4 text-center text-[0.85rem] text-[var(--text-medium)]">
      <p class="mb-1">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[var(--text-medium)] no-underline transition-colors duration-300 hover:text-[var(--footer-link-hover)]"
        >
          {{ $t('footer.icpLicense') }}
        </a>
      </p>
      <!--
      <p>
        <a
          href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=41019702001135"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[var(--text-medium)] no-underline transition-colors duration-300 hover:text-[var(--footer-link-hover)] inline-flex items-center gap-1"
        >
          <img src="/imgs/beian.png" alt="公安备案" class="h-4 w-4" v-if="false" />
          {{ $t('footer.policeRecord') }}
        </a>
      </p>
      -->
    </div>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { getAprilFoolsLogoPath } from '@/utils/aprilFools'

const commitId = import.meta.env.VITE_GIT_COMMIT
const branchName = import.meta.env.VITE_GIT_BRANCH
const repoPath = import.meta.env.VITE_GIT_REPO
const commitDate = import.meta.env.VITE_GIT_DATE
const siteLogo = getAprilFoolsLogoPath('long')

useI18n()
</script>
