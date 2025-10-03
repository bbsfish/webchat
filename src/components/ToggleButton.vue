<template>
  <div class="toggle-button">
    <input type="checkbox" :id="inputBoxId" v-model="vmCheckBox" />
    <label :for="inputBoxId"></label>
  </div>
</template>

<script>
import { useId } from 'vue';

export default {
  name: 'ToggleButton',
  emits: ['on', 'off', 'toggle'],
  props: {
    init: {
      type: Boolean,
      default: false,
    },
    lock: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      vmCheckBox: false,
    };
  },
  computed: {
    inputBoxId: function () {
      return useId();
    },
  },
  watch: {
    async vmCheckBox(to, from) {
      if (this.lock) return this.$nextTick(() => this.vmCheckBox = from);
      if (to) this.$emit('on');
      else this.$emit('off');
      this.$emit('toggle', to);
    },
  },
  /** 親コンポーネントからの呼び出し用 */
  methods: {
    setOn() {
      this.vmCheckBox = true;
    },
    setOff() {
      this.vmCheckBox = false;
    },
  },
  mounted() {
    this.vmCheckBox = this.init;
  },
};
</script>

<style lang="scss" scoped>
$off-color: #ccc; // OFFの時の背景色
$on-color: #4caf50; // ONの時の背景色 (緑)
$thumb-color: white; // 丸（つまみ）の色
$thumb-size: 26px; // つまみの直径
$track-height: 34px; // トラック（背景）の高さ
$track-width: 60px; // トラックの幅

.toggle-button {
  display: inline-block;
  /* トラック（背景）部分のスタイル */
  label {
    display: inline-block;
    cursor: pointer;
    position: relative; /* 丸の位置の基準にする */

    width: $track-width;
    height: $track-height;
    background-color: $off-color;
    border-radius: $track-height; /* 高さと同値で角を完全に丸くする */
    transition: background-color 0.3s ease; /* 背景色の変化を滑らかに */
  }

  /* HTMLのチェックボックス自体は非表示にする */
  input[type="checkbox"] {
    opacity: 0;
    width: 0;
    height: 0;
  }

  /* 丸（つまみ）部分のスタイル */
  label::before {
    content: "";
    position: absolute;
    top: 4px;
    left: 4px;

    width: $thumb-size;
    height: $thumb-size;
    background-color: $thumb-color;
    border-radius: 50%; /* 正円にする */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* 立体感を出すための影 */
    transition: transform 0.3s ease; /* 位置移動のアニメーションを滑らかに */
  }

  /* --- ★ここからがONの時のスタイル --- */

  /* inputが:checked状態になったら、隣接する(+)labelのスタイルを変更 */
  input:checked + label {
    background-color: $on-color; /* 背景色を緑に変更 */
  }

  /* inputが:checked状態になったら、隣接する(+)labelの::before疑似要素のスタイルを変更 */
  input:checked + label::before {
    /* translateXを使って丸を水平方向に移動させる */
    transform: translateX(
      $track-width - $thumb-size - 8px
    ); /* (トラック幅 - つまみ幅 - 양쪽 여백) */
  }
}
</style>