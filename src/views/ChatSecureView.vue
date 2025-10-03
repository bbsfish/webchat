<template></template>

<script>
import { mapGetters } from 'vuex';
import Encryption from '@/lib/encryption';
const crypto = new Encryption();
import WebChatDB from '@/lib/webchatdb';
const db = new WebChatDB();

export default {
  name: 'ChatSecureView',
  computed: {
    ...mapGetters([ 'myPeerId', 'isReceiver', 'isMessageSaved', 'isAppEncryptionUsed', 'enckey', 'deckey' ]), 
    remotePeerId: function() {
      return this.$route.query?.id;
    },
  },
  async created() {
    this.$store.commit('setChat', { k: 'isLoading', v: true });

    if (!this.enckey || !this.deckey) {
      this.$dialog.alert('暗号化キーが設定されていません。鍵交換からやり直してください。');
      this.$router.push({ name: 'Home' });
      return;
    }
  
    const connection = this.$store.getters.connection;
    connection.on('data', this.onDataReceived);
    connection.on('close', this.onConnectionClosed);
    connection.on('error', this.onConnectionError);

    this.$store.commit('setChat', { k: 'isLoading', v: false });
  },
  methods: {
    async onDataReceived(data) {
      console.log('Received:', data);
      // レシーバーが暗号モードじゃないとき
      if (data.type === 'hello') {
        this.$store.dispatch('sendMessage', { type: 'secure', content: null });
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
      this.$router.push({ name: 'Reception', query: { id: this.remotePeerId, disconnected: true } });
    },
    onConnectionError(err) {
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