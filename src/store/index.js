import Peer from 'peerjs';
import { createStore } from 'vuex';

export default createStore({
  state: {
    /** @type { Peer } PeerJSの接続を管理するPeerインスタンス */
    peer: null,
    /** @type { DataConnection } リモートピアとのデータ接続 */
    connection: null,
    /** @type { String } PeerISのシグナリングサーバから発行された一意のID */
    myPeerId: null,
    /** @type { Boolean } コネクションが確立するとtrueになる */
    isConnected: false,
    /** @type { Boolean } 自分がコネクション接続側なのか、受付側なのか */
    isReceiver: false,
    /** @type {{ type: String, timestamp: String, content: String }[]} メッセージ内容 */
    messages: [],
    /** ユーザーオプションデータ */
    options: {
      isMessageSaved: false,
      isAppEncryptionUsed: false,
    },
    /** ChatLayoutView.vueで使うデータ */
    chat: {
      /** @type { Boolean } ローディング中フラグ */
      isLoading: false,
      /** @type { String } ローディングメッセージ */
      loadingMessage: '',
      /** @type { String } 送信コンツンツ */
      content: null,
      /** @type { String } 送信コンツンツが更新されたことを通知 */
      isContentUpdated: false,
    },
    /** @type { CryptoKey } 暗号化キー */
    enckey: null,
    /** @type { CryptoKey } 復号化キー */
    deckey: null,
  },
  getters: {
    peer: (state) => state.peer,
    connection: (state) => state.connection,
    myPeerId: (state) => state.myPeerId,
    isConnected: (state) => state.isConnected,
    messages: (state) => state.messages,
    isReceiver: (state) => state.isReceiver,
    isMessageSaved: (state) => state.options.isMessageSaved,
    isAppEncryptionUsed: (state) => state.options.isAppEncryptionUsed,
    chat: (state) => state.chat,
    enckey: (state) => state.enckey,
    deckey: (state) => state.deckey,
  },
  mutations: {
    setPeer(state, peer) {
      console.debug('Peer is set:', peer);
      state.peer = peer;
    },
    closePeer(state) {
      state.peer.disconnect();
    },
    setConnection(state, connection) {
      console.debug('Connection is set:', connection);
      state.isConnected = true;
      state.connection = connection;
    },
    closeConnection(state) {
      console.debug('Connection is closed');
      if (state.connection) state.connection.close();
      state.connection = null;
      state.isConnected = false;
    },
    setMyPeerId(state, id) {
      console.debug('MyPeerId is set:', id);
      state.myPeerId = id;
    },
    setReceiver(state) {
      state.isReceiver = true;
    },
    setMessages(state, data) {
      console.debug('Messages are overwrited:', data);
      state.messages = data;
    },
    addMessage(state, data) {
      console.debug('Message is added:', data);
      state.messages.push(data);
    },
    clearMessages(state) {
      console.debug('Message is cleared');
      state.messages = [];
    },
    setOption(state, { k, v }) {
      state.options[k] = v;
    },
    setChat(state, { k, v }) {
      state.chat[k] = v;
    },
    setKeys(state, { enckey, deckey }) {
      if (enckey !== undefined) state.enckey = enckey;
      if (deckey !== undefined) state.deckey = deckey;
    },
  },
  actions: {
    sendMessage({ getters }, { type, content }) {
      if (getters.connection === null && !this.$store.getters.isConnected) return;
      const message = {
        from: getters.myPeerId,
        type: type,
        timestamp: new Date(),
        content,
      };
      console.debug('Message is sended:', message);
      getters.connection.send(message);
      return message;
    },
  },
});
