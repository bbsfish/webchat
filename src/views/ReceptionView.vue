<template>
  <div class="reception-view">
    <div class="status-box">
      <div v-if="isDisconnected">
        <h1>接続が切断されました</h1>
        <p class="info-text">相手が再接続するのを待っています。</p>
        <button @click="goToHome" class="cancel-btn">再接続の待機を終了する</button>
      </div>
      <div v-else>
        <h1>接続待機中</h1>
        <LoadingSpinner m="相手からの応答を待っています..." />
        <p class="info-text">
          相手が接続を承認するまで、この画面のままお待ちください。
        </p>
        <button @click="cancel" class="cancel-btn">キャンセル</button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import LoadingSpinner from '@/components/LoadingSpinner.vue';

export default {
  name: 'ReceptionView',
  components: {
    LoadingSpinner,
  },
  data() {
    return {
      isDisconnected: false,
    };
  },
  computed: {
    ...mapGetters(['connection']),
    remotePeerId() {
      return this.$route.query?.id;
    },
  },
  created() {
    // クエリパラメータにdisconnectedがあれば、切断モードで表示
    if (this.$route.query.disconnected) {
      this.isDisconnected = true;
      // 再接続を待機するため、相手からのconnectionを待つ
      this.$store.getters.peer.on('connection', (newConnection) => {
        this.$store.commit('setConnection', newConnection);
        // 相手のIDを更新してKeyExchangeへ
        this.$router.push({ name: 'KeyExchange', query: { id: newConnection.peer } });
      });
      return;
    }

    const connection = this.connection;
    if (!connection || !connection.open) {
      this.$dialog.alert('接続が確立されていません。ホームに戻ります。');
      this.$router.push({ name: 'Home' });
      return;
    }

    // データ受信時のイベントリスナーを設定
    connection.on('data', this.onDataReceived);
  },
  methods: {
    onDataReceived(data) {
      // helloメッセージを受信したらKeyExchangeViewへ遷移
      if (data.type === 'hello') {
        this.$router.push({ name: 'KeyExchange', query: { id: this.remotePeerId } });
      }
    },
    cancel() {
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    },
    goToHome() {
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    }
  },
  beforeUnmount() {
    // コンポーネントが破棄される際にイベントリスナーを解除
    const peer = this.$store.getters.peer;
    if(peer) {
        peer.off('connection');
    }
    const connection = this.connection;
    if (connection) {
      connection.off('data', this.onDataReceived);
    }
  },
};
</script>

<style scoped>
.reception-view {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
}
.status-box {
  padding: 40px;
  text-align: center;
  max-width: 500px;
  margin: auto;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
h1 {
  margin-bottom: 24px;
}
.info-text {
    margin-top: 20px;
    color: #666;
}
.cancel-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 5px;
  background-color: #f44336;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 20px;
  transition: background-color 0.2s;
}
.cancel-btn:hover {
    background-color: darken(#f44336, 10%);
}
</style>