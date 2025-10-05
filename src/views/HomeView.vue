<template>
  <div class="home-container">
    <div class="home-header">
      <h1>P2P WebChat</h1>
    </div>

    <div class="home-content">
      <div class="card">
        <div v-if="myPeerId">
          <h2>あなたのID</h2>
          <ClipboardBox :text="myPeerId" />
          <div class="qr-code-wrapper">
            <QRCode v-if="myPeerId" :text="connectionURL" />
            <p>QRコードを読み取って接続</p>
          </div>
        </div>
        <div v-else class="loading-peer">
          <p>PeerServerに接続中...</p>
        </div>
      </div>

      <div class="card">
        <h2>相手に接続する</h2>
        <div class="connect-form">
          <div v-if="lastRemotePeerInfo" class="reconnect-wrapper">
            <button @click="reconnect" class="reconnect-btn">前回の相手に再接続する</button>
          </div>
          <InputText ref="formRemotePeerId" placeholder="相手のIDを入力" @change="(v) => remotePeerId = v" />
          <div class="select-wrapper">
            <select v-model="vmSelectedRecents">
              <option selected value="">または登録済みの接続先を選択</option>
              <option v-for="(d, i) of recentRemotePeerId" :key="i" :value="d.id">{{ d.nickname }}</option>
            </select>
            <SpeechBubble>
              <IconCircleQuestion />
              <template #bubble>
                お使いのPCに保存された登録済みの接続先を選択できます.<br />
                最近接続したものほど上に表示されます.
              </template>
            </SpeechBubble>
          </div>
          <button @click="connect" class="connect-btn">接続</button>
        </div>
      </div>

      <div class="card settings-card">
        <h2>設定</h2>
        <div class="setting-item">
          <div class="setting-label">
            <span>チャットを保存する</span>
            <SpeechBubble>
              <IconCircleQuestion />
              <template #bubble>
                チャット内容をブラウザに保存します.<br />
                このデータはキャッシュクリア等で削除される可能性があります.
              </template>
            </SpeechBubble>
          </div>
          <ToggleButton ref="messageSaving" :init="isMessageSaved" @toggle="(v) => $store.commit('setOption', { k: 'isMessageSaved', v })" />
        </div>
        <div class="setting-item">
          <div class="setting-label">
            <span>アプリケーション暗号化</span>
            <SpeechBubble>
              <IconCircleQuestion />
              <template #bubble>
                通信データのアプリケーション暗号化を有効化します.<br />
                端末のリソースが制限されている場合にのみ無効化してください.
              </template>
            </SpeechBubble>
          </div>
          <ToggleButton ref="appEncryption" :init="isAppEncryptionEnabled" @toggle="(v) => $store.commit('setOption', { k: 'isAppEncryptionEnabled', v })" />
        </div>
        
        <h2>データ管理</h2>
        <div class="data-actions">
            <button @click="clearMessageData">チャット削除</button>
            <button @click="clearClientData">クライアント削除</button>
            <button @click="clearConnectionData">接続データ削除</button>
            <button @click="clearLocalData" class="danger">全データ削除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import Database from '@/lib/database';
const db = new Database();
import IconCircleQuestion from '@/components/icons/IconCircleQuestion.vue';
import ToggleButton from '@/components/ToggleButton.vue';
import SpeechBubble from '@/components/SpeechBubble.vue';
import QRCode from '@/components/QRCode.vue';
import InputText from '@/components/InputText.vue';
import ClipboardBox from '@/components/ClipboardBox.vue';

export default {
  name: 'HomeView',
  components: {
    IconCircleQuestion,
    ClipboardBox,
    SpeechBubble,
    ToggleButton,
    InputText,
    QRCode,
  },
  data() {
    return {
      remotePeerId: '',
      recentRemotePeerId: [],
      vmSelectedRecents: '',
      lastRemotePeerInfo: null,
    };
  },
  computed: {
    ...mapGetters(['peer', 'myPeerId', 'isAppEncryptionEnabled', 'isMessageSaved']),
    connectionURL: function() {
      // return `https://p2p-chat.vercel.app/connect?id=${this.myPeerId}`;
      return `${window.location.origin}/connect?id=${this.myPeerId}`
    },
  },
  async created() {
    // 過去データの読み込み
    this.recentRemotePeerId = await db.getAllClients();
    this.lastRemotePeerInfo = await db.getState('last_remote_peer_info');
  },
  methods: {
    onConnectionEstablished(connection) {
      console.debug('Connection is established');
      this.$store.commit('setConnection', connection);
      this.$store.commit('setReceiversFlag', true);
      this.$router.push({ name: 'Connect', query: { id: connection.peer } });
    },
    async clearMessageData() {
      if (await this.$dialog.confirm('メッセージデータが削除されます. この操作は元に戻せません.') === false) return;
      db.clearMessages();
    },
    async clearClientData() {
      if (await this.$dialog.confirm('クライアントデータが削除されます. この操作は元に戻せません.') === false) return;
      db.clearClients();
    },
    async clearConnectionData() {
      if (await this.$dialog.confirm('すべての接続データが削除されます. この操作は元に戻せません.') === false) return;
      db.clearStates();
    },
    async clearLocalData() {
      if (await this.$dialog.confirm('すべてのデータが削除されます. この操作は元に戻せません.') === false) return;
      db.clearClients();
      db.clearMessages();
      db.clearStates();
    },
    connect() {
      const remotePeerId = this.remotePeerId.trim();
      if (!remotePeerId) {
        this.$dialog.alert('相手のIDを入力してください');
        return;
      }
      this.$router.push({ name: 'Connect', query: { id: remotePeerId } });
    },
    reconnect() {
      if (!this.lastRemotePeerInfo) return;
      this.$router.push({ name: 'Connect', query: { id: this.lastRemotePeerInfo.id } });
    },
  },
  watch: {
    peer(to) {
      if (!to) return;
      to.on('connection', this.onConnectionEstablished);
    },
    vmSelectedRecents(to) {
      if (to === '') return;
      this.remotePeerId = to;
      this.$refs.formRemotePeerId.set(to);
    },
  },
};
</script>

<style lang="scss" scoped>
$line-green: #06c755;
$line-bg: #f0f2f5;
$line-header-bg: #ffffff;
$line-border: #e0e0e0;
$text-color: #333;
$text-muted-color: #888;
$danger-color: #d9534f;

.home-container {
  background-color: $line-bg;
  min-height: 100%;
  color: $text-color;
}

.home-header {
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

.home-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background-color: $line-header-bg;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);

  h2 {
    margin-top: 0;
    margin-bottom: 16px;
    font-size: 1.1rem;
    border-bottom: 1px solid $line-border;
    padding-bottom: 8px;
  }
}

.loading-peer {
  text-align: center;
  padding: 20px;
  color: $text-muted-color;
}

.qr-code-wrapper {
  text-align: center;
  margin-top: 20px;

  p {
    margin-top: 8px;
    font-size: 0.9rem;
    color: $text-muted-color;
  }
}

.connect-form {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .reconnect-wrapper {
    margin-bottom: 8px;
  }

  .reconnect-btn {
    width: 100%;
    background-color: #ffc107;
    color: #333;
  }

  .select-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    
    select {
      flex-grow: 1;
      padding: 10px 12px;
      border: 1px solid $line-border;
      border-radius: 8px;
      background-color: #f9f9f9;
      font-size: 1rem;
      width: 100%;

      &:focus {
        outline: none;
        border-color: $line-green;
      }
    }
  }

  .connect-btn {
    background-color: $line-green;
    color: white;
  }
}

button {
  border: none;
  border-radius: 8px;
  padding: 12px 20px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.85;
  }
}

.settings-card {
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;

    &:last-of-type {
      border-bottom: none;
    }

    .setting-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .data-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 16px;
    
    button {
      background-color: #f0f2f5;
      color: $text-color;
      font-weight: normal;
      padding: 10px;

      &.danger {
        background-color: $danger-color;
        color: white;
        grid-column: 1 / -1; /* Span full width */
      }
    }
  }
}
</style>