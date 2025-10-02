import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import ChatLayoutView from '@/views/ChatLayoutView.vue';
import ChatPlainView from '@/views/ChatPlainView.vue';
import ChatSecureView from '@/views/ChatSecureView.vue';
import ConnectView from '@/views/ConnectView.vue';

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
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
