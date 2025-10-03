<template>
  <div class="chat-layout">
    <div v-if="!isValidId">IDが不正です</div>
    <div class="chat-container" v-else>
      <div class="chat-header">
        <span class="header-title">トーク</span>
        <div class="header-options">
          <span>アプリ暗号化</span>
          <SpeechBubble>
            <IconCircleQuestion />
            <template #bubble>
              現在のセッションのアプリケーション暗号化を有効化/無効化します。
            </template>
          </SpeechBubble>
          <div :class="{ 'toggle-disabled': isAwaitingAck }">
            <ToggleButton
              ref="encryptionToggle"
              :init="isEncryptionActive"
              @on="requestEnableEncryption"
              @off="requestDisableEncryption"
            />
          </div>
        </div>
        <button @click="disconnect" class="disconnect-btn">切断</button>
      </div>

      <div class="loading-spinner-wrap" v-if="isLoading || isAwaitingAck">
        <LoadingSpinner :m="loadingMessage" />
      </div>

      <div class="message-list">
        <div v-for="(m, i) in $store.getters.messages" :key="i" class="message-row" :class="{ 'my-message-row': m.from === myPeerId }">
          <div class="message">
            <p class="message-content">{{ m.content }}</p>
            <span class="message-time">{{ new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>
        </div>
      </div>

      <div class="message-form">
        <input v-model="vmNewMessage" @keyup.enter="send" placeholder="メッセージを入力..." />
        <button @click="send">送信</button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import WebChatDB from '@/lib/webchatdb';
const db = new WebChatDB();
import Encryption from '@/lib/encryption';
const crypto = new Encryption();
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import ToggleButton from '@/components/ToggleButton.vue';
import SpeechBubble from '@/components/SpeechBubble.vue';
import IconCircleQuestion from '@/components/icons/IconCircleQuestion.vue';

export default {
  name: 'ChatView',
  components: {
    LoadingSpinner,
    ToggleButton,
    SpeechBubble,
    IconCircleQuestion,
  },
  data() {
    return {
      isLoading: false,
      loadingMessage: '',
      vmNewMessage: '',
      isEncryptionActive: true, // createdフックで正しい値に上書き
      isAwaitingAck: false,
    };
  },
  computed: {
    ...mapGetters(['myPeerId', 'isMessageSaved', 'isAppEncryptionDisabled', 'enckey', 'deckey', 'isReceiver']),
    remotePeerId: function() {
      return this.$route.query?.id;
    },
    isValidId() {
      const regex = new RegExp(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/);
      return regex.test(this.remotePeerId)
    },
  },
  async created() {
    // ★修正点1: createdフックで初期値を設定
    this.isEncryptionActive = !this.$store.getters.isAppEncryptionDisabled;
    
    this.isLoading = true;
    this.loadingMessage = '初期化しています...';

    const messages = await db.getAllMessages();
    this.$store.commit('setMessages', messages);

    if (!this.isAppEncryptionDisabled && (!this.enckey || !this.deckey)) {
      this.$dialog.alert('暗号化キーが設定されていません。鍵交換からやり直してください。');
      this.$router.push({ name: 'Home' });
      return;
    }

    const connection = this.$store.getters.connection;
    if (connection) {
      connection.on('data', this.onDataReceived);
      connection.on('close', this.onConnectionClosed);
      connection.on('error', this.onConnectionError);
    } else {
      this.$dialog.alert('接続が確立されていません。');
      this.$router.push({ name: 'Home' });
      return;
    }

    this.isLoading = false;
    this.loadingMessage = '';
  },
  methods: {
    disconnect() {
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    },
    async onDataReceived(data) {
      console.log('Received:', data);

      if (data.type === 'request-disable-encryption') {
        const res = await this.$dialog.confirm('相手がアプリケーション暗号化を使用しないように要請しています。変更しますか？');
        if (res) {
          this.isEncryptionActive = false;
          this.$refs.encryptionToggle.setOff();
          this.$store.dispatch('sendMessage', { type: 'ack-disable-encryption', content: null });
        } else {
          this.disconnect();
        }
        return;
      }

      if (data.type === 'ack-disable-encryption') {
        this.isEncryptionActive = false;
        this.isAwaitingAck = false;
        this.loadingMessage = '';
        return;
      }

      if (data.type === 'request-enable-encryption') {
        const res = await this.$dialog.confirm('相手がアプリケーション暗号化を有効化するように要請しています。変更しますか？');
        if (res) {
          this.isEncryptionActive = true;
          this.$refs.encryptionToggle.setOn();
          this.$store.dispatch('sendMessage', { type: 'ack-enable-encryption', content: null });
        } else {
          this.$store.dispatch('sendMessage', { type: 'nack-enable-encryption', content: null });
          this.disconnect();
        }
        return;
      }

      if (data.type === 'ack-enable-encryption') {
        this.isEncryptionActive = true;
        this.isAwaitingAck = false;
        this.loadingMessage = '';
        return;
      }

      if (data.type === 'nack-enable-encryption') {
        this.isAwaitingAck = false;
        this.loadingMessage = '';
        this.$refs.encryptionToggle.setOff();
        await this.$dialog.alert('相手が要請を拒否したため、接続が切断されます。');
        this.disconnect();
        return;
      }

      if (data.type === 'text') {
        let content = data.content;
        if (this.isEncryptionActive) {
            try {
                content = await crypto.decrypt(data.content, this.deckey);
            } catch (e) {
                console.error('Decryption failed:', e);
                this.$dialog.alert('メッセージの復号に失敗しました。暗号化設定が一致しない可能性があります。');
                return;
            }
        }
        
        const message = { ...data, content, me: 0 };
        this.$store.commit('addMessage', message);

        if (this.isMessageSaved) {
            db.addMessage(message);
        }
      }
    },
    onConnectionClosed() {
      if (this.isAwaitingAck) {
        this.isAwaitingAck = false;
        this.loadingMessage = '';
        this.$dialog.alert('相手が応答せずに接続を切断しました。');
      } else {
        this.$dialog.alert('接続が切断されました');
      }
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Reception', query: { id: this.remotePeerId, disconnected: true } });
    },
    onConnectionError(err) {
      console.error(err);
      this.$dialog.alert(`通信エラーが発生しました: ${err.type}`);
    },
    async send() {
      const msg = this.vmNewMessage.trim();
      if (msg === '') return;

      const plainMessage = msg;
      let messageContent = plainMessage;

      if (this.isEncryptionActive) {
        messageContent = await crypto.encrypt(plainMessage, this.enckey);
      }

      const message = await this.$store.dispatch('sendMessage', { type: 'text', content: messageContent });
      if (!message) {
        this.$dialog.alert('メッセージを送信できませんでした. 接続を確認してください.');
        return;
      }
      
      const displayMessage = { ...message, content: plainMessage, me: 1 };
      this.$store.commit('addMessage', displayMessage);

      if (this.isMessageSaved) {
        db.addMessage(displayMessage);
      }
      
      this.vmNewMessage = '';
    },
    // ★修正点2: 不要なUI復元ロジックを削除
    requestDisableEncryption() {
      if (!this.isEncryptionActive || this.isAwaitingAck) {
        return;
      };
      this.isAwaitingAck = true;
      this.loadingMessage = '相手の応答を待っています...';
      this.$store.dispatch('sendMessage', { type: 'request-disable-encryption', content: null });
    },
    requestEnableEncryption() {
      if (this.isEncryptionActive || this.isAwaitingAck) {
        return;
      }
      
      if (!this.enckey || !this.deckey) {
        this.$dialog.alert('暗号化キーが存在しないため、暗号化を有効にできません。');
        this.$refs.encryptionToggle.setOff();
        return;
      }

      this.isAwaitingAck = true;
      this.loadingMessage = '相手の応答を待っています...';
      this.$store.dispatch('sendMessage', { type: 'request-enable-encryption', content: null });
    },
  },
  beforeUnmount() {
    const connection = this.$store.getters.connection;
    if (connection) {
      connection.off('data', this.onDataReceived);
      connection.off('close', this.onConnectionClosed);
      connection.off('error', this.onConnectionError);
    }
  },
};
</script>

<style lang="scss" scoped>
/* スタイルは変更なし */
$line-bg: #eef1f4;
$line-green: #06c755;
$line-header: #ffffff;
$line-text: #333333;
$line-text-light: #050505;
$line-text-muted: #aaaaaa;
$line-border: #e0e0e0;

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  width: 100%;
  background-color: $line-bg;
  color: $line-text;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: $line-header;
  border-bottom: 1px solid $line-border;
  flex-shrink: 0;

  .header-title {
    font-weight: bold;
    font-size: 1.1rem;
    flex-grow: 1;
  }

  .header-options {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    color: #555;
    margin: 0 20px;

    .toggle-disabled {
      cursor: not-allowed;
      opacity: 0.6;
      pointer-events: none;
    }
  }
  
  .disconnect-btn {
    border: none;
    background: none;
    color: $line-text;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 6px;
    
    &:hover {
      opacity: 0.7;
    }
  }
}

.message-list {
  flex-grow: 1;
  overflow-y: auto;
  padding: 16px;
}

.message-row {
  display: flex;
  margin-bottom: 16px;
}

.my-message-row {
  justify-content: flex-end;
  .message {
    flex-direction: row-reverse;
  }
  .message-content {
    background-color: $line-green;
    color: $line-text-light;
  }
}

.message {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  .message-content {
    padding: 10px 14px;
    border-radius: 18px;
    background-color: $line-header;
    max-width: 250px;
    line-height: 1.5;
    word-break: break-word;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .message-time {
    font-size: 0.75rem;
    color: $line-text-muted;
    flex-shrink: 0;
  }
}

.message-form {
  display: flex;
  padding: 10px;
  gap: 10px;
  background-color: $line-header;
  border-top: 1px solid $line-border;
  flex-shrink: 0;

  input {
    flex-grow: 1;
    border: 1px solid $line-border;
    outline: none;
    background-color: #f9f9f9;
    border-radius: 20px;
    padding: 10px 16px;
    font-size: 1rem;
    &:focus {
      border-color: darken($line-border, 10%);
    }
  }

  button {
    border: none;
    background-color: $line-green;
    color: white;
    font-weight: bold;
    padding: 0 20px;
    border-radius: 20px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    &:hover {
      background-color: darken($line-green, 10%);
    }
  }
}

.loading-spinner-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  color: white;
}
</style>