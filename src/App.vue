<template>
  <router-view />
</template>

<script>
export default {
  name: 'App',
  methods: {
    async onPeerClose() {
      await this.$dialog.alert('接続が切断されました(peer-close)');
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    },
    async onPeerDisconnected() {
      await this.$dialog.alert('接続が切断されました(peer-disconnected)');
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    },
    async onPeerError(err) {
      await this.$dialog.alert(`接続エラーが発生しました: ${err.type}`);
      console.error(err);
      this.$router.push({ name: 'Home' });
    },
  },
  created() {
    this.$store.watch(
      (state, getters) => getters.peer,
      (to) => {
        if (to === null) return;
        to.on('close', this.onPeerClose);
        to.on('disconnected', this.onPeerDisconnected);
        to.on('error', this.onPeerError);
      },
    )
  },
};
</script>

<style>
html, body, #app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
