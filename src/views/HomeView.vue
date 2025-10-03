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
      <ClipboardBox :text="myPeerId" />
    </div>
    <div v-else>
      <p>PeerServerに接続中...</p>
    </div>
    <QRCode v-if="myPeerId" :text="connectionURL" />
    <div class="connect-form">
      <div v-if="lastRemotePeerId">
        <button @click="reconnect">前回の相手に再接続する</button>
      </div>
      <InputText ref="formRemotePeerId" placeholder="相手のIDを入力" @change="(v) => remotePeerId = v" />
      <div>
        <span>登録した接続先</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            お使いのPCに保存された登録済みの接続先を選択できます.<br />
            最近接続したものほど上に表示されます.
          </template>
        </SpeechBubble>:
        <select v-model="vmSelectedRecents">
          <option selected value="">登録した接続先を選択</option>
          <option v-for="(d, i) of recentRemotePeerId" :key="i" :value="d.id">{{ d.nickname }}</option>
        </select>
      </div>
      <button @click="connect">接続</button>
    </div>
  </div>
</template>

<script>
import { Peer } from 'peerjs';
import ws from '@/lib/ws';
import WebChatDB from '@/lib/webchatdb';
const db = new WebChatDB();
import IconCircleQuestion from '@/components/icons/IconCircleQuestion.vue';
import ToggleButton from '@/components/ToggleButton.vue';
import SpeechBubble from '@/components/SpeechBubble.vue';
import QRCode from '@/components/QRCode.vue';
import InputText from '@/components/InputText.vue';
import ClipboardBox from '@/components/ClipboardBox.vue';

export default {
  name: 'HomeView',
  components: {
    IconCircleQuestion,
    ClipboardBox,
    SpeechBubble,
    ToggleButton,
    InputText,
    QRCode,
  },
  data() {
    return {
      remotePeerId: '',
      recentRemotePeerId: [],
      vmSelectedRecents: '',
      lastRemotePeerId: null,
    };
  },
  computed: {
    myPeerId: function() {
      return this.$store.getters.myPeerId;
    },
    peer: function() {
      return this.$store.getters.peer;
    },
    connectionURL: function() {
      return `https://p2p-chat.vercel.app/connect?id=${this.myPeerId}`;
    },
  },
  async created() {
    // --- 1. PeerJSクライアントの初期化 ---
    // myPeerIdがストアになければ、アプリの初回起動とみなし初期化処理を実行
    if (!this.myPeerId) {
      const lastPeerId = ws.ls.get('peer_id');
      const peer = lastPeerId ? new Peer(lastPeerId.id) : new Peer();
      this.$store.commit('setPeer', peer);

      peer.on('open', (id) => {
        console.debug('Peer is open');
        if (!lastPeerId) ws.ls.set('peer_id', { id, created: new Date() });
        this.$store.commit('setMyPeerId', id);
      });

      // エラーハンドリングはApp.vueで集約しているのでここでは不要
    }

    // --- 2. 接続待機リスナーの設定 ---
    this.setupConnectionListener();

    // --- 3. 過去データの読み込み ---
    this.recentRemotePeerId = await db.getAllClients();
    const lastPeer = await db.getState('lastRemotePeerId');
    if (lastPeer) {
      this.lastRemotePeerId = lastPeer.value;
    }
  },
  beforeUnmount() {
    // HomeViewを離れる際に、重複登録を防ぐためリスナーを解除する
    if (this.peer) {
      this.peer.off('connection', this.onConnectionReceived);
    }
  },
  methods: {
    // 接続待機リスナーをセットアップするメソッド
    setupConnectionListener() {
      if (this.peer) {
        // 既にpeerオブジェクトが存在する場合は、安全のために一度解除してから再設定
        this.peer.off('connection', this.onConnectionReceived);
        this.peer.on('connection', this.onConnectionReceived);
      } else {
        // peerオブジェクトがまだ生成されていない場合（初回起動時など）は、
        // ストアの変更を監視して、生成されたらリスナーを設定する
        const unwatch = this.$store.watch(
          (state, getters) => getters.peer,
          (newPeer) => {
            if (newPeer) {
              newPeer.on('connection', this.onConnectionReceived);
              unwatch(); // 一度設定したら監視は解除
            }
          }
        );
      }
    },
    // 相手から接続要求があったときに呼び出されるメソッド
    onConnectionReceived(connection) {
      console.debug('Connection is established');
      this.$store.commit('setConnection', connection);
      this.$router.push({ name: 'Connect', query: { id: connection.peer } });
    },
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
      const remotePeerId = this.remotePeerId.trim();
      if (!remotePeerId) {
        this.$dialog.alert('相手のIDを入力してください');
        return;
      }
      this.$router.push({ name: 'Connect', query: { id: remotePeerId } });
    },
    reconnect() {
      if (!this.lastRemotePeerId) return;
      this.$router.push({ name: 'Connect', query: { id: this.lastRemotePeerId } });
    },
  },
  watch: {
    vmSelectedRecents(to) {
      if (to === '') return;
      this.remotePeerId = to;
      this.$refs.formRemotePeerId.set(to);
    },
  },
};
</script>