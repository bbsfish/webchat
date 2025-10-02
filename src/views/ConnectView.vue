<template>
  <div class="connect">
    <h1>相手との接続</h1>
    <div v-if="remotePeerId && isValidId">
      <span>"{{ remotePeerId }}" に接続します. よろしいですか？</span>
      <button @click="cancel">キャンセル</button>
      <button @click="connect">接続</button>
    </div>
    <div v-else>
      ID が指定されていません. ID を指定してください.
      <button @click="$router.push({ name: 'Home' })">戻る</button>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import { Peer } from 'peerjs';
import ws from '@/lib/ws';

export default {
  name: 'ConnectView',
  computed: {
    ...mapGetters(['isReceiver', 'isAppEncryptionUsed']),
    remotePeerId: function() {
      return this.$route.query?.id;
    },
    isValidId() {
      const regex = new RegExp(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/);
      return regex.test(this.remotePeerId);
    },
  },
  methods: {
    connect() {
      if (this.isReceiver && this.isAppEncryptionUsed) this.$router.push({ name: 'ChatSecure', query: { id: this.remotePeerId } });
      else if (this.isReceiver) this.$router.push({ name: 'ChatPlain', query: { id: this.remotePeerId } });
      else {
        const connection = this.$store.getters.peer.connect(this.remotePeerId);
        connection.on('open', () => {
          console.debug('open connection');
          this.$store.commit('setConnection', connection);
          if (this.isAppEncryptionUsed) this.$router.push({ name: 'ChatSecure', query: { id: this.remotePeerId } });
          else this.$router.push({ name: 'ChatPlain', query: { id: this.remotePeerId } });
        });
      }
    },
    cancel() {
      if (this.isReceiver) this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    }
  },
  created() {
    if (this.$store.getters.isConnected) this.$store.commit('setReceiver');
    if (this.$store.getters.myPeerId) return;

    // アプリケーション開始時にPeerJSを初期化
    // PeerServerへ接続し、自身のIDを取得
    const lastPeerId = ws.ls.get('peer_id');

    const peer = (() => {
      if (!lastPeerId) return new Peer();
      return new Peer(lastPeerId.id);
    })();

    this.$store.commit('setPeer', peer);

    peer.on('open', (id) => {
      console.debug('Peer is open');
      if (!lastPeerId) ws.ls.set('peer_id', { id, created: new Date() });
      this.$store.commit('setMyPeerId', id);
    });

    peer.on('close', () => {
      this.$dialog.alert('接続が切断されました(close)');
    });

    peer.on('disconnected', () => {
      this.$dialog.alert('接続が切断されました(disconnected)');
    });

    peer.on('error', (err) => {
      console.error(err);
      throw new Error(err.message);
    });
  }
}
</script>