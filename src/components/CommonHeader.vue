<template>
  <div class="common-header">
    <h1>{{ text }}</h1>
  </div>
</template>

<script>
export default {
  name: 'CommonHeader',
  props: {
    text: {
      type: String,
      default: 'P2P Online Web Chat',
    },
  },
}
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as var;

.common-header {
  color: white;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background-color: var.$green;

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
}
</style>