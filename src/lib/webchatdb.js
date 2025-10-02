/**
 * @typedef {object} Message
 * @property {number} id - メッセージID (自動採番)
 * @property {string} me - 送信者フラグ（1: 自分自身, 0: 相手）
 * @property {string} from - 送信元クライアントID
 * @property {string} type - メッセージ種別 ('text', 'image'など)
 * @property {Date} timestamp - タイムスタンプ
 * @property {string} content - メッセージ内容
 */

/**
 * @typedef {object} Client
 * @property {string} id - クライアントID
 * @property {string} alias - エイリアス
 * @property {string} nickname - ニックネーム
 */

class WebChatDB {
  /**
   * @param {string} dbName データベース名
   * @param {number} version データベースのバージョン
   */
  constructor(dbName = 'webchat.db', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  /**
   * データベースへの接続を開き、初期化する
   * @returns {Promise<IDBDatabase>} データベースインスタンス
   */
  async open() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // messages オブジェクトストア
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        }
        // clients オブジェクトストア
        if (!db.objectStoreNames.contains('clients')) {
          db.createObjectStore('clients', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Database error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * 指定されたオブジェクトストアでトランザクションを実行する
   * @private
   * @param {string} storeName オブジェクトストア名
   * @param {'readonly' | 'readwrite'} mode トランザクションモード
   * @param {(store: IDBObjectStore) => IDBRequest} callback 実行する処理
   * @returns {Promise<any>} 処理結果
   */
  async _execute(storeName, mode, callback) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = callback(store);

      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        console.error('Transaction error:', request.error);
        reject(request.error);
      };
    });
  }

  // --- Messages ---

  /**
   * 新しいメッセージを追加する
   * @param {Omit<Message, 'id'>} message - 追加するメッセージオブジェクト（idは不要）
   * @returns {Promise<number>} 追加されたメッセージのID
   */
  async addMessage(message) {
    return this._execute('messages', 'readwrite', store => store.add(message));
  }

  /**
   * すべてのメッセージを取得する
   * @returns {Promise<Message[]>} メッセージの配列
   */
  async getAllMessages() {
    return this._execute('messages', 'readonly', store => store.getAll());
  }

  /**
   * 指定したIDのメッセージを削除する
   * @param {number} id - 削除するメッセージのID
   * @returns {Promise<void>}
   */
  async deleteMessage(id) {
    return this._execute('messages', 'readwrite', store => store.delete(id));
  }

  /**
   * すべてのメッセージを削除する
   * @returns {Promise<void>}
   */
  async clearMessages() {
    return this._execute('messages', 'readwrite', store => store.clear());
  }


  // --- Clients ---

  /**
   * 新しいクライアントを追加する
   * @param {Client} client - 追加するクライアントオブジェクト
   * @returns {Promise<string>} 追加されたクライアントのID
   */
  async addClient(client) {
    return this._execute('clients', 'readwrite', store => store.add(client));
  }

  /**
   * すべてのクライアントを取得する
   * @returns {Promise<Client[]>} クライアントの配列
   */
  async getAllClients() {
    return this._execute('clients', 'readonly', store => store.getAll());
  }

  /**
   * 指定したIDのクライアントを削除する
   * @param {string} id - 削除するクライアントのID
   * @returns {Promise<void>}
   */
  async deleteClient(id) {
    return this._execute('clients', 'readwrite', store => store.delete(id));
  }

  /**
   * すべてのクライアントを削除する
   * @returns {Promise<void>}
   */
  async clearClients() {
    return this._execute('clients', 'readwrite', store => store.clear());
  }
}

export default WebChatDB;