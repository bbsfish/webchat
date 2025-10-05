<template>
  <div class="clipboard-box">
    <input ref="textToCopy" :value="text" readonly class="text-display" />
    <button @click="copyToClipboard" class="copy-button">
      <IconClipboard />
    </button>
  </div>
</template>

<script>
import IconClipboard from '@/components/icons/IconClipboard.vue';

export default {
  name: 'ClipboardBox',
  components: {
    IconClipboard,
  },
  props: {
    // コピー対象のテキスト
    text: {
      type: String,
      required: true,
    },
  },
  methods: {
    async copyToClipboard() {
      // navigator.clipboardが使えないブラウザの場合は何もしない
      if (!navigator.clipboard) {
        this.$dialog.alert('お使いのブラウザではクリップボードにコピーできませんでした');
        return;
      }

      try {
        // テキストをクリップボードに書き込む
        await navigator.clipboard.writeText(this.text);
      } catch (err) {
        console.error('クリップボードへのコピーに失敗しました:', err);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as var;

.clipboard-box {
  display: flex; 
  align-items: center;
  border: 1px solid var.$border-color;
  border-radius: 8px;
  overflow: hidden;
  
  .text-display {
    flex-grow: 1;
    border: none;
    outline: none;
    background-color: #f9f9f9;
    padding: 10px 12px;
    font-size: 0.9rem;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
  }
  
  .copy-button {
    border: none;
    background-color: var.$green;
    color: white;
    font-weight: bold;
    padding: 10px 20px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    flex-shrink: 0;
    
    &:hover {
      background-color: darken(var.$green, 10%);
    }
  }
}
</style>
