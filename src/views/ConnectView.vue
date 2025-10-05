<template>
  <div class="connect-container">
    <div class="connect-header">
      <h1>相手との接続</h1>
    </div>

    <div class="connect-content">
      <div class="card">
        <div class="error-state" v-if="isError">
          <h2>接続エラー</h2>
          <p>{{ errorMessage }}</p>
          <button @click="$router.push({ name: 'Home' })" class="home-btn">ホームへ戻る</button>
        </div>

        <div class="loading-state" v-if="!isError && isLoading">
          <LoadingSpinner />
          <p>{{ loadingMessage }}</p>
        </div>

        <div class="connection-confirm" v-if="!isError && !isLoading && !isConnectionConfirmed">
          <h2>接続の確認</h2>
          <p class="confirm-message">
            ID: <span class="remote-peer-id">"{{ remotePeerId }}"</span> に接続します。<br>よろしいですか？
          </p>
          
          <div class="confirm-options">
            <div class="setting-item">
              <div class="setting-label">
                <span>この接続を保存する</span>
                <SpeechBubble>
                  <IconCircleQuestion />
                  <template #bubble>
                    お使いのPCにこの接続先を保存します.
                  </template>
                </SpeechBubble>
              </div>
              <ToggleButton @on="isConnectionNamed = true" @off="isConnectionNamed = false" />
            </div>
            
            <div v-if="isConnectionNamed" class="connection-name-wrapper">
              <InputText placeholder="接続に名前を付けてください" @change="(v) => connectionName = v" />
            </div>
          </div>

          <div class="action-buttons">
            <button @click="cancel" class="cancel-btn">キャンセル</button>
            <button @click="connect" class="connect-btn">接続する</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import Database from '@/lib/database';
const db = new Database();
import Crypto from '@/lib/crypto';
const crypto = new Crypto();
import IconCircleQuestion from '@/components/icons/IconCircleQuestion.vue';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import ToggleButton from '@/components/ToggleButton.vue';
import SpeechBubble from '@/components/SpeechBubble.vue';
import InputText from '@/components/InputText.vue';

export default {
  name: 'ConnectView',
  components: {
    IconCircleQuestion,
    LoadingSpinner,
    ToggleButton,
    SpeechBubble,
    InputText,
  },
  data() {
    return {
      isError: false,
      errorMessage: '',
      isLoading: false,
      loadingMessage: '',
      isConnectionConfirmed: false,
      status: '',
      isConnectionNamed: false,
      connectionName: '',
    };
  },
  computed: {
    ...mapGetters(['peer', 'isServer', 'isReceiver', 'isAppEncryptionEnabled']),
    remotePeerId: function() {
      return this.$route.query?.id;
    },
    isValidId: function() {
      const regex = new RegExp(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/);
      return regex.test(this.remotePeerId);
    },
  },
  created() {
    // RemotePeerIDのバリデーションチェック
    if (!this.isValidId) {
      this.errorMessage = '相手のIDが不正です. 正しいIDを入力してください.';
      this.isError = true;
      return;
    }

    if (this.isReceiver) {
      const connection = this.$store.getters.connection;
      connection.on('data', this.onDataReceived);
      connection.on('error', this.onConnectionError);
    }
  },
  methods: {
    async connect() {
      // 接続に名前を付ける場合、DBに保存する
      if (this.isConnectionNamed) {
        if (this.connectionName === '') return this.$dialog.alert('この接続に付ける名前を入力してください');
        db.addClient({ id: this.remotePeerId, alias: '', nickname: this.connectionName });
      }

      this.isConnectionConfirmed = true;

      // 前回の接続として保存
      const now = new Date().getTime();
      await db.setState('last_remote_peer_info', { id: this.remotePeerId, created: now, used: now });

      // 1-1. 送信者は、受信者とのコネクションを確立する
      if (this.isServer) {
        this.loadingMessage = '相手との接続を確立しています';
        this.isLoading = true;
        await (() => new Promise((resolve, reject) => {
          const connection = this.peer.connect(this.remotePeerId);
          this.$store.commit('setConnection', connection);
          connection.on('open', () => {
            this.$store.commit('setConnection', connection);
            this.loadingMessage = '相手の応答を待っています';
            resolve();
          });
          connection.on('data', this.onDataReceived);
          connection.on('error', (err) => {
            this.onConnectionError(err);
            reject(err);
          });
        }))();
      }
      // 1-2. 受信者は、送信者にハローを送る
      else if (this.isReceiver) {
        this.loadingMessage = '相手との接続を確立しています';
        this.isLoading = true;
        this.$store.dispatch('sendMessage', { type: 'hello', content: null });
      }
    },
    cancel() {
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    },
    onConnectionError(err) {
      console.error(err);
      this.errorMessage = `コネクションを確立できませんでした: ${err.type}`;
      this.isError = true;
      this.isLoading = false;
    },
    async onDataReceived(data) {
      console.debug('Data is received:', data);
      // 2. 送信者は、ハローを受け取ったら、鍵を渡す
      if (this.isServer && data.type === 'hello') {
        this.loadingMessage = '暗号化鍵を交換しています';
        const pubAsJwk = await crypto.exportKeyAsJwk(this.$store.getters.keys.publicKey);
        this.$store.dispatch('sendMessage', { type: 'key-exchange', content: pubAsJwk });
      }
      // 3. 受信者は、鍵を受け取ったら、それを保存して、鍵を渡す
      else if (this.isReceiver && data.type === 'key-exchange') {
        this.loadingMessage = '暗号化鍵を交換しています';
        const encoder = await crypto.importJwkAsKey(data.content, ['encrypt']);
        this.$store.commit('setKeys', { encoder });
        const pubAsJwk = await crypto.exportKeyAsJwk(this.$store.getters.keys.publicKey);
        this.$store.dispatch('sendMessage', { type: 'key-exchange', content: pubAsJwk });
      }
      // 4. 送信者は、鍵を受け取ったら、それを保存して、設定を渡す
      else if (this.isServer && data.type === 'key-exchange') {
        this.loadingMessage = '設定を交換しています';
        const encoder = await crypto.importJwkAsKey(data.content, ['encrypt']);
        this.$store.commit('setKeys', { encoder });
        const myOptions = { isAppEncryptionEnabled: this.isAppEncryptionEnabled };
        this.$store.dispatch('sendMessage', { type: 'options-exchange', content: myOptions });
      }
      // 5. 受信者は、設定を受け取ったら、設定内容を確認して、コンプリートを渡し、チャットへ遷移する
      else if (this.isReceiver && data.type === 'options-exchange') {
        this.loadingMessage = '設定を交換しています';
        const options = data.content;
        // アプリケーション暗号化の設定が違っていたら有効化させる
        let isCanceled = false;
        if (options.isAppEncryptionEnabled && !this.isAppEncryptionEnabled) {
          isCanceled = await this.$dialog.confirm('相手がアプリケーション暗号化を有効化するように求めています. 有効化しますか?');
        }
        else if (!options.isAppEncryptionEnabled && this.isAppEncryptionEnabled) {
          isCanceled = await this.$dialog.confirm('相手がアプリケーション暗号化を無効化するように求めています. 無効化しますか?');
        }
        if (isCanceled) return this.cancel();

        this.$store.dispatch('sendMessage', { type: 'complete', content: null });
        this.$router.push({ name: 'Chat', query: { id: this.remotePeerId } });
      }
      // 6. 送信者は、コンプリートを受け取ったら、チャットへ遷移する
      else if (this.isServer && data.type === 'complete') {
        this.$router.push({ name: 'Chat', query: { id: this.remotePeerId } });
      }
    },
  },
  beforeUnmount() {
    const connection = this.$store.getters.connection;
    if (connection) {
      connection.off('data', this.onDataReceived);
      connection.off('error', this.onConnectionError);
    }
  },
}
</script>

<style lang="scss" scoped>
$line-green: #06c755;
$line-bg: #f0f2f5;
$line-header-bg: #ffffff;
$line-border: #e0e0e0;
$text-color: #333;
$text-muted-color: #888;
$danger-color: #d9534f;

.connect-container {
  background-color: $line-bg;
  min-height: 100%;
  color: $text-color;
}

.connect-header {
  background-color: $line-green;
  color: white;
  padding: 16px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
}

.connect-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.card {
  background-color: $line-header-bg;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  width: 100%;
  max-width: 500px;
  text-align: center;

  h2 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 1.2rem;
  }
}

.error-state, .loading-state {
  padding: 20px;
  p {
    color: $text-muted-color;
    font-size: 1rem;
    margin-top: 16px;
  }
}

.error-state {
  p {
    color: $danger-color;
    font-weight: bold;
  }
  .home-btn {
    margin-top: 20px;
    background-color: $line-green;
    color: white;
  }
}

.connection-confirm {
  .confirm-message {
    margin-bottom: 24px;
    line-height: 1.6;
    color: $text-color;
  }
  
  .remote-peer-id {
    font-weight: bold;
    word-break: break-all;
  }

  .confirm-options {
    background-color: #f9f9f9;
    border: 1px solid $line-border;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 24px;
    text-align: left;
  }
  
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .setting-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .connection-name-wrapper {
    margin-top: 16px;
    
    ::v-deep(input) { // Deep selector to style child component
      width: 100%;
      box-sizing: border-box;
    }
  }

  .action-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
  }
}

button {
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: opacity 0.2s ease;
  flex-grow: 1;

  &:hover {
    opacity: 0.85;
  }
}

.connect-btn {
  background-color: $line-green;
  color: white;
}

.cancel-btn {
  background-color: #e0e0e0;
  color: #333;
}
</style>