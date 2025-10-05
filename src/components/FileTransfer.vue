<template>
  <div class="file-transfer-overlay">
    <div class="file-transfer-box">
      <h2>ファイルを送信</h2>
      <div class="file-drop-zone" @dragover.prevent @drop.prevent="onFileDrop">
        <input type="file" ref="fileInput" @change="onFileSelect" style="display: none;" />
        <p v-if="!selectedFile">ファイルをここにドラッグ＆ドロップするか、<button @click="openFilePicker">ファイルを選択</button></p>
        <div v-else class="file-info">
          <p>ファイル名: {{ selectedFile.name }}</p>
          <p>サイズ: {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</p>
        </div>
      </div>
      <div class="dialog-buttons">
        <button @click="$emit('close')" class="dialog-button cancel">キャンセル</button>
        <button @click="sendFile" class="dialog-button confirm" :disabled="!selectedFile">送信</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileTransfer',
  emits: ['send-file', 'close'],
  data() {
    return {
      selectedFile: null,
    };
  },
  methods: {
    openFilePicker() {
      this.$refs.fileInput.click();
    },
    onFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.selectedFile = file;
      }
    },
    onFileDrop(event) {
      const file = event.dataTransfer.files[0];
      if (file) {
        this.selectedFile = file;
      }
    },
    sendFile() {
      if (this.selectedFile) {
        this.$emit('send-file', this.selectedFile);
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.file-transfer-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex; justify-content: center; align-items: center; z-index: 1000;
}
.file-transfer-box {
  background-color: white; padding: 24px; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 400px; max-width: 90%; text-align: center;
}
.file-drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px 20px;
  margin: 20px 0;
  cursor: pointer;
  transition: background-color 0.2s;
  &:hover {
    background-color: #f9f9f9;
  }
}
.file-info p {
  margin: 5px 0;
}
.dialog-buttons {
  display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;
}
.dialog-button {
  border: none; border-radius: 4px; padding: 8px 16px;
  font-size: 14px; cursor: pointer; transition: background-color 0.2s;
}
.dialog-button.cancel { background-color: #f0f0f0; color: #333; }
.dialog-button.cancel:hover { background-color: #e0e0e0; }
.dialog-button.confirm { background-color: #007bff; color: white; }
.dialog-button.confirm:hover { background-color: #0056b3; }
.dialog-button:disabled { background-color: #a0c3e6; cursor: not-allowed; }
</style>
