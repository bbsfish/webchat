<template>
  <div class="key-exchange">
    <div class="status-box">
      <h1>鍵交換</h1>
      <LoadingSpinner v-if="isLoading" :m="statusMessage" />
      <div v-if="!isLoading && !error">
        <p>鍵交換が完了しました。</p>
      </div>
      <div v-if="error">
        <p class="error-message">{{ error }}</p>
        <button @click="goHome">ホームに戻る</button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import Encryption from '@/lib/encryption';
const crypto = new Encryption();
import LoadingSpinner from '@/components/LoadingSpinner.vue';

export default {
  name: 'KeyExchangeView',
  components: {
    LoadingSpinner,
  },
  data() {
    return {
      isLoading: true,
      statusMessage: '初期化しています...',
      error: null,
      hasSentMyKey: false,
      hasReceivedRemoteKey: false,
      retryInterval: null,
    };
  },
  computed: {
    ...mapGetters(['connection', 'isReceiver', 'myPeerId', 'deckey']),
    remotePeerId() {
      return this.$route.query?.id;
    },
  },
  async created() {
    const connection = this.connection;
    if (!connection || !connection.open) {
      this.error = '接続が確立されていません。';
      this.isLoading = false;
      return;
    }

    connection.on('data', this.onDataReceived);

    try {
      this.statusMessage = '暗号鍵を生成しています...';
      const keys = await crypto.generateKeys();
      const myPublicKeyJwk = await crypto.exportKeyAsJwk(keys.publicKey);
      this.$store.commit('setKeys', { deckey: keys.privateKey });

      this.statusMessage = '公開鍵を送信しています...';
      const sendMessage = () => this.$store.dispatch('sendMessage', {
        type: 'key-exchange',
        content: myPublicKeyJwk,
      });
      
      sendMessage(); // 最初の送信
      this.hasSentMyKey = true;
      this.statusMessage = '相手の公開鍵を待っています...';
      
      // 相手から受信するまで1.5秒ごとに再送
      this.retryInterval = setInterval(() => {
        if (!this.hasReceivedRemoteKey) {
          sendMessage();
        }
      }, 1500);

      this.checkIfComplete();

    } catch (err) {
      console.error('鍵交換中にエラーが発生しました:', err);
      this.error = '鍵の生成または送信に失敗しました。';
      this.isLoading = false;
    }
  },
  methods: {
    async onDataReceived(data) {
      if (data.type === 'key-exchange') {
        if (this.hasReceivedRemoteKey) return;
        try {
          this.statusMessage = '相手の公開鍵を受信しました。';
          const enckey = await crypto.importJwkAsKey(data.content, ['encrypt']);
          this.$store.commit('setKeys', { enckey: enckey, deckey: this.deckey });
          this.hasReceivedRemoteKey = true;
          this.checkIfComplete();
        } catch (err) {
          console.error('受信した公開鍵の処理中にエラーが発生しました:', err);
          this.error = '受信した公開鍵のフォーマットが不正です。';
          this.isLoading = false;
        }
      }
    },
    checkIfComplete() {
      if (this.hasSentMyKey && this.hasReceivedRemoteKey) {
        clearInterval(this.retryInterval); // 再送を停止
        this.statusMessage = '鍵交換が完了しました。';
        this.isLoading = false;
        setTimeout(() => {
          this.$router.push({ name: 'OptionExchange', query: { id: this.remotePeerId } });
        }, 500);
      }
    },
    goHome() {
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    }
  },
  beforeUnmount() {
    clearInterval(this.retryInterval); // 画面を離れる際にタイマーをクリア
    const connection = this.connection;
    if (connection) {
      connection.off('data', this.onDataReceived);
    }
  }
};
</script>

<style scoped>
/* スタイルは変更なし */
.key-exchange {
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
button {
  padding: 12px 24px;
  border: none;
  border-radius: 5px;
  background-color: #06c755;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 20px;
  transition: background-color 0.2s;
}
button:hover {
    background-color: darken(#06c755, 10%);
}
.error-message {
    color: #f44336;
    margin-top: 20px;
}
</style>