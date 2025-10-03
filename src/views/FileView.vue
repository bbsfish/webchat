<template>
  <div class="file-view">
    <h1>ファイル送信</h1>
    <div v-if="!isSending && !sent">
      <p>送信するファイルを選択してください。</p>
      <input type="file" @change="onFileSelected" ref="fileInput" />
      <button @click="sendFile" :disabled="!selectedFile">送信</button>
    </div>
    <div v-if="isSending">
      <p>ファイルを送信中...</p>
      <progress :value="progress" max="100"></progress>
      <p>{{ progress.toFixed(1) }}%</p>
    </div>
    <div v-if="sent">
      <p>ファイルを送信しました。</p>
      <button @click="reset">別のファイルを送信</button>
    </div>
    <button @click="close" class="close-btn">チャットに戻る</button>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import Encryption from '@/lib/encryption';
const crypto = new Encryption();

export default {
  name: 'FileView',
  data() {
    return {
      selectedFile: null,
      isSending: false,
      sent: false,
      progress: 0,
    };
  },
  computed: {
    ...mapGetters(['connection', 'isAppEncryptionUsed', 'myPeerId']),
    // enckeyはVuexストアから取得することを想定
    enckey() {
      return this.$store.getters.enckey;
    },
    remotePeerId() {
      return this.$route.query?.uuid;
    },
  },
  methods: {
    onFileSelected(event) {
      this.selectedFile = event.target.files[0];
      if (this.selectedFile && this.selectedFile.size > 100 * 1024 * 1024) {
          this.$dialog.alert('ファイルサイズが大きすぎます。100MB以下のファイルを選択してください。');
          this.selectedFile = null;
          this.$refs.fileInput.value = null;
      }
    },
    async sendFile() {
      if (!this.selectedFile) return;
      if (!this.connection || !this.connection.open) {
        this.$dialog.alert('接続が確立されていません。');
        return;
      }
      if (this.isAppEncryptionUsed && !this.enckey) {
        this.$dialog.alert('暗号化キーがありません。セキュアチャットを一度開始してください。');
        return;
      }

      this.isSending = true;

      const file = this.selectedFile;
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const fileData = event.target.result; // ArrayBuffer
          const encryptedData = this.isAppEncryptionUsed 
            ? await this.encryptFile(fileData) 
            : this.arrayBufferToBase64(fileData);

          const CHUNK_SIZE = 64 * 1024; // 64KB
          const totalChunks = Math.ceil(encryptedData.length / CHUNK_SIZE);

          // 1. ファイルのメタ情報を送信
          this.connection.send({
            type: 'file-meta',
            from: this.myPeerId,
            timestamp: new Date(),
            content: {
              name: file.name,
              type: file.type,
              size: encryptedData.length,
              isEncrypted: this.isAppEncryptionUsed,
            }
          });
          
          // 少し待機して相手側が準備できるようにする
          await new Promise(resolve => setTimeout(resolve, 100));

          // 2. ファイルのチャンクを送信
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const chunk = encryptedData.slice(start, start + CHUNK_SIZE);
            this.connection.send({
              type: 'file-chunk',
              from: this.myPeerId,
              timestamp: new Date(),
              content: chunk,
            });
            this.progress = ((i + 1) / totalChunks) * 100;
            // ネットワークの輻輳を避けるための短い待機
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          this.sent = true;
        } catch (err) {
          console.error('ファイル送信エラー:', err);
          this.$dialog.alert(`ファイルの送信に失敗しました: ${err.message}`);
        } finally {
          this.isSending = false;
        }
      };

      reader.onerror = () => {
        this.$dialog.alert('ファイルの読み取りに失敗しました。');
        this.isSending = false;
      };

      reader.readAsArrayBuffer(file);
    },
    async encryptFile(arrayBuffer) {
        const base64String = this.arrayBufferToBase64(arrayBuffer);
        return await crypto.encrypt(base64String, this.enckey);
    },
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    },
    reset() {
      this.selectedFile = null;
      this.sent = false;
      this.progress = 0;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = null;
      }
    },
    close() {
      const chatViewName = this.isAppEncryptionUsed ? 'ChatSecure' : 'ChatPlain';
      this.$router.push({ name: chatViewName, query: { id: this.remotePeerId } });
    }
  },
  created() {
    if (!this.connection || !this.connection.open) {
      this.$dialog.alert('チャットへの接続がありません。ホームに戻ります。');
      this.$router.push({ name: 'Home' });
    }
  },
};
</script>

<style scoped>
.file-view {
  padding: 20px;
  text-align: center;
  max-width: 500px;
  margin: 40px auto;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
input[type="file"] {
  display: block;
  margin: 20px auto;
}
button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  background-color: #4caf50;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  margin: 5px;
}
button:disabled {
  background-color: #ccc;
}
.close-btn {
    background-color: #f44336;
}
progress {
  width: 90%;
  margin-top: 10px;
}
</style>