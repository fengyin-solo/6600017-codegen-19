<template>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <div class="w-72 bg-gray-900 p-4 flex flex-col gap-4 overflow-y-auto">
      <h1 class="text-xl font-bold text-blue-400">天文星图渲染器</h1>

      <!-- Search -->
      <div>
        <input v-model="store.searchQuery" placeholder="搜索天体..." class="w-full bg-gray-800 rounded px-3 py-2 text-sm" />
        <div v-if="store.filteredStars.length" class="mt-1">
          <div v-for="s in store.filteredStars" :key="s.name"
            @click="store.selectedStar = s"
            class="bg-gray-800 p-2 rounded mt-1 cursor-pointer hover:bg-gray-700 text-sm">
            {{ s.name }} <span class="text-gray-400">mag {{ s.mag }}</span>
          </div>
        </div>
      </div>

      <!-- Time Travel -->
      <div>
        <label class="text-gray-400 text-xs">时间旅行</label>
        <input type="datetime-local" v-model="dateStr" @input="updateDate"
          class="w-full bg-gray-800 rounded px-3 py-2 text-sm" />
      </div>

      <!-- Location -->
      <div>
        <label class="text-gray-400 text-xs">纬度: {{ store.latitude.toFixed(1) }}°</label>
        <input type="range" v-model.number="store.latitude" min="-90" max="90" step="0.1" class="w-full" />
      </div>

      <!-- Zoom -->
      <div>
        <label class="text-gray-400 text-xs">缩放: {{ store.zoom.toFixed(1) }}x</label>
        <input type="range" v-model.number="store.zoom" min="0.3" max="3" step="0.1" class="w-full" />
      </div>

      <!-- Toggles -->
      <div class="flex flex-col gap-2">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" v-model="store.showLabels" /> 星名标签
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" v-model="store.showConstLines" /> 星座连线
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" v-model="store.showGrid" /> 坐标网格
        </label>
      </div>

      <!-- Star Info -->
      <div v-if="store.selectedStar" class="bg-gray-800 rounded-xl p-3">
        <h3 class="text-amber-400 font-bold">{{ store.selectedStar.name }}</h3>
        <div class="text-xs text-gray-300 mt-2 space-y-1">
          <p>赤经: {{ store.selectedStar.ra.toFixed(2) }}h</p>
          <p>赤纬: {{ store.selectedStar.dec.toFixed(2) }}°</p>
          <p>视星等: {{ store.selectedStar.mag }}</p>
          <p>光谱型: {{ store.selectedStar.spectral }}</p>
        </div>

        <div class="mt-3 pt-3 border-t border-gray-700">
          <h4 class="text-green-400 text-sm font-semibold mb-2">📝 观测笔记</h4>
          <div class="space-y-2">
            <input type="date" v-model="noteDate" class="w-full bg-gray-700 rounded px-2 py-1 text-xs" />
            <textarea v-model="noteContent" placeholder="记录对这颗天体的观测..." rows="3"
              class="w-full bg-gray-700 rounded px-2 py-1 text-xs resize-none"></textarea>
            <button @click="saveNote"
              :disabled="!noteContent.trim()"
              class="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded py-1 text-xs font-semibold transition">
              保存笔记
            </button>
          </div>

          <div v-if="starNotes.length" class="mt-3 space-y-2">
            <p class="text-xs text-gray-400">历史记录 ({{ starNotes.length }})</p>
            <div v-for="n in starNotes" :key="n.id" class="bg-gray-700 rounded p-2 text-xs">
              <div class="flex justify-between items-start mb-1">
                <span class="text-blue-300">{{ n.date }}</span>
                <button @click="store.deleteNote(n.id)" class="text-red-400 hover:text-red-300 text-xs">删除</button>
              </div>
              <p class="text-gray-200 whitespace-pre-wrap">{{ n.content }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Observation History -->
      <div class="bg-gray-800 rounded-xl p-3">
        <h3 class="text-blue-400 font-bold text-sm">📅 观测历史</h3>
        <div v-if="!store.notesByDate.sortedKeys.length" class="text-xs text-gray-500 mt-2">
          暂无观测笔记
        </div>
        <div v-else class="mt-2 space-y-3 max-h-64 overflow-y-auto">
          <div v-for="d in store.notesByDate.sortedKeys" :key="d">
            <p class="text-xs text-amber-300 font-semibold sticky top-0 bg-gray-800 py-1">{{ d }}</p>
            <div v-for="n in store.notesByDate.map[d]" :key="n.id"
              class="bg-gray-700 rounded p-2 text-xs mt-1 cursor-pointer hover:bg-gray-600"
              @click="jumpToStar(n.starName)">
              <p class="text-green-300 font-semibold">{{ n.starName }}</p>
              <p class="text-gray-200 whitespace-pre-wrap mt-1">{{ n.content }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Constellation list -->
      <div class="text-xs">
        <h4 class="text-gray-400 mb-1">可见星座</h4>
        <div v-for="c in store.CONSTELLATIONS" :key="c.name" class="py-1 text-gray-300">
          {{ c.nameCn }} <span class="text-gray-500">({{ c.name }})</span>
        </div>
      </div>

      <div class="text-xs text-gray-500 mt-auto">
        LST: {{ store.localSiderealTime.toFixed(2) }}h
      </div>
    </div>

    <!-- Sky Canvas -->
    <div class="flex-1 relative">
      <StarCanvas />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSkyStore } from './store/sky'
import StarCanvas from './components/StarCanvas.vue'
import { STARS } from './data/stars'

const store = useSkyStore()
const dateStr = ref(new Date().toISOString().slice(0, 16))
function updateDate() { store.viewDate = new Date(dateStr.value) }

const noteDate = ref(new Date().toISOString().slice(0, 10))
const noteContent = ref('')

const starNotes = computed(() => {
  if (!store.selectedStar) return []
  return store.getNotesForStar(store.selectedStar.name)
})

watch(() => store.selectedStar, () => {
  noteContent.value = ''
})

function saveNote() {
  if (!store.selectedStar || !noteContent.value.trim()) return
  store.addNote(store.selectedStar.name, noteContent.value.trim(), noteDate.value)
  noteContent.value = ''
}

function jumpToStar(starName: string) {
  const star = STARS.find(s => s.name === starName)
  if (star) {
    store.selectedStar = star
    store.searchQuery = ''
  }
}
</script>
