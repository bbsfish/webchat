<template>
  <div class="option-exchange">
    <div class="status-box">
      <h1>設定の同期</h1>
      <LoadingSpinner v-if="isLoading" :m="statusMessage" />
      <div v-if="error">
        <p class="error-message">{{ error }}</p>
        <button @click="goHome">ホームに戻る</button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import LoadingSpinner from '@/components/LoadingSpinner.vue';

export default {
  name: 'OptionExchangeView',
  components: {
    LoadingSpinner,
  },
  data() {
    return {
      isLoading: true,
      statusMessage: '初期化しています...',
      error: null,
      hasSentMyOptions: false,
      hasReceivedRemoteOptions: false,
      retryInterval: null,
    };
  },
  computed: {
    ...mapGetters(['connection', 'isAppEncryptionDisabled', 'isReceiver']),
    remotePeerId() {
      return this.$route.query?.id;
    },
  },
  created() {
    const connection = this.connection;
    if (!connection || !connection.open) {
      this.error = '接続が確立されていません。';
      this.isLoading = false;
      return;
    }

    connection.on('data', this.onDataReceived);

    this.statusMessage = '自分の設定を送信しています...';
    const sendMessage = () => this.$store.dispatch('sendMessage', {
      type: 'option-exchange',
      content: { isAppEncryptionDisabled: this.isAppEncryptionDisabled },
    });

    sendMessage(); // 最初の送信
    this.hasSentMyOptions = true;
    this.statusMessage = '相手の設定を待っています...';

    // 相手から受信するまで1.5秒ごとに再送
    this.retryInterval = setInterval(() => {
        if (!this.hasReceivedRemoteOptions) {
            sendMessage();
        }
    }, 1500);

    this.checkIfComplete();
  },
  methods: {
    async onDataReceived(data) {
      if (data.type === 'option-exchange') {
        if (this.hasReceivedRemoteOptions) return;

        this.statusMessage = '相手の設定を受信しました。';
        const remoteIsAppEncryptionDisabled = data.content.isAppEncryptionDisabled;

        if (!this.isAppEncryptionDisabled && remoteIsAppEncryptionDisabled) {
          const res = await this.$dialog.confirm('相手がアプリケーション暗号化を無効化するように求めています。無効化しますか？');
          if (res) {
            this.$store.commit('setOption', { k: 'isAppEncryptionDisabled', v: true });
          } else {
            this.goHome();
            return;
          }
        }
        
        this.hasReceivedRemoteOptions = true;
        this.checkIfComplete();
      }
    },
    checkIfComplete() {
      if (this.hasSentMyOptions && this.hasReceivedRemoteOptions) {
        clearInterval(this.retryInterval); // 再送を停止
        this.isLoading = false;
        setTimeout(() => {
          this.$router.push({ name: 'Chat', query: { id: this.remotePeerId } });
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
.option-exchange {
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