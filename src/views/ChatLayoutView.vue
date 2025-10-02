<template>
  <div class="chat-layout">
    <div class="chat-container" v-if="isValidId">
      <div class="chat-header">
        <span class="header-title">トーク</span>
        <button @click="disconnect" class="disconnect-btn">切断</button>
      </div>

      <div class="loading-spinner-wrap" v-if="$store.getters.chat.isLoading">
        <LoadingSpinner :m="$store.getters.chat.loadingMessage" />
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
    <div v-else>IDが不正です</div>
    <router-view :key="$route.fullPath" />
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import WebChatDB from '@/lib/webchatdb';
const db = new WebChatDB();
import LoadingSpinner from '@/components/LoadingSpinner.vue';

export default {
  name: 'ChatLayout',
  components: {
    LoadingSpinner,
  },
  data() {
    return {
      vmNewMessage: '',
    };
  },
  computed: {
    ...mapGetters(['myPeerId']),
    remotePeerId: function() {
      return this.$route.query?.id;
    },
    isValidId() {
      const regex = new RegExp(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/);
      return regex.test(this.remotePeerId)
    },
  },
  async created() {
    const messages = await db.getAllMessages();
    this.$store.commit('setMessages', messages);
  },
  methods: {
    disconnect() {
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    },
    send() {
      const msg = this.vmNewMessage.trim();
      if (msg === '') return;
      this.$store.commit('setChat', { k: 'content', v: msg });
      this.$store.commit('setChat', { k: 'isContentUpdated', v: true });
      this.vmNewMessage = '';
    },
  },
};
</script>

<style lang="scss" scoped>
/* --- LINE風カラーパレット --- */
$line-bg: #eef1f4;
$line-green: #06c755;
$line-header: #ffffff;
$line-text: #333333;
$line-text-light: #050505;
$line-text-muted: #aaaaaa;
$line-border: #e0e0e0;

/* --- チャットコンテナ全体 --- */
.chat-container {
  display: flex;
  flex-direction: column;
  // スマホのキーボード出現時に高さを自動調整する
  height: 100vh; // Fallback for older browsers
  height: 100dvh; // Dynamic viewport height
  width: 100%;
  background-color: $line-bg;
  color: $line-text;
  overflow: hidden;
}

/* --- ヘッダー --- */
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background-color: $line-header;
  border-bottom: 1px solid $line-border;
  flex-shrink: 0; // 高さが縮まないようにする

  .header-title {
    font-weight: bold;
    font-size: 1.1rem;
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


/* --- メッセージリスト --- */
.message-list {
  flex-grow: 1;
  overflow-y: auto;
  padding: 16px;
}

/* --- メッセージの行 --- */
.message-row {
  display: flex;
  margin-bottom: 16px;
}

// 自分のメッセージの行は右寄せ
.my-message-row {
  justify-content: flex-end;

  .message {
    flex-direction: row-reverse; // 時間と吹き出しの順序を逆にする
  }

  .message-content {
    background-color: $line-green;
    color: $line-text-light;
  }
}

/* --- 個々のメッセージ --- */
.message {
  display: flex;
  align-items: flex-end;
  gap: 8px;

  .message-content {
    padding: 10px 14px;
    border-radius: 18px;
    background-color: $line-header;
    max-width: 250px; // 吹き出しの最大幅
    line-height: 1.5;
    word-break: break-word;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  .message-time {
    font-size: 0.75rem;
    color: $line-text-muted;
    flex-shrink: 0; // 時間が縮まないように
  }
}

/* --- メッセージ入力フォーム --- */
.message-form {
  display: flex;
  padding: 10px;
  gap: 10px;
  background-color: $line-header;
  border-top: 1px solid $line-border;
  flex-shrink: 0; // 高さが縮まないようにする

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

// スピナーは変更なし
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
