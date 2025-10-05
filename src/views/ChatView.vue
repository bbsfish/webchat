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
              @toggle="requestEncryptionModeChange"
            />
          </div>
        </div>
        <button @click="disconnect" class="disconnect-btn">切断</button>
      </div>

      <div class="loading-spinner-wrap" v-if="isLoading">
        <LoadingSpinner :m="loadingMessage" />
      </div>

      <div class="message-list" ref="messageList">
        <div v-for="(m, i) in $store.getters.messages"
          class="message-row" :class="{ 'my-message-row': m.from === myPeerId }" :key="i">
          <div class="message">
            <p class="message-content" v-if="m.type === 'text'">{{ m.content }}</p>

            <div class="message-content file-message-content" v-if="m.type === 'file-transfer-request'">
              <div v-if="m.from === myPeerId">
                <span>ファイルを送信しました: {{ m.content.fileName }} ({{ (m.content.fileSize / 1024).toFixed(2) }} KB)</span>
              </div>
              <div v-else>
                <span>ファイルが送信されました: {{ m.content.fileName }} ({{ (m.content.fileSize / 1024).toFixed(2) }} KB)</span>
                <button
                  class="download-button"
                  @click="requestFileData(m)"
                  :disabled="m.content.downloadState !== 'idle'">
                  {{ getDownloadButtonText(m) }}
                </button>
              </div>
            </div>

            <span class="message-time">{{ new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>
        </div>
        <div ref="bottomMessageRef"></div>
      </div>

      <div class="message-form">
        <button @click="isFileTransferDialogVisible = true" class="file-send-btn">📎</button>
        <input v-model="vmNewMessage" @keyup.enter="send" placeholder="メッセージを入力..." />
        <button @click="send">送信</button>
      </div>
    </div>

    <teleport to="body">
      <FileTransfer
        v-if="isFileTransferDialogVisible"
        @close="isFileTransferDialogVisible = false"
        @send-file="sendFileRequest"
      />
    </teleport>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import Database from '@/lib/database';
const db = new Database();
import Crypto from '@/lib/crypto';
const crypto = new Crypto();
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import ToggleButton from '@/components/ToggleButton.vue';
import SpeechBubble from '@/components/SpeechBubble.vue';
import IconCircleQuestion from '@/components/icons/IconCircleQuestion.vue';
import FileTransfer from '@/components/FileTransfer.vue';

const CHUNK_SIZE = 16 * 1024; // 16KB

export default {
  name: 'ChatView',
  components: {
    LoadingSpinner,
    ToggleButton,
    SpeechBubble,
    IconCircleQuestion,
    FileTransfer,
  },
  data() {
    return {
      isLoading: true,
      loadingMessage: '初期化しています',
      vmNewMessage: '',
      isEncryptionActive: true,
      isAwaitingAck: false,
      isFileTransferDialogVisible: false,
      fileChunks: {},
      pendingFiles: {},
    };
  },
  computed: {
    ...mapGetters(['myPeerId', 'isReceiver', 'isServer', 'isMessageSaved', 'isAppEncryptionEnabled', 'keys']),
    remotePeerId: function() {
      return this.$route.query?.id;
    },
    isValidId() {
      const regex = new RegExp(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/);
      return regex.test(this.remotePeerId);
    },
  },
  async created() {    
    this.isEncryptionActive = this.$store.getters.isAppEncryptionEnabled;
    const messages = await db.getAllMessages();
    this.$store.commit('setMessages', messages);
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
      console.log('Data is received:', data);

      if (data.type === 'change-encryption-option') {
        let isConfirmed = false;
        if (data.content.to) isConfirmed = await this.$dialog.confirm('相手がアプリケーション暗号化を有効化するように求めています. 有効化しますか?');
        else isConfirmed = await this.$dialog.confirm('相手がアプリケーション暗号化を無効化するように求めています. 無効化しますか?');
        if (isConfirmed) {
          this.$store.commit('setOption', { k: 'isAppEncryptionEnabled', v: data.content.to });
          this.$refs.encryptionToggle.set(data.content.to);
          this.$store.dispatch('sendMessage', { type: 'change-encryption-option-success', content: data.content });
        }
        else this.$store.dispatch('sendMessage', { type: 'change-encryption-option-failed', content: data.content });
        return;
      }
      else if (data.type === 'change-encryption-option-success') {
        this.isLoading = false; this.loadingMessage = ''; return;
      }
      else if (data.type === 'change-encryption-option-failed') {
        this.$dialog.alert('設定の変更が拒否されました');
        this.$refs.encryptionToggle.set(data.content.from);
        this.$store.commit('setOption', { k: 'isAppEncryptionEnabled', v: data.content.from });
        this.loadingMessage = ''; this.isLoading = false; return;
      }
      
      if (data.type === 'file-transfer-request') {
        const { fileName, fileSize, fileType, transferId } = data.content;
        const message = {
          ...data,
          content: { fileName, fileSize, fileType, transferId, downloadState: 'idle' },
          type: 'file-transfer-request'
        };
        this.$store.commit('addMessage', message);
        return;
      }
      if (data.type === 'file-transfer-data-request') {
        this.sendFileData(data.content.transferId);
        return;
      }
      if (data.type === 'file-chunk') {
        const { transferId, chunk, sequence, isLast } = data.content;
        if (!this.fileChunks[transferId]) this.fileChunks[transferId] = [];
        this.fileChunks[transferId][sequence] = chunk;
        if (isLast) this.reconstructAndDownloadFile(transferId);
        return;
      }

      if (data.type === 'text') {
        let content = data.content;
        if (this.isAppEncryptionEnabled) {
          try {
            content = await crypto.decrypt(data.content, this.keys.decoder);
          } catch (e) {
            console.error('Decryption failed:', e);
            this.$dialog.alert('メッセージの復号に失敗しました。暗号化設定が一致しない可能性があります。');
            return;
          }
        }
        const message = { ...data, content, me: 0 };
        this.$store.commit('addMessage', message);
        this.$nextTick(() => {
          const container = this.$refs.messageList;
          const bottomMarker = this.$refs.bottomMessageRef;
          if (container && bottomMarker) container.scrollTo({ top: bottomMarker.offsetTop + 61, behavior: 'smooth' });
        });
        if (this.isMessageSaved) db.addMessage(message);
      }
    },
    onConnectionClosed() {
      if (this.isAwaitingAck) {
        this.isAwaitingAck = false; this.loadingMessage = '';
        this.$dialog.alert('相手が応答せずに接続を切断しました。');
      } else {
        this.$dialog.alert('接続が切断されました');
      }
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
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
      if (this.isAppEncryptionEnabled) {
        messageContent = await crypto.encrypt(plainMessage, this.keys.encoder);
      }
      const message = await this.$store.dispatch('sendMessage', { type: 'text', content: messageContent });
      if (!message) {
        this.$dialog.alert('メッセージを送信できませんでした. 接続を確認してください.'); return;
      }
      const displayMessage = { ...message, content: plainMessage, me: 1 };
      this.$store.commit('addMessage', displayMessage);
      this.$nextTick(() => {
        const container = this.$refs.messageList;
        const bottomMarker = this.$refs.bottomMessageRef;
        if (container && bottomMarker) container.scrollTo({ top: bottomMarker.offsetTop + 61, behavior: 'smooth' });
      });
      if (this.isMessageSaved) db.addMessage(displayMessage);
      this.vmNewMessage = '';
    },
    requestEncryptionModeChange(to) {
      this.isLoading = true; this.loadingMessage = '相手の応答を待っています';
      this.$store.commit('setOption', { k: 'isAppEncryptionEnabled', v: to });
      this.$store.dispatch('sendMessage', { type: 'change-encryption-option', content: { to, from: !to } });
    },
    getDownloadButtonText(message) {
      const state = message.content.downloadState;
      if (state === 'downloading') return 'ダウンロード中...';
      if (state === 'completed') return 'ダウンロード完了';
      return 'ダウンロード';
    },
    requestFileData(message) {
      const { transferId } = message.content;
      this.$store.dispatch('sendMessage', {
        type: 'file-transfer-data-request',
        content: { transferId }
      });
      this.$store.commit('updateMessageDownloadState', { transferId, downloadState: 'downloading' });
    },
    reconstructAndDownloadFile(transferId) {
      const chunks = this.fileChunks[transferId];
      const message = this.$store.getters.messages.find(m => m.content.transferId === transferId);
      if (!message || !chunks) return;

      const { fileName, fileType } = message.content;
      const fileBlob = new Blob(chunks, { type: fileType });
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
      const extension = fileName.split('.').pop();
      a.download = `file_from_${this.remotePeerId}_${timestamp}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      delete this.fileChunks[transferId];
      
      this.$store.commit('updateMessageDownloadState', { transferId, downloadState: 'completed' });
    },
    // ★★★ 変更箇所 ★★★
    async sendFileRequest(file) {
      this.isFileTransferDialogVisible = false;
      if (file.size > 50 * 1024 * 1024) return this.$dialog.alert('ファイルサイズが大きすぎます (最大50MB).');
      
      const transferId = `file_${new Date().getTime()}`;
      this.pendingFiles[transferId] = file;

      const fileInfo = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        transferId,
      };

      // 相手にファイル転送リクエストを送信
      const message = await this.$store.dispatch('sendMessage', {
        type: 'file-transfer-request',
        content: fileInfo
      });

      if (!message) {
        this.$dialog.alert('ファイルリクエストを送信できませんでした. 接続を確認してください.');
        return;
      }
      
      // 自分の画面にログを表示するために、ストアにコミット
      const logMessage = {
        from: this.myPeerId,
        type: 'file-transfer-request',
        timestamp: new Date(),
        content: fileInfo,
      };
      this.$store.commit('addMessage', logMessage);

      // メッセージリストを一番下にスクロール
      this.$nextTick(() => {
        const container = this.$refs.messageList;
        const bottomMarker = this.$refs.bottomMessageRef;
        if (container && bottomMarker) container.scrollTo({ top: bottomMarker.offsetTop + 61, behavior: 'smooth' });
      });
    },
    sendFileData(transferId) {
      const file = this.pendingFiles[transferId];
      if (!file) return;
      let offset = 0;
      let sequence = 0;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.$store.dispatch('sendMessage', {
          type: 'file-chunk',
          content: { transferId, chunk: e.target.result, sequence, isLast: offset >= file.size }
        });
        if (offset < file.size) {
          sequence++;
          readNextChunk();
        } else {
          delete this.pendingFiles[transferId];
        }
      };
      const readNextChunk = () => {
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        reader.readAsArrayBuffer(slice);
        offset += CHUNK_SIZE;
      };
      readNextChunk();
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
$line-bg: #eef1f4;
$line-green: #06c755;
$line-header: #ffffff;
$line-text: #333333;
$line-text-light: #050505;
$line-text-muted: #aaaaaa;
$line-border: #e0e0e0;

.chat-layout { display: flex; flex-direction: column; height: 100%; }
.chat-container { display: flex; flex-direction: column; flex-grow: 1; width: 100%; background-color: $line-bg; color: $line-text; overflow: hidden; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background-color: $line-header; border-bottom: 1px solid $line-border; flex-shrink: 0;
  .header-title { font-weight: bold; font-size: 1.1rem; flex-grow: 1; }
  .header-options { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #555; margin: 0 20px;
    .toggle-disabled { cursor: not-allowed; opacity: 0.6; pointer-events: none; }
  }
  .disconnect-btn { border: none; background: none; color: $line-text; cursor: pointer; font-size: 0.9rem; padding: 6px; &:hover { opacity: 0.7; } }
}
.message-list { flex-grow: 1; overflow-y: auto; padding: 16px; position: relative; }
.message-row { display: flex; margin-bottom: 16px; }
.my-message-row { justify-content: flex-end;
  .message { flex-direction: row-reverse; }
  .message-content { background-color: $line-green; color: black; }
  .file-message-content { color: #333; } // ★★★ 追加 ★★★
}
.message { display: flex; align-items: flex-end; gap: 2px;
  .message-content { padding: 10px 14px; margin: 0; border-radius: 18px; background-color: $line-header; max-width: 250px; line-height: 1.5; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .message-time { font-size: 0.75rem; color: $line-text-muted; flex-shrink: 0; }
}
.message-form { display: flex; padding: 10px; gap: 10px; background-color: $line-header; border-top: 1px solid $line-border; flex-shrink: 0; align-items: center;
  input { flex-grow: 1; border: 1px solid $line-border; outline: none; background-color: #f9f9f9; border-radius: 20px; padding: 10px 16px; font-size: 1rem; &:focus { border-color: darken($line-border, 10%); } }
  button { border: none; background-color: $line-green; color: white; font-weight: bold; padding: 0 20px; border-radius: 20px; cursor: pointer; transition: background-color 0.2s ease; align-self: stretch; &:hover { background-color: darken($line-green, 10%); } }
}
.loading-spinner-wrap { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 10; color: white; }
.file-send-btn { border: none !important; background: none !important; font-size: 1.5rem; cursor: pointer; padding: 0 10px !important; color: #555 !important; &:hover { opacity: 0.7; } }
.download-button { background-color: $line-green; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; margin-top: 8px; display: block; font-weight: bold; &:hover { background-color: darken($line-green, 10%); }
  &:disabled { background-color: #ccc; cursor: not-allowed; }
}
</style>