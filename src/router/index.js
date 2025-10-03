import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import ConnectView from '@/views/ConnectView.vue';
import ReceptionView from '@/views/ReceptionView.vue';
import KeyExchangeView from '@/views/KeyExchangeView.vue';
import FileView from '@/views/FileView.vue';
import ChatLayoutView from '@/views/ChatLayoutView.vue';
import ChatPlainView from '@/views/ChatPlainView.vue';
import ChatSecureView from '@/views/ChatSecureView.vue';

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
    path: '/c',
    component: ChatLayoutView,
    children: [
      {
        path: 'plain',
        name: 'ChatPlain',
        component: ChatPlainView,
      },
      {
        path: 'secure',
        name: 'ChatSecure',
        component: ChatSecureView,
      }
    ]
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
