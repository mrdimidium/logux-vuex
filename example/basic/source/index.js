import Vue from 'vue';
import Vuex from 'vuex';
import createLoguxStore from 'logux-vuex/create-logux-store';

import Root from './root.vue';

Vue.use(Vuex);

const Store = createLoguxStore({
  subprotocol: '1.0.0',
  server: 'ws://localhost:1337',
  userId: 10
});

const store = new Store({
  state: {
    count: 0,
  },

  mutations: {
    increment(state) {
      state.count++
    }
  }
});

store.client.start();

const app = new Vue({
  store,

  render: h => h(Root),
});

app.$mount('#root');
