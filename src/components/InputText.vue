<template>
  <input class="input-text" type="text" :placeholder="placeholder" @input="onInput" :value="value" />
</template>

<script>
export default {
  name: 'InputText',
  emits: ['change'],
  props: {
    default: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      value: '',
    };
  },
  methods: {
    onInput(e) {
      const value = e.target.value;
      this.$emit('change', value);
    },
    // 親コンポーネントからの呼び出し用
    set(value) {
      this.value = value;
    },
  },
  created() {
    if (this.default !== '') this.vmInputText = this.default;
  },
};
</script>

<style lang="scss" scoped>
input {
  display: block;
  padding: 10px 12px;
  width: calc(100% - 24px - 2px);
}
</style>