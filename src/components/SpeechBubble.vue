<template>
  <div
    class="speech-bubble-wrapper"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <slot></slot>

    <div v-if="isHovered" class="speech-bubble">
      <slot name="bubble"></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SpeechBubble',
  data() {
    return {
      // ホバー状態を管理するフラグ
      isHovered: false,
    };
  },
};
</script>

<style lang="scss" scoped>
// ラッパー：バブルの位置を決める基準(position: relative)
.speech-bubble-wrapper {
  display: inline-block;
  position: relative;
}

// スピーチバブル本体
.speech-bubble {
  // 親要素(.speech-bubble-wrapper)を基準に位置を決める
  position: absolute;
  z-index: 9999;
  
  // 位置調整：親要素の上部中央に配置
  bottom: 100%; // 親要素の真上に配置
  left: 50%;     // 親要素の水平中央に配置
  transform: translateX(-50%); // バブル自身の幅の半分だけ左にずらし、完全に中央揃え
  margin-bottom: 10px; // トリガー要素とバブルの間の余白

  // 見た目のスタイル
  background-color: #333;
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 14px;
  white-space: nowrap;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);

  // バブルの「しっぽ」（三角形）
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 8px solid transparent;
    border-top-color: #333;
  }
}
</style>