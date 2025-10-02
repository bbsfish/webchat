const ss = {
  set(key, data) {
    window.sessionStorage.setItem(key, JSON.stringify(data));
  },
  get(key) {
    const data = window.sessionStorage.getItem(key);
    return JSON.parse(data);
  },
  remove(key) {
    window.sessionStorage.removeItem(key);
  },
  clear() {
    window.sessionStorage.clear();
  },
}

const ls = {
  set(key, data) {
    window.localStorage.setItem(key, JSON.stringify(data));
  },
  get(key) {
    const data = window.localStorage.getItem(key);
    return JSON.parse(data);
  },
  remove(key) {
    window.localStorage.removeItem(key);
  },
  clear() {
    window.localStorage.clear();
  },
}

export default { ss, ls };
