# Logux Vuex

<img align="right" width="95" height="95" title="Logux logo"
     src="https://cdn.rawgit.com/logux/logux/master/logo.svg">

Logux is a client-server communication protocol. It synchronizes action
between clients and server logs.

This library provides Vuex compatible API.

## Install

```sh
npm i --save nikolay-govorov/logux-vuex
```

## Usage

Create Vuex store by `createLoguxStore`. It returns original Vuex store `Vuex.Store` function with Logux inside

```diff
import Vue from 'vue';
import Vuex from 'vuex';

+import createLoguxStore from 'logux-vuex/create-logux-store';

Vue.use(Vuex);

-const Store = Vuex.Store;
+const Store = createLoguxStore({
+  subprotocol: '1.0.0',
+  server: 'wss://localhost:1337',
+  userId: 10
+});

const store = new Store({
  state: {
    count: 0
  },
  mutations: {
    increment(state) {
      state.count++
    }
  }
})

+store.client.start()
```

See also [Logux Status] for UX best practices.

[Logux Status]: https://github.com/logux/logux-status
