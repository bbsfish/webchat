<template></template>

<script>
import { mapGetters } from 'vuex';
import Encryption from '@/lib/encryption';
const crypto = new Encryption();

export default {
  name: 'ChatSecureView',
  data() {
    return {
      keys: null,
      enckey: null, // エンコードキー（暗号化鍵）
      deckey: null, // デコードキー（複合化鍵）
    };
  },
  computed: {
    ...mapGetters([ 'myPeerId', 'isReceiver', 'isMessageSaved', 'isAppEncryptionUsed' ]),
    remotePeerId: function() {
      return this.$route.query?.id;
    },
  },
  async created() {
    this.$store.commit('setChat', { k: 'isLoading', v: true });

    // 鍵を生成
    this.$store.commit('setChat', { k: 'loadingMessage', v: '鍵を生成しています' });
    this.keys = await crypto.generateKeys();
    this.deckey = this.keys.privateKey;

    // 1. レシーバーは初回にハローを送信する
    if (this.isReceiver) {
      this.$store.commit('setChat', { k: 'loadingMessage', v: '鍵を送信しています' });
      const exportedPublicKeyJwk = await crypto.exportKeyAsJwk(this.keys.publicKey);
      this.$store.dispatch('sendMessage', { type: 'rhello', content: exportedPublicKeyJwk });
      this.$store.commit('setChat', { k: 'loadingMessage', v: '相手からの応答を待っています' });
    }
    else {
      this.$store.commit('setChat', { k: 'loadingMessage', v: '相手からの応答を待っています' });
    }

    const connection = this.$store.getters.connection;
    connection.on('data', this.onDataReceived);
    connection.on('close', this.onConnectionClosed);
    connection.on('error', this.onConnectionError);
  },
  methods: {
    async onDataReceived(data) {
      console.log('Received:', data);
      // 1.1 レシーバーが暗号モードじゃないとき
      if (data.type === 'hello') {
        this.$store.dispatch('sendMessage', { type: 'secure', content: null });
        return;
      }
      // 2. サーバーは初回にハローを受け取り、鍵を送る
      else if (data.type === 'rhello') {
        this.enckey = await crypto.importJwkAsKey(data.content, ['encrypt']);
        this.$store.commit('setChat', { k: 'loadingMessage', v: '鍵を送信しています' });
        const exportedPublicKeyJwk = await crypto.exportKeyAsJwk(this.keys.publicKey);
        this.$store.dispatch('sendMessage', { type: 'shello', content: exportedPublicKeyJwk });
        this.$store.commit('setChat', { k: 'isLoading', v: false });
        return;
      }
      // 3. レシーバーはサーバーから鍵を受け取る
      else if (data.type === 'shello') {
        this.enckey = await crypto.importJwkAsKey(data.content, ['encrypt']);
        this.$store.commit('setChat', { k: 'loadingMessage', v: '' });
        this.$store.commit('setChat', { k: 'isLoading', v: false });
        return;
      }
      else if (data.type !== 'text') return;
      // 受信メッセージの複合化
      data.content = await crypto.decrypt(data.content, this.deckey);
      this.$store.commit('addMessage', data);
      if (this.isMessageSaved) {
        data.me = 0;
        db.addMessage(data);
        console.debug('Message is added into db');
      }
    },
    onConnectionClosed() {
      this.$dialog.alert('接続が切断されました');
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    },
    onConnectionError() {
      console.error(err);
      this.$dialog.alert(`通信エラーが発生しました: ${err.type}`);
    },
  },
  watch: {
    async '$store.state.chat.isContentUpdated'(to) {
      if (!to) return;
      const plainMessage = this.$store.getters.chat.content;
      // メッセージの送信
      const encodedMessage = await crypto.encrypt(plainMessage, this.enckey);
      const message = await this.$store.dispatch('sendMessage', { type: 'text', content: encodedMessage });
      if (!message) return this.$dialog.alert('メッセージを送信できませんでした. 接続を確認してください.');
      message.content = plainMessage;
      this.$store.commit('addMessage', message);
      // メッセージの保存
      if (this.isMessageSaved) {
        message.me = 1;
        db.addMessage(message);
      }
      this.$store.commit('setChat', { k: 'content', v: null });
      this.$store.commit('setChat', { k: 'isContentUpdated', v: false });
    }
  },
};
</script>
