import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import ConnectView from '@/views/ConnectView.vue';
import ReceptionView from '@/views/ReceptionView.vue';
import KeyExchangeView from '@/views/KeyExchangeView.vue';
import OptionExchangeView from '@/views/OptionExchangeView.vue';
import FileView from '@/views/FileView.vue';
import ChatView from '@/views/ChatView.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
  },
  {
    path: '/connect',
    name: 'Connect',
    component: ConnectView,
  },
  {
    path: '/reception',
    name: 'Reception',
    component: ReceptionView,
  },
  {
    path: '/key-exchange',
    name: 'KeyExchange',
    component: KeyExchangeView,
  },
  {
    path: '/option-exchange',
    name: 'OptionExchange',
    component: OptionExchangeView,
  },
  {
    path: '/chat',
    name: 'Chat',
    component: ChatView,
  },
  {
    path: '/file',
    name: 'File',
    component: FileView,
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
