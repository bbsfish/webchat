<template>
  <div class="home">
    <h1>P2P WebChat</h1>
    <div>
      <h2>設定</h2>
      <div>
        <span>チャットを保存する</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            チャット内容をブラウザに保存します.<br />
            このデータはキャッシュクリア等で削除される可能性があります.
          </template>
        </SpeechBubble>:
        <ToggleButton ref="messageSaving"
          :init="$store.getters.isMessageSaved"
          @on="enableMessageSaving"
          @off="$store.commit('setOption', { k: 'isMessageSaved', v: false })"
        />
      </div>
      <div>
        <span>アプリケーションによる暗号化を使用する</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            通信データをアプリケーションレイヤーで暗号化します.<br />
            なお、これをオンにしなくても、通信は安全です.<br />
            追加の安全性を得たい場合にのみ有効化してください.
          </template>
        </SpeechBubble>:
        <ToggleButton ref="appEncryption"
          :init="$store.getters.isAppEncryptionUsed"
          @on="enableAppEncryption"
          @off="$store.commit('setOption', { k: 'isAppEncryptionUsed', v: false })"
        />
      </div>
      <div>
        <span>チャットデータを削除</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            お使いのPCに保存されたメッセージデータを削除します.<br />
            削除したデータを復元することはできません.<br />
            やり取りをした相手のPCにはデータが残ります.
          </template>
        </SpeechBubble>:
        <button @click="clearMessageData">削除</button>
      </div>
      <div>
        <span>ローカルデータをすべて削除</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            お使いのPCに保存されたメッセージを含むすべてのデータを削除します.<br />
            削除したデータを復元することはできません.<br />
            やり取りをした相手のPCにはデータが残ります.
          </template>
        </SpeechBubble>:
        <button @click="clearLocalData">削除</button>
      </div>
    </div>
    <div v-if="myPeerId">
      <p>あなたのID:</p>
      <strong class="peer-id">{{ myPeerId }}</strong>
    </div>
    <div v-else>
      <p>PeerServerに接続中...</p>
    </div>
    <QRCode v-if="myPeerId" :text="connectionURL" />
    <div class="connect-form">
      <input 
        v-model="vmRemotePeerId" 
        type="text" 
        placeholder="相手のPeer IDを入力"
      />
      <button @click="connect">接続</button>
    </div>
  </div>
</template>

<script>
import { Peer } from 'peerjs';
import ws from '@/lib/ws';
import WebChatDB from '@/lib/webchatdb';
import IconCircleQuestion from '@/components/icons/IconCircleQuestion.vue';
import ToggleButton from '@/components/ToggleButton.vue';
import SpeechBubble from '@/components/SpeechBubble.vue';
import QRCode from '@/components/QRCode.vue';
const db = new WebChatDB();

export default {
  name: 'HomeView',
  components: {
    IconCircleQuestion,
    SpeechBubble,
    ToggleButton,
    QRCode,
  },
  data() {
    return {
      vmRemotePeerId: '',
    };
  },
  computed: {
    myPeerId: function() {
      return this.$store.getters.myPeerId;
    },
    connectionURL: function() {
      return `http://192.168.68.16:8080/connect?id=${this.myPeerId}`;
    },
  },
  methods: {
    async enableMessageSaving() {
      if (await this.$dialog.confirm('これを有効化すると、メッセージが保存されます. よろしいですか?') === false) return this.$refs.messageSaving.setOff();
      this.$store.commit('setOption', { k: 'isMessageSaved', v: true });
    },
    async enableAppEncryption() {
      if (await this.$dialog.confirm(
        'これを有効化すると、アプリケーション暗号化が有効化されます.\nなお、保存データは暗号化されません. よろしいですか?'
      ) === false) return this.$refs.appEncryption.setOff();
      this.$store.commit('setOption', { k: 'isAppEncryptionUsed', v: true });
    },
    async clearMessageData() {
      if (await this.$dialog.confirm('メッセージデータが削除されます. この操作は元に戻せません.') === false) return;
    },
    async clearLocalData() {
      if (await this.$dialog.confirm('すべてのデータが削除されます. この操作は元に戻せません.') === false) return;
      db.clearClients();
      db.clearMessages();
    },
    connect() {
      const remotePeerId = this.vmRemotePeerId.trim();
      if (!remotePeerId) {
        this.$dialog.alert('相手のIDを入力してください');
        return;
      }
      this.$router.push({ name: 'Connect', query: { id: remotePeerId } });
    },
  },
  async created() {
    if (this.myPeerId) return;

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

    // 相手からの接続を待機
    peer.on('connection', (connection) => {
      console.debug('Connection is established');
      this.$store.commit('setConnection', connection);
      this.$router.push({ name: 'Connect', query: { id: connection.peer } });
    });

    peer.on('close', () => {
      this.$dialog.alert('接続が切断されました(close)');
    });

    peer.on('disconnected', () => {
      this.$dialog.alert('接続が切断されました(disconnected)');
    });

    peer.on('error', (err) => {
      console.error(err);
      this.$dialog.alert('接続が切断されました: ' + err.type);
    });
  }
};
</script>

<style lang="scss" scoped>
.home {
  text-align: center;
}
</style>
