import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import ConnectView from '@/views/ConnectView.vue';
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
    path: '/chat',
    name: 'Chat',
    component: ChatView,
  },
]

const router = createRouter({
  history: createWebHistory('/app/'),
  routes,
});

export default router;