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
        <ToggleButton ref="messageSaving" :init="isMessageSaved" @toggle="(v) => $store.commit('setOption', { k: 'isMessageSaved', v })"
        />
      </div>
      <div>
        <span>アプリケーション暗号化を有効化する</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            通信データのアプリケーション暗号化を有効化します.<br />
            端末のリソースが制限されている場合にのみ無効化してください.
          </template>
        </SpeechBubble>:
        <ToggleButton ref="appEncryption"
          :init="isAppEncryptionEnabled"
          @toggle="(v) => $store.commit('setOption', { k: 'isAppEncryptionEnabled', v })"
        />
      </div>
      <div>
        <span>チャットデータを削除</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            お使いのPCに保存されたメッセージデータを削除します.<br />
            削除したデータを復元することはできません.<br />
            やり取りをした相手のPCにはデータが残る場合があります.
          </template>
        </SpeechBubble>:
        <button @click="clearMessageData">削除</button>
      </div>
      <div>
        <span>クライアントデータを削除</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            お使いのPCに保存されたクライアントデータを削除します.<br />
            削除したデータを復元することはできません.<br />
            やり取りをした相手のPCにはデータが残る場合があります.
          </template>
        </SpeechBubble>:
        <button @click="clearClientData">削除</button>
      </div>
      <div>
        <span>接続データを削除</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            お使いのPCに保存された接続データを削除します.<br />
            削除したデータを復元することはできません.
          </template>
        </SpeechBubble>:
        <button @click="clearConnectionData">削除</button>
      </div>
      <div>
        <span>ローカルデータをすべて削除</span>
        <SpeechBubble>
          <IconCircleQuestion />
          <template #bubble>
            お使いのPCに保存されたメッセージを含むすべてのデータを削除します.<br />
            削除したデータを復元することはできません.<br />
            やり取りをした相手のPCにはデータが残る場合があります.
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
      <div v-if="lastRemotePeerInfo">
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
import { mapGetters } from 'vuex';
import Database from '@/lib/database';
const db = new Database();
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
      lastRemotePeerInfo: null,
    };
  },
  computed: {
    ...mapGetters(['peer', 'myPeerId', 'isAppEncryptionEnabled', 'isMessageSaved']),
    connectionURL: function() {
      return `https://p2p-chat.vercel.app/connect?id=${this.myPeerId}`;
    },
  },
  async created() {
    // 過去データの読み込み
    this.recentRemotePeerId = await db.getAllClients();
    this.lastRemotePeerInfo = await db.getState('last_remote_peer_info');
  },
  methods: {
    onConnectionEstablished(connection) {
      console.debug('Connection is established');
      this.$store.commit('setConnection', connection);
      this.$store.commit('setReceiversFlag', true);
      this.$router.push({ name: 'Connect', query: { id: connection.peer } });
    },
    async clearMessageData() {
      if (await this.$dialog.confirm('メッセージデータが削除されます. この操作は元に戻せません.') === false) return;
      db.clearMessages();
    },
    async clearClientData() {
      if (await this.$dialog.confirm('クライアントデータが削除されます. この操作は元に戻せません.') === false) return;
      db.clearClients();
    },
    async clearConnectionData() {
      if (await this.$dialog.confirm('すべての接続データが削除されます. この操作は元に戻せません.') === false) return;
      db.clearStates();
    },
    async clearLocalData() {
      if (await this.$dialog.confirm('すべてのデータが削除されます. この操作は元に戻せません.') === false) return;
      db.clearClients();
      db.clearMessages();
      db.clearStates();
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
      if (!this.lastRemotePeerInfo) return;
      this.$router.push({ name: 'Connect', query: { id: this.lastRemotePeerInfo.id } });
    },
  },
  watch: {
    peer(to) {
      if (!to) return;
      to.on('connection', this.onConnectionEstablished);
    },
    vmSelectedRecents(to) {
      if (to === '') return;
      this.remotePeerId = to;
      this.$refs.formRemotePeerId.set(to);
    },
  },
};
</script>

<style lang="scss" scoped>
.home {
  text-align: center;
}
</style>