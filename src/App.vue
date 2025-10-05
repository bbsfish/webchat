<template>
  <router-view />
</template>

<script>
import { Peer } from 'peerjs';
import Database from '@/lib/database';
const db = new Database();
import Crypto from './lib/crypto';
const crypto = new Crypto();

export default {
  name: 'App',
  data() {
    return {
      lastPeerInfo: null,
    };
  },
  async created() {
    // 前回の接続情報を取得
    this.lastPeerInfo = await db.getState('last_peer_info');

    // 鍵を生成
    const keys = await crypto.generateKeys();
    this.$store.commit('setKeys', { publicKey: keys.publicKey, decoder: keys.privateKey });

    // Peer接続を確立
    const peer = this.lastPeerInfo ? new Peer(this.lastPeerInfo.id) : new Peer();
    this.$store.commit('setPeer', peer);
    peer.on('open', this.onPeerOpen);
    peer.on('close', this.onPeerClosed);
    peer.on('disconnected', this.onPeerDisconnected);
    peer.on('error', this.onPeerError);
  },
  methods: {
    async onPeerOpen(id) {
      console.debug('Peer is open');
      const now = new Date().getTime();
      const peerInfoToSave = {
        id,
        created: this.lastPeerInfo ? this.lastPeerInfo.created : now,
        used: now,
      };
      await db.setState('last_peer_info', peerInfoToSave);
      this.lastPeerInfo = peerInfoToSave; // dataプロパティも更新
      this.$store.commit('setMyPeerId', id);
    },
    async onPeerClosed() {
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
};
</script>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 16px;
}
</style>