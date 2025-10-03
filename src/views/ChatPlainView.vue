<template></template>

<script>
import { mapGetters } from 'vuex';
import WebChatDB from '@/lib/webchatdb';
const db = new WebChatDB();

export default {
  name: 'ChatPlainView',
  data() {
    return {
    };
  },
  computed: {
    ...mapGetters(['myPeerId', 'isReceiver', 'isMessageSaved', 'isAppEncryptionUsed']),
    remotePeerId: function() {
      return this.$route.query?.id;
    },
  },
  async created() {
    this.$store.commit('setChat', { k: 'isLoading', v: true });
    
    const connection = this.$store.getters.connection;
    connection.on('data', this.onDataReceived);
    connection.on('close', this.onConnectionClosed);
    connection.on('error', this.onConnectionError);
    this.$store.commit('setChat', { k: 'isLoading', v: false });
  },
  methods: {
    async onDataReceived(data) {
      console.log('Received:', data);
      if (data.type === 'secure') {
        const res = await this.$dialog.confirm('相手がアプリケーション暗号モードを使用しています. 有効化しますか?');
        if (res) {
          this.$store.commit('setOption', { k: 'isAppEncryptionUsed', v: true });
          this.$router.push({ name: 'ChatSecure', query: { id: this.remotePeerId } });
          return;
        }
        this.disconnect();
      }
      else if (data.type !== 'text') return;
      data.me = 0;
      if (this.isMessageSaved) {
        db.addMessage(data);
        console.debug('Message is added into db');
      }
      this.$store.commit('addMessage', data);
    },
    onConnectionClosed() {
      this.$dialog.alert('接続が切断されました(connection-close)');
      this.$store.commit('closeConnection');
      this.$router.push({ name: 'Reception', query: { id: this.remotePeerId, disconnected: true } });
    },
    onConnectionError(err) {
      console.error(err);
      this.$dialog.alert(`通信エラーが発生しました: ${err.type}`);
    },
    async send() {
      const newMessage = this.vmNewMessage.trim();
      if (!newMessage) return;
      // メッセージの送信
      const message = await this.$store.dispatch('sendMessage', { type: 'text', content: newMessage });
      if (!message) return this.$dialog.alert('メッセージを送信できませんでした. 接続を確認してください.');
      this.$store.commit('addMessage', message);
      // メッセージの保存
      if (this.isMessageSaved) {
        message.me = 1;
        db.addMessage(message);
      }
      this.vmNewMessage = '';
    },
  },
  watch: {
    async '$store.state.chat.isContentUpdated'(to) {
      if (!to) return;
      const newMessage = this.$store.getters.chat.content;
      // メッセージの送信
      const message = await this.$store.dispatch('sendMessage', { type: 'text', content: newMessage });
      if (!message) return this.$dialog.alert('メッセージを送信できませんでした. 接続を確認してください.');
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