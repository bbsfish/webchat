<template>
  <div class="connect">
    <h1>相手との接続</h1>
    <div v-if="remotePeerId && isValidId">
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
    <div v-else>
      ID が指定されていません. ID を指定してください.
      <button @click="$router.push({ name: 'Home' })">戻る</button>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import { Peer } from 'peerjs';
import ws from '@/lib/ws';
import WebChatDB from '@/lib/webchatdb';
const db = new WebChatDB();
import IconCircleQuestion from '@/components/icons/IconCircleQuestion.vue';
import ToggleButton from '@/components/ToggleButton.vue';
import SpeechBubble from '@/components/SpeechBubble.vue';
import InputText from '@/components/InputText.vue';

export default {
  name: 'ConnectView',
  components: {
    IconCircleQuestion,
    ToggleButton,
    SpeechBubble,
    InputText,
  },
  data() {
    return {
      isConnectionNamed: false,
      connectionName: '',
    };
  },
  computed: {
    ...mapGetters(['isReceiver', 'isAppEncryptionUsed']),
    remotePeerId: function() {
      return this.$route.query?.id;
    },
    isValidId() {
      const regex = new RegExp(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/);
      return regex.test(this.remotePeerId);
    },
  },
  methods: {
    connect() {
      if (this.isConnectionNamed && this.connectionName === '') return this.$dialog.alert('この接続に付ける名前を入力してください');
      else if (this.isConnectionNamed) {
        db.addClient({ id: this.remotePeerId, alias: '', nickname: this.connectionName });
      }
      if (this.isReceiver && this.isAppEncryptionUsed) this.$router.push({ name: 'ChatSecure', query: { id: this.remotePeerId } });
      else if (this.isReceiver) this.$router.push({ name: 'ChatPlain', query: { id: this.remotePeerId } });
      else {
        const connection = this.$store.getters.peer.connect(this.remotePeerId);
        connection.on('open', () => {
          console.debug('open connection');
          this.$store.commit('setConnection', connection);
          if (this.isAppEncryptionUsed) this.$router.push({ name: 'ChatSecure', query: { id: this.remotePeerId } });
          else this.$router.push({ name: 'ChatPlain', query: { id: this.remotePeerId } });
        });
      }
    },
    cancel() {
      if (this.isReceiver) this.$store.commit('closeConnection');
      this.$router.push({ name: 'Home' });
    }
  },
  created() {
    if (this.$store.getters.isConnected) this.$store.commit('setReceiver');
    if (this.$store.getters.myPeerId) return;

    // アプリケーション開始時にPeerJSを初期化
    // PeerServerへ接続し、自身のIDを取得
    const lastPeerId = ws.ls.get('peer_id');

    const peer = (() => {
      if (!lastPeerId) return new Peer();
      return new Peer(lastPeerId.id);
    })();

    this.$store.commit('setPeer', peer);

    peer.on('open', (id) => {
      console.debug('Peer is open');
      if (!lastPeerId) ws.ls.set('peer_id', { id, created: new Date() });
      this.$store.commit('setMyPeerId', id);
    });

    peer.on('close', () => {
      this.$dialog.alert('接続が切断されました(close)');
    });

    peer.on('disconnected', () => {
      this.$dialog.alert('接続が切断されました(disconnected)');
    });

    peer.on('error', (err) => {
      console.error(err);
      throw new Error(err.message);
    });
  }
}
</script>

<style lang="scss" scoped>
.connect {
  text-align: center;
}
</style>
