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
See also [basic usage example](https://github.com/nikolay-govorov/logux-vuex-example) and [Logux Status] for UX best practices.

[Logux Status]: https://github.com/logux/logux-status

## Commit

Instead of Vuex, in Logux Vuex you have 4 ways to commit action:

* `store.commit(action)` is legacy API. Try to avoid it since you can’t
  specify how clean this actions.
* `store.commit.local(action, meta)` — action will be visible only to current
  browser tab.
* `store.commit.crossTab(action, meta)` — action will be visible
  to all browser tab.
* `store.commit.sync(action, meta)` — action will be visible to server
  and all browser tabs.

In all 3 new commit methods you must to specify `meta.reasons` with array
of “reasons”. It is code names of reasons, why this action should be still
in the log.

```js
store.commit.crossTab(
  { type: 'CHANGE_NAME', name }, { reasons: ['lastName'] }
)
```

When you don’t need some actions, you can remove reasons from them:

```js
store.commit.crossTab(
  { type: 'CHANGE_NAME', name }, { reasons: ['lastName'] }
).then(meta => {
  store.log.removeReason('lastName', { maxAdded: meta.added - 1 })
})
```

Action with empty reasons will be removed from log.
