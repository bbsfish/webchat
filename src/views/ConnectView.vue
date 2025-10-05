<template>
  <div class="connect">
    <h1>相手との接続</h1>
    <div class="error" v-if="isError">
      <p>{{ errorMessage }}</p>
      <button @click="$router.push({ name: 'Home' })">ホームへ戻る</button>
    </div>
    <div class="loading" v-if="!isError && isLoading">
      <LoadingSpinner />
      <p>{{ loadingMessage }}</p>
    </div>
    <div class="connection-confirm" v-if="!isConnectionConfirmed">
      <div>
        <span>この接続を保存する</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            お使いのPCにこの接続先を保存します.
          </template>
        </SpeechBubble>:
        <ToggleButton @on="isConnectionNamed = true" @off="isConnectionNamed = false" />
      </div>
      <div v-if="isConnectionNamed">
        <span>この接続に名前を付ける</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            この接続先に名前を付けて保存します.
          </template>
        </SpeechBubble>:
        <InputText placeholder="この接続に付ける名前を入力" @change="(v) => connectionName = v" />
      </div>
      <span>"{{ remotePeerId }}" に接続します. よろしいですか？</span>
      <button @click="cancel">キャンセル</button>
      <button @click="connect">接続</button>
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
            this.loadingMessage = '相手の接続を待っています';
            resolve();
          });
          connection.on('data', this.onDataReceived);
          connection.on('error', this.onConnectionError);
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
      this.errorMessage = 'コネクションを確立できませんでした. やり直してください.';
      this.isError = true;
      reject(err);
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
.connect {
  text-align: center;
}
</style>