<template>
  <main
    class="box-border min-h-screen w-full bg-[var(--bg-off-white)] text-[var(--text-1)] [color-scheme:light] dark:[color-scheme:dark]"
  >
    <div class="mx-auto max-w-[1212px] px-4 pb-20 pt-10 lt-sm:px-3 lt-sm:pt-6">
      <section
        class="mb-6 flex items-center justify-between gap-4 rounded-lg border border-[var(--switcher-border)] bg-[var(--bg-white)] p-6 lt-sm:flex-col lt-sm:items-stretch lt-sm:p-4"
      >
        <div class="min-w-0">
          <h1 class="m-0 mb-[0.45rem] text-[clamp(1.65rem,3.4vw,2.25rem)] text-[var(--text-dark)]">
            {{ $t('translationFeedback.title') }}
          </h1>
          <p class="m-0 max-w-[42rem] text-[0.94rem] leading-[1.7] text-[var(--text-2)]">
            {{ $t('translationFeedback.intro') }}
          </p>
        </div>
        <button
          class="feedback-flat-control inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border-0 bg-[var(--btn-primary-bg)] px-5 py-3 font-inherit font-700 text-white transition-colors hover:bg-[var(--btn-primary-hover)] focus-visible:outline-2 focus-visible:outline-[var(--info-1)] focus-visible:outline-offset-2 lt-sm:w-full disabled:cursor-wait disabled:opacity-60"
          type="button"
          :aria-expanded="showForm"
          aria-controls="translation-feedback-form"
          @click="showForm = !showForm"
        >
          <Icon
            class="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            :class="showForm ? 'rotate-180' : 'rotate-0'"
            icon="lucide:chevron-down"
            aria-hidden="true"
          />
          {{
            showForm ? $t('translationFeedback.closeForm') : $t('translationFeedback.submitButton')
          }}
        </button>
      </section>

      <Transition name="feedback-form">
        <section
          v-if="showForm"
          id="translation-feedback-form"
          class="feedback-form-panel mb-6 grid scroll-mt-20 rounded-lg border border-[var(--switcher-border)] bg-[var(--bg-white)] p-6 lt-sm:p-4"
          aria-labelledby="feedback-form-title"
        >
          <div class="feedback-form-content min-h-0">
            <div class="flex items-center justify-between gap-4 lt-sm:flex-col lt-sm:items-stretch">
              <div>
                <h2 id="feedback-form-title" class="m-0 text-[1.35rem] text-[var(--text-dark)]">
                  {{ $t('translationFeedback.formTitle') }}
                </h2>
              </div>
            </div>

            <form class="mt-6 grid gap-6" @submit.prevent="submitForm">
              <div
                class="grid grid-cols-[minmax(13rem,0.7fr)_minmax(0,1.3fr)] items-start gap-5 lt-sm:grid-cols-1"
              >
                <label class="grid gap-1.5 text-sm font-500 text-[var(--text-dark)]">
                  <span class="text-sm font-600 text-[var(--text-dark)]">
                    {{ $t('translationFeedback.categoryLabel') }}
                  </span>
                  <SelectMenu
                    :model-value="form.category"
                    :options="categoryOptions"
                    :ariaLabel="$t('translationFeedback.categoryLabel')"
                    variant="flat"
                    style="--select-width: 100%; --select-menu-min-width: 100%"
                    @update:model-value="selectFormCategory"
                  />
                </label>

                <label class="grid gap-1.5 text-sm font-500 text-[var(--text-dark)]">
                  <span class="text-sm font-600 text-[var(--text-dark)]">
                    {{ $t('translationFeedback.originalNameLabel') }}
                  </span>
                  <input
                    v-model.trim="form.originalName"
                    class="feedback-field"
                    maxlength="120"
                    required
                    :placeholder="$t('translationFeedback.originalNamePlaceholder')"
                    @blur="scheduleSuggestions"
                  />
                </label>

                <fieldset class="m-0 min-w-0 border-0 p-0 sm:col-span-2">
                  <legend class="m-0 mb-2 text-sm font-600 text-[var(--text-dark)]">
                    {{ $t('translationFeedback.typeLabel') }}
                  </legend>
                  <div class="flex flex-wrap gap-2 lt-sm:grid lt-sm:grid-cols-2">
                    <label
                      v-for="subtype in subtypeOptions"
                      :key="subtype"
                      class="feedback-flat-control feedback-type-option relative box-border inline-flex min-h-11 min-w-28 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-solid border-[var(--switcher-border)] bg-[var(--bg-white)] px-3.5 py-2 text-center text-sm font-600 leading-snug text-[var(--text-2)] lt-sm:min-w-0"
                      :data-selected="form.subtypes.includes(subtype)"
                    >
                      <input
                        v-model="form.subtypes"
                        class="absolute inset-0 z-1 m-0 size-full cursor-pointer opacity-0"
                        type="checkbox"
                        :value="subtype"
                      />
                      <span
                        class="feedback-type-check pointer-events-none grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-solid border-[var(--text-2)]"
                        aria-hidden="true"
                      >
                        <Icon
                          v-if="form.subtypes.includes(subtype)"
                          class="size-3.5 text-white"
                          icon="lucide:check"
                          aria-hidden="true"
                        />
                      </span>
                      <span>{{ $t(`translationFeedback.types.${form.category}.${subtype}`) }}</span>
                    </label>
                  </div>
                </fieldset>
              </div>

              <div
                v-if="suggestions.length"
                class="grid gap-2 rounded-lg bg-[var(--info-soft)] p-3"
                role="status"
              >
                <p class="m-0 mb-[0.15rem] font-700 text-[var(--info-1)]">
                  {{ $t('translationFeedback.suggestionsTitle') }}
                </p>
                <button
                  v-for="candidate in suggestions"
                  :key="candidate.id"
                  class="feedback-flat-control flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[var(--switcher-border)] bg-[var(--bg-alt)] px-3 py-3 text-left font-inherit text-[var(--text-dark)] transition-colors hover:border-[var(--info-1)]"
                  :class="{
                    'border-[var(--info-1)] bg-[var(--info-soft)]':
                      form.selectedExistingItemId === candidate.id,
                  }"
                  type="button"
                  @click="selectSuggestion(candidate.id)"
                >
                  <span class="grid gap-[0.2rem]">
                    <strong>{{ candidate.displayName }}</strong>
                    <small class="font-normal text-[var(--text-muted)]">
                      {{ suggestionReason(candidate.reason) }}
                    </small>
                  </span>
                  <Icon
                    :icon="
                      form.selectedExistingItemId === candidate.id
                        ? 'lucide:check-circle-2'
                        : 'lucide:circle'
                    "
                    aria-hidden="true"
                  />
                </button>
                <button
                  v-if="form.selectedExistingItemId"
                  class="feedback-flat-control inline-flex min-h-9 w-fit cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--switcher-border)] bg-transparent px-3 py-2 font-inherit text-sm font-600 text-[var(--info-1)] hover:border-[var(--info-1)]"
                  type="button"
                  @click="form.selectedExistingItemId = undefined"
                >
                  {{ $t('translationFeedback.createNewInstead') }}
                </button>
              </div>

              <div
                class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]"
              >
                <div class="grid gap-2 text-sm font-500 text-[var(--text-dark)]">
                  <div
                    class="flex items-center justify-between gap-4 lt-sm:flex-col lt-sm:items-start lt-sm:gap-1"
                  >
                    <span class="text-sm font-600 text-[var(--text-dark)]">
                      {{ $t('translationFeedback.sourceUrlLabel') }}
                    </span>
                  </div>
                  <div
                    class="feedback-source-note flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm leading-relaxed text-[var(--text-dark)]"
                    role="note"
                  >
                    <Icon
                      class="mt-[0.08rem] shrink-0 text-[1.05rem] text-[var(--info-1)]"
                      icon="lucide:info"
                      aria-hidden="true"
                    />
                    <div class="grid gap-1">
                      <strong>{{ $t('translationFeedback.sourceUrlHint') }}</strong>
                      <span class="text-sm leading-relaxed text-[var(--text-dark)]">
                        {{ $t('translationFeedback.sourceUrlContact') }}
                      </span>
                    </div>
                  </div>
                  <div class="grid gap-2">
                    <div v-for="(_, index) in form.urls" :key="index" class="relative min-w-0">
                      <span
                        class="pointer-events-none absolute inset-y-px left-px z-1 inline-flex w-11 items-center justify-center rounded-l-[9px] border-0 border-r border-solid border-[var(--switcher-border)] bg-[var(--info-soft)] text-sm font-700 text-[var(--info-1)]"
                        aria-hidden="true"
                      >
                        {{ index + 1 }}
                      </span>
                      <input
                        v-model.trim="form.urls[index]"
                        class="feedback-field feedback-source-input"
                        :class="{ 'pr-12': index > 0 }"
                        type="url"
                        :required="index === 0 && !form.selectedExistingItemId"
                        :placeholder="$t('translationFeedback.sourceUrlPlaceholder')"
                        @blur="scheduleSuggestions"
                      />
                      <button
                        v-if="index > 0"
                        class="feedback-flat-control absolute inset-y-px right-px inline-flex w-11 cursor-pointer items-center justify-center rounded-r-[9px] border-0 bg-transparent p-0 text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500 focus-visible:outline-offset-[-2px] dark:text-red-400 dark:hover:bg-red-950/30"
                        type="button"
                        :aria-label="$t('translationFeedback.removeUrl')"
                        @click="removeUrl(index)"
                      >
                        <Icon class="h-5 w-5" icon="lucide:trash-2" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <button
                    v-if="form.urls.length < 3"
                    class="feedback-flat-control inline-flex min-h-9 w-fit cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[var(--switcher-border)] bg-transparent px-3 py-2 font-inherit text-sm font-600 text-[var(--info-1)] hover:border-[var(--info-1)]"
                    type="button"
                    @click="form.urls.push('')"
                  >
                    <Icon icon="lucide:plus" aria-hidden="true" />
                    {{ $t('translationFeedback.addUrl') }}
                  </button>
                </div>

                <label class="grid gap-2 text-sm font-500 text-[var(--text-dark)]">
                  <span class="text-sm font-600 text-[var(--text-dark)]">
                    {{ $t('translationFeedback.noteLabel') }}
                  </span>
                  <textarea
                    v-model.trim="form.note"
                    class="feedback-field feedback-note-field"
                    maxlength="500"
                    rows="4"
                    :placeholder="$t('translationFeedback.notePlaceholder')"
                  />
                </label>
              </div>

              <p v-if="formError" class="m-0 text-red-700 dark:text-red-400" role="alert">
                {{ formError }}
              </p>
              <p v-if="formSuccess" class="m-0 text-[var(--tip-1)]" role="status">
                {{ formSuccess }}
              </p>

              <button
                class="feedback-flat-control inline-flex min-h-11 w-fit min-w-40 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-[var(--btn-primary-bg)] px-4 py-3 font-inherit font-700 text-white transition-colors hover:bg-[var(--btn-primary-hover)] focus-visible:outline-2 focus-visible:outline-[var(--info-1)] focus-visible:outline-offset-2 lt-sm:w-full disabled:cursor-wait disabled:opacity-60"
                type="submit"
                :disabled="submitting"
              >
                <Icon
                  :icon="
                    submitting
                      ? 'lucide:loader-circle'
                      : form.selectedExistingItemId
                        ? 'lucide:heart-plus'
                        : 'lucide:send'
                  "
                  :class="{ 'animate-spin motion-reduce:animate-none': submitting }"
                  aria-hidden="true"
                />
                {{
                  submitting
                    ? $t('translationFeedback.submitting')
                    : form.selectedExistingItemId
                      ? $t('translationFeedback.voteExisting')
                      : $t('translationFeedback.submitAction')
                }}
              </button>
            </form>
          </div>
        </section>
      </Transition>

      <section
        class="mb-6 rounded-lg border border-[var(--switcher-border)] bg-[var(--bg-white)] p-6 lt-sm:p-4"
        aria-labelledby="feedback-list-title"
      >
        <div class="flex items-center justify-between gap-4">
          <h2 id="feedback-list-title" class="m-0 text-[1.35rem] text-[var(--text-dark)]">
            {{ $t('translationFeedback.listTitle') }}
          </h2>
          <button
            class="feedback-flat-control inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-solid border-[var(--switcher-border)] bg-[var(--bg-white)] px-3.5 font-inherit text-sm font-600 text-[var(--text-2)] transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--info-1)] focus-visible:outline-2 focus-visible:outline-[var(--info-1)] focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
            type="button"
            :disabled="loading"
            :aria-busy="loading"
            @click="loadItems"
          >
            <Icon
              class="text-base"
              icon="lucide:refresh-cw"
              :class="{ 'animate-spin motion-reduce:animate-none': loading }"
              aria-hidden="true"
            />
            {{ $t('translationFeedback.refresh') }}
          </button>
        </div>

        <div class="feedback-filters mt-6 grid gap-4">
          <div
            class="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-3 lt-sm:grid-cols-1 lt-sm:gap-2"
          >
            <span
              id="feedback-category-label"
              class="pt-3 text-sm font-600 text-[var(--text-2)] lt-sm:pt-0"
            >
              {{ $t('translationFeedback.categoryLabel') }}
            </span>
            <div
              class="feedback-tab-group feedback-category-tabs grid w-fit max-w-full grid-cols-3 rounded-xl bg-[var(--bg-soft)] p-1 lt-sm:w-full"
              role="tablist"
              aria-labelledby="feedback-category-label"
            >
              <button
                v-for="category in categories"
                :key="category"
                class="feedback-tab min-w-24 lt-sm:min-w-0"
                type="button"
                role="tab"
                :aria-selected="selectedCategory === category"
                @click="selectCategory(category)"
              >
                {{ $t(`translationFeedback.categories.${category}`) }}
              </button>
            </div>
          </div>

          <div
            class="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-3 lt-sm:grid-cols-1 lt-sm:gap-2"
          >
            <span
              id="feedback-type-label"
              class="pt-3 text-sm font-600 text-[var(--text-2)] lt-sm:pt-0"
            >
              {{ $t('translationFeedback.filterTypeLabel') }}
            </span>
            <div
              class="feedback-tab-group feedback-subtype-tabs flex flex-wrap"
              role="tablist"
              aria-labelledby="feedback-type-label"
            >
              <button
                class="feedback-tab"
                type="button"
                role="tab"
                :aria-selected="!selectedSubtype"
                @click="selectedSubtype = ''"
              >
                {{ $t('translationFeedback.allTypes') }}
              </button>
              <button
                v-for="subtype in activeSubtypeOptions"
                :key="subtype"
                class="feedback-tab"
                type="button"
                role="tab"
                :aria-selected="selectedSubtype === subtype"
                @click="selectedSubtype = subtype"
              >
                {{ $t(`translationFeedback.types.${selectedCategory}.${subtype}`) }}
              </button>
            </div>
          </div>
        </div>

        <p
          v-if="error"
          class="mb-0 mt-5 rounded-lg border border-dashed border-[var(--switcher-border)] bg-[var(--bg-soft)] p-6 text-center text-red-700 dark:text-red-400"
          role="alert"
        >
          {{ error }}
        </p>
        <p
          v-else-if="loading && !items.length"
          class="mb-0 mt-5 rounded-lg border border-dashed border-[var(--switcher-border)] bg-[var(--bg-soft)] p-6 text-center text-[var(--text-muted)]"
        >
          {{ $t('translationFeedback.loading') }}
        </p>
        <p
          v-else-if="!items.length"
          class="mb-0 mt-5 rounded-lg border border-dashed border-[var(--switcher-border)] bg-[var(--bg-soft)] p-6 text-center text-[var(--text-muted)]"
        >
          {{ $t('translationFeedback.empty') }}
        </p>

        <div
          v-else
          class="mt-5 grid grid-cols-1 gap-4 min-[641px]:grid-cols-2 min-[901px]:grid-cols-3"
        >
          <article
            v-for="item in paginatedItems"
            :key="item.id"
            class="feedback-card flex min-w-0 flex-col overflow-hidden rounded-2xl border border-solid border-[var(--switcher-border)] bg-[var(--bg-white)]"
          >
            <div class="relative aspect-video shrink-0 bg-[var(--bg-soft)] image-loading-frame">
              <img
                :src="item.coverUrl || '/imgs/missing.png'"
                :alt="item.displayName"
                class="block h-full w-full object-cover [filter:var(--content-image-filter)]"
                loading="lazy"
                @error="onCoverError"
              />
              <span
                class="absolute left-3 top-3 z-4 rounded-lg border border-solid border-white/20 bg-[rgb(17_24_39_/_80%)] px-2.5 py-1.5 text-sm font-750 leading-none text-white backdrop-blur-sm"
              >
                #{{ item.rank }}
              </span>
            </div>
            <div class="flex flex-1 flex-col gap-3 p-4">
              <div class="flex flex-wrap gap-1.5">
                <span
                  class="rounded-md bg-[var(--info-soft)] px-2 py-1 text-xs font-600 text-[var(--info-1)]"
                >
                  {{ $t(`translationFeedback.categories.${item.category}`) }}
                </span>
                <span
                  v-for="subtype in item.subtypes"
                  :key="subtype"
                  class="rounded-md bg-[var(--bg-soft)] px-2 py-1 text-xs text-[var(--text-2)]"
                >
                  {{ $t(`translationFeedback.types.${item.category}.${subtype}`) }}
                </span>
              </div>
              <h3
                class="m-0 text-xl font-700 leading-snug text-[var(--text-dark)] [overflow-wrap:anywhere]"
              >
                {{ item.displayName }}
              </h3>
              <div class="mt-auto flex flex-wrap items-center justify-between gap-2">
                <p
                  class="feedback-card-status m-0 inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-600"
                  :data-status="item.status"
                >
                  <span class="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                  {{ $t(`translationFeedback.status.${item.status}`) }}
                </p>
                <div v-if="item.sources.length" class="flex min-w-0 flex-wrap gap-2">
                  <a
                    v-for="source in item.sources"
                    :key="source.url"
                    class="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-xs font-500 text-[var(--text-2)] no-underline transition-colors hover:bg-[var(--bg-soft)] hover:text-[var(--info-1)] focus-visible:outline-2 focus-visible:outline-[var(--info-1)] focus-visible:outline-offset-2"
                    :href="source.url"
                    target="_blank"
                    rel="noopener"
                  >
                    <img
                      v-if="feedbackSourceIcon(source)"
                      :src="feedbackSourceIcon(source)!"
                      class="size-4 shrink-0 object-contain"
                      alt=""
                      aria-hidden="true"
                    />
                    <Icon
                      v-else
                      class="size-4 shrink-0"
                      icon="lucide:external-link"
                      aria-hidden="true"
                    />
                    <span class="[overflow-wrap:anywhere]">{{ source.platform }}</span>
                    <Icon
                      v-if="feedbackSourceIcon(source)"
                      class="size-3 shrink-0 opacity-60"
                      icon="lucide:arrow-up-right"
                      aria-hidden="true"
                    />
                  </a>
                </div>
              </div>
            </div>
            <div
              class="mx-4 flex items-center justify-between gap-3 border-0 border-t border-solid border-[var(--switcher-border)] py-3"
            >
              <span
                class="inline-flex min-w-0 items-center gap-2 text-base font-700 tabular-nums text-[var(--text-medium)]"
              >
                <Icon class="size-[1.1rem] shrink-0" icon="lucide:heart" aria-hidden="true" />
                {{ item.voteCount }}
              </span>
              <button
                class="feedback-card-vote feedback-flat-control inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-solid border-transparent bg-[var(--btn-primary-bg)] px-4 py-2 font-inherit text-sm font-700 text-white transition-colors hover:bg-[var(--btn-primary-hover)] focus-visible:outline-2 focus-visible:outline-[var(--info-1)] focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
                type="button"
                :disabled="votingIds.has(item.id)"
                :aria-busy="votingIds.has(item.id)"
                :aria-pressed="item.votedByCurrentVisitor"
                @click="toggleVote(item)"
              >
                <Icon
                  :icon="item.votedByCurrentVisitor ? 'lucide:heart' : 'lucide:heart-plus'"
                  aria-hidden="true"
                />
                {{
                  item.votedByCurrentVisitor
                    ? $t('translationFeedback.unlike')
                    : $t('translationFeedback.like')
                }}
              </button>
            </div>
          </article>
        </div>
        <nav
          v-if="!error && items.length && pageCount > 1"
          class="mt-8 flex flex-wrap items-center justify-center gap-2 pt-6 lt-sm:gap-1.5"
          :aria-label="$t('translationFeedback.pagination')"
        >
          <button
            class="feedback-page-button feedback-flat-control"
            type="button"
            :disabled="currentPage === 1"
            :aria-label="$t('translationFeedback.previousPage')"
            @click="goToPage(currentPage - 1)"
          >
            <Icon class="size-5" icon="lucide:chevron-left" aria-hidden="true" />
          </button>
          <button
            v-for="page in pageCount"
            :key="page"
            class="feedback-page-button feedback-flat-control"
            type="button"
            :aria-current="currentPage === page ? 'page' : undefined"
            :aria-label="$t('translationFeedback.page', { page })"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
          <button
            class="feedback-page-button feedback-flat-control"
            type="button"
            :disabled="currentPage === pageCount"
            :aria-label="$t('translationFeedback.nextPage')"
            @click="goToPage(currentPage + 1)"
          >
            <Icon class="size-5" icon="lucide:chevron-right" aria-hidden="true" />
          </button>
        </nav>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  listFeedbackItems,
  submitFeedback,
  suggestFeedbackItems,
  toggleFeedbackVote,
} from '@/api/translationFeedback'
import SelectMenu from '@/components/SelectMenu.vue'
import type {
  FeedbackCandidate,
  FeedbackCategory,
  FeedbackItem,
  FeedbackSource,
} from '@/types/translationFeedback'

const { t } = useI18n()

const PAGE_SIZE = 18
const categories: FeedbackCategory[] = ['modpack', 'map', 'other']
const subtypeMap: Record<FeedbackCategory, string[]> = {
  modpack: ['technology', 'adventure', 'kitchen_sink', 'magic', 'other'],
  map: ['puzzle', 'minigame', 'adventure', 'horror', 'parkour', 'other'],
  other: ['other'],
}

const feedbackPlatformIcons = [
  {
    icon: '/imgs/svg/curseforge.svg',
    names: ['curseforge'],
    domains: ['curseforge.com'],
  },
  {
    icon: '/imgs/svg/modrinth.svg',
    names: ['modrinth'],
    domains: ['modrinth.com'],
  },
  {
    icon: '/imgs/svg/planetminecraft.svg',
    names: ['planetminecraft'],
    domains: ['planetminecraft.com'],
  },
  {
    icon: '/imgs/svg/minecraftmaps.ico',
    names: ['minecraftmaps'],
    domains: ['minecraftmaps.com'],
  },
  {
    icon: '/imgs/svg/mapverse.svg',
    names: ['mapverse'],
    domains: ['mapverse.net'],
  },
] as const

const selectedCategory = ref<FeedbackCategory>('modpack')
const selectedSubtype = ref('')
const items = ref<FeedbackItem[]>([])
const currentPage = ref(1)
const suggestions = ref<FeedbackCandidate[]>([])
const showForm = ref(false)
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const formError = ref('')
const formSuccess = ref('')
const votingIds = reactive(new Set<string>())
let suggestionTimer: number | undefined
let itemsRequestId = 0
let suggestionRequestId = 0
let itemsController: AbortController | undefined
let suggestionController: AbortController | undefined

const form = reactive({
  category: 'modpack' as FeedbackCategory,
  subtypes: ['technology'],
  originalName: '',
  urls: [''],
  note: '',
  selectedExistingItemId: undefined as string | undefined,
})

const activeSubtypeOptions = computed(() => subtypeMap[selectedCategory.value])
const subtypeOptions = computed(() => subtypeMap[form.category])
const categoryOptions = computed(() =>
  categories.map((category) => ({
    label: t(`translationFeedback.categories.${category}`),
    value: category,
  })),
)
const pageCount = computed(() => Math.max(1, Math.ceil(items.value.length / PAGE_SIZE)))
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return items.value.slice(start, start + PAGE_SIZE)
})

watch([selectedCategory, selectedSubtype], () => {
  currentPage.value = 1
  void loadItems()
})
watch(pageCount, (count) => {
  if (currentPage.value > count) currentPage.value = count
})
watch(
  () => [form.category, form.subtypes.join(','), form.originalName, form.urls.join('\u0000')],
  (values, previousValues) => {
    if (previousValues && values.some((value, index) => value !== previousValues[index])) {
      form.selectedExistingItemId = undefined
    }
    scheduleSuggestions()
  },
)

onMounted(() => void loadItems())
onBeforeUnmount(() => {
  window.clearTimeout(suggestionTimer)
  itemsController?.abort()
  suggestionController?.abort()
})

async function loadItems() {
  const requestId = ++itemsRequestId
  itemsController?.abort()
  const controller = new AbortController()
  itemsController = controller
  loading.value = true
  error.value = ''

  try {
    const result = await listFeedbackItems({
      category: selectedCategory.value,
      subtype: selectedSubtype.value || undefined,
      signal: controller.signal,
    })

    if (requestId !== itemsRequestId) return
    items.value = result.items
    currentPage.value = 1
  } catch {
    if (controller.signal.aborted || requestId !== itemsRequestId) return
    error.value = t('translationFeedback.loadError')
  } finally {
    if (requestId === itemsRequestId) {
      loading.value = false
      if (itemsController === controller) itemsController = undefined
    }
  }
}

function selectCategory(category: FeedbackCategory) {
  selectedCategory.value = category
  selectedSubtype.value = ''
}

function scheduleSuggestions() {
  window.clearTimeout(suggestionTimer)
  suggestionTimer = window.setTimeout(() => void loadSuggestions(), 180)
}

async function loadSuggestions() {
  const name = form.originalName.trim()
  const subtypes = [...form.subtypes]
  const urls = form.urls.map((url) => url.trim()).filter(Boolean)
  const requestId = ++suggestionRequestId

  suggestionController?.abort()
  if (name.length < 2 || !subtypes.length) {
    suggestions.value = []
    return
  }

  const controller = new AbortController()
  suggestionController = controller
  try {
    const result = await suggestFeedbackItems({
      category: form.category,
      subtypes,
      name,
      urls,
      signal: controller.signal,
    })
    if (requestId === suggestionRequestId) suggestions.value = result.candidates
  } catch {
    if (!controller.signal.aborted && requestId === suggestionRequestId) suggestions.value = []
  } finally {
    if (suggestionController === controller) suggestionController = undefined
  }
}

function selectSuggestion(id: string) {
  form.selectedExistingItemId = id
}

function resetFormSubtypes() {
  form.subtypes = [subtypeOptions.value[0] || 'other']
}

function selectFormCategory(category: FeedbackCategory) {
  form.category = category
  resetFormSubtypes()
}

function removeUrl(index: number) {
  form.urls.splice(index, 1)
}

function suggestionReason(reason: FeedbackCandidate['reason']) {
  return t(`translationFeedback.suggestionReasons.${reason}`)
}

function feedbackSourceIcon(source: FeedbackSource) {
  const normalizedPlatform = source.platform.toLowerCase().replace(/[^a-z0-9]/g, '')
  let hostname = ''

  try {
    hostname = new URL(source.url).hostname.toLowerCase()
  } catch {
    // The API normally returns validated URLs; platform matching still provides a safe fallback.
  }

  return feedbackPlatformIcons.find(
    ({ names, domains }) =>
      names.some((name) => normalizedPlatform.includes(name)) ||
      domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)),
  )?.icon
}

async function submitForm() {
  if (submitting.value) return

  formError.value = ''
  formSuccess.value = ''
  const originalName = form.originalName.trim()
  const urls = form.urls.map((url) => url.trim()).filter(Boolean)
  const selectedExistingItemId = form.selectedExistingItemId
  if (!originalName || (!selectedExistingItemId && !urls.length) || !form.subtypes.length) {
    formError.value = t('translationFeedback.formRequired')
    return
  }

  submitting.value = true
  try {
    if (selectedExistingItemId) {
      await toggleFeedbackVote(selectedExistingItemId, 'like')
      formSuccess.value = t('translationFeedback.existingVoteSuccess')
    } else {
      const result = await submitFeedback({
        category: form.category,
        subtypes: [...form.subtypes],
        originalName,
        urls,
        note: form.note.trim() || undefined,
      })
      formSuccess.value =
        result.result === 'merged'
          ? t('translationFeedback.mergedSuccess')
          : t('translationFeedback.createdSuccess')
    }
    form.originalName = ''
    form.urls = ['']
    form.note = ''
    form.selectedExistingItemId = undefined
    suggestions.value = []
    await loadItems()
  } catch (requestError) {
    if (selectedExistingItemId) {
      formError.value = t('translationFeedback.voteError')
      submitting.value = false
      return
    }
    const message = requestError instanceof Error ? requestError.message : ''
    formError.value = message.includes('only CurseForge')
      ? t('translationFeedback.sourceUrlError')
      : t('translationFeedback.submitError')
  } finally {
    submitting.value = false
  }
}

function goToPage(page: number) {
  currentPage.value = Math.min(Math.max(page, 1), pageCount.value)
}

async function toggleVote(item: FeedbackItem) {
  if (votingIds.has(item.id)) return

  const action = item.votedByCurrentVisitor ? 'unlike' : 'like'
  votingIds.add(item.id)
  try {
    const result = await toggleFeedbackVote(item.id, action)
    item.voteCount = result.item.voteCount
    item.votedByCurrentVisitor = result.item.votedByCurrentVisitor
    items.value = [...items.value]
      .sort((a, b) => b.voteCount - a.voteCount || a.rank - b.rank)
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
  } catch {
    error.value = t('translationFeedback.voteError')
  } finally {
    votingIds.delete(item.id)
  }
}

function onCoverError(event: Event) {
  const image = event.target as HTMLImageElement
  if (!image.src.endsWith('/imgs/missing.png')) image.src = '/imgs/missing.png'
}
</script>

<style scoped>
.feedback-type-option:hover:not([data-selected='true']) {
  border-color: var(--info-1);
  background: var(--bg-soft);
  color: var(--text-dark);
}

.feedback-type-option[data-selected='true'] {
  border-color: var(--info-1);
  background: var(--info-soft);
  color: var(--info-1);
}

.feedback-type-option[data-selected='true'] .feedback-type-check {
  border-color: var(--btn-primary-bg);
  background: var(--btn-primary-bg);
}

.feedback-type-option:has(input:focus-visible) {
  outline: 2px solid var(--info-1);
  outline-offset: 2px;
}

.feedback-source-input {
  padding-inline-start: 3.5rem;
}

.feedback-category-tabs .feedback-tab:hover:not([aria-selected='true']) {
  background: var(--bg-white);
  color: var(--text-dark);
}

.feedback-category-tabs .feedback-tab[aria-selected='true'] {
  background: var(--btn-primary-bg);
  color: white;
  font-weight: 700;
}

.feedback-subtype-tabs .feedback-tab {
  border-color: var(--switcher-border);
  background: var(--bg-white);
}

.feedback-subtype-tabs .feedback-tab:hover {
  border-color: var(--info-1);
  color: var(--info-1);
}

.feedback-subtype-tabs .feedback-tab[aria-selected='true'] {
  border-color: var(--info-1);
  background: var(--info-soft);
  color: var(--info-1);
  font-weight: 700;
}

.feedback-card {
  box-shadow: var(--vp-shadow-1);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.feedback-card:focus-within {
  border-color: var(--info-1);
}

.feedback-card-status {
  color: var(--text-2);
  background: var(--bg-soft);
}

.feedback-card-status[data-status='planned'] {
  color: var(--info-1);
  background: var(--info-soft);
}

.feedback-card-status[data-status='translating'] {
  color: var(--warning-1);
  background: var(--warning-soft);
}

.feedback-card-status[data-status='completed'] {
  color: var(--tip-1);
  background: var(--tip-soft);
}

.feedback-card-vote[aria-pressed='true'] {
  border-color: var(--info-1);
  background: var(--info-soft);
  color: var(--info-1);
}

.feedback-page-button {
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  border: 1px solid var(--switcher-border);
  border-radius: 10px;
  padding: 0 10px;
  background: var(--bg-white);
  color: var(--text-2);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.feedback-page-button:hover:not(:disabled):not([aria-current='page']) {
  border-color: var(--info-1);
  background: var(--info-soft);
  color: var(--info-1);
}

.feedback-page-button[aria-current='page'] {
  border-color: var(--btn-primary-bg);
  background: var(--btn-primary-bg);
  color: white;
}

.feedback-page-button:focus-visible {
  outline: 2px solid var(--info-1);
  outline-offset: 3px;
}

.feedback-page-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

@media (hover: hover) and (pointer: fine) {
  .feedback-card:hover {
    border-color: color-mix(in srgb, var(--info-1) 45%, var(--switcher-border));
    box-shadow: var(--card-shadow);
    transform: translateY(-3px);
  }
}

.feedback-form-enter-active,
.feedback-form-leave-active {
  grid-template-rows: 1fr;
  overflow: hidden;
  opacity: 1;
  transition:
    grid-template-rows 280ms ease,
    opacity 220ms ease,
    margin-bottom 280ms ease,
    padding 280ms ease,
    border-width 280ms ease;
}

.feedback-form-enter-from,
.feedback-form-leave-to {
  grid-template-rows: 0fr;
  margin-bottom: 0;
  border-width: 0;
  padding-block: 0;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .feedback-card,
  .feedback-page-button,
  .feedback-form-enter-active,
  .feedback-form-leave-active {
    transition: none;
  }

  .feedback-card:hover {
    transform: none;
  }
}
</style>
