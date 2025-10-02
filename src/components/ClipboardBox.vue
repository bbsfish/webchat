<template>
  <div class="clipboard-box">
    <input ref="textToCopy" :value="text" readonly class="text-display" />
    <button @click="copyToClipboard" class="copy-button">
      {{ copyButtonText }}
    </button>
  </div>
</template>

<script>
export default {
  name: 'ClipboardBox',
  props: {
    // コピー対象のテキストをプロパティとして受け取る
    text: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      // ボタンのテキストを管理
      copyButtonText: 'コピー',
    };
  },
  methods: {
    /**
     * テキストをクリップボードにコピーする
     */
    async copyToClipboard() {
      // navigator.clipboardが使えないブラウザの場合は何もしない
      if (!navigator.clipboard) {
        this.$dialog.alert('お使いのブラウザはクリップボードAPIに対応していません。');
        return;
      }

      try {
        // テキストをクリップボードに書き込む
        await navigator.clipboard.writeText(this.text);
        
        // ボタンのテキストを一時的に変更してフィードバック
        this.copyButtonText = 'コピーしました！';
        
        // 1.5秒後にボタンのテキストを元に戻す
        setTimeout(() => {
          this.copyButtonText = 'コピー';
        }, 1500);

      } catch (err) {
        console.error('クリップボードへのコピーに失敗しました:', err);
        this.$dialog.alert('クリップボードへのコピーに失敗しました。');
      }
    },
  },
};
</script>

<style lang="scss" scoped>
$line-border: #e0e0e0;
$line-green: #06c755;

.clipboard-box {
  display: inline-flex; 
  align-items: center;
  border: 1px solid $line-border;
  border-radius: 8px;
  overflow: hidden;
  max-width: 600px;
  margin: 10px 0;
  
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
  }
  
  .copy-button {
    border: none;
    background-color: $line-green;
    color: white;
    font-weight: bold;
    padding: 10px 20px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    flex-shrink: 0;
    
    &:hover {
      background-color: darken($line-green, 10%);
    }
  }
}
</style>
