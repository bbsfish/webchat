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
    /** @type { Boolean } DataConnectionが確立するとtrueになる */
    isConnected: false,
    /** @type { Boolean } 自分がコネクション接続側なのか、受付側なのか */
    isReceiver: false,
    /** @type {{ type: String, timestamp: String, content: String }[]} メッセージ内容 */
    messages: [],
    /** ユーザーオプションデータ */
    options: {
      /** @type { Boolean } メッセージ保存 */
      isMessageSaved: false,
      /** @type { Boolean } アプリケーション暗号有効化 */
      isAppEncryptionEnabled: true,
    },
    /** アプリケーション暗号化データ */
    keys: {
      /** @type { CryptoKey } 自分の公開鍵 */
      publicKey: null,
      /** @type { CryptoKey } 暗号化鍵（相手の公開鍵） */
      encoder: null,
      /** @type { CryptoKey } 複合化鍵 */
      decoder: null,
    },
  },
  getters: {
    peer: (state) => state.peer,
    connection: (state) => state.connection,
    myPeerId: (state) => state.myPeerId,
    isConnected: (state) => state.isConnected,
    messages: (state) => state.messages,
    isServer: (state) => !state.isReceiver,
    isReceiver: (state) => state.isReceiver,
    isMessageSaved: (state) => state.options.isMessageSaved,
    isAppEncryptionEnabled: (state) => state.options.isAppEncryptionEnabled,
    isAppEncryptionDisabled: (state) => !state.options.isAppEncryptionEnabled,
    keys: (state) => state.keys,
  },
  mutations: {
    setPeer(state, peer) {
      console.debug('Peer is set:', peer);
      state.peer = peer;
    },
    closePeer(state) {
      console.debug('Peer is closed');
      state.peer.disconnect();
      state.isConnected = false;
      state.connection = null;
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
    setReceiversFlag(state, flag) {
      state.isReceiver = flag;
    },
    setMessages(state, data) {
      console.debug('Messages are overwrited:', data);
      state.messages = data;
    },
    addMessage(state, data) {
      console.debug('Message is added:', data);
      state.messages.push(data);
    },
    setOption(state, { k, v }) {
      console.debug('Option is changed: %s = %s', k, v);
      state.options[k] = v;
    },
    setKeys(state, { publicKey, encoder, decoder }) {
      console.debug('CryptoKeys are set');
      if (publicKey !== undefined) state.keys.publicKey = publicKey;
      if (encoder !== undefined) state.keys.encoder = encoder;
      if (decoder !== undefined) state.keys.decoder = decoder;
    },
  },
  actions: {
    sendMessage({ getters }, { type, content }) {
      console.group('MessageSending');
      if (getters.connection === null && !this.$store.getters.isConnected) {
        console.debug('failed');
        console.groupEnd();
        return;
      }
      const message = {
        from: getters.myPeerId,
        type: type,
        timestamp: new Date(),
        content,
      };
      console.debug('message:', message);
      getters.connection.send(message);
      console.debug('success');
      console.groupEnd();
      return message;
    },
  },
});
