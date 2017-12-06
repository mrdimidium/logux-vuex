var Vue = require('vue')
var Vuex = require('vuex')
var TestTime = require('logux-core').TestTime

Vue.use(Vuex)

var createLoguxStore = require('../create-logux-store')

function createStore (config, opts) {
  if (!opts) opts = { }
  if (!opts.server) opts.server = 'wss://localhost:1337'

  opts.subprotocol = '1.0.0'
  opts.userId = 10
  opts.time = new TestTime()

  var LoguxStore = createLoguxStore(opts)

  return new LoguxStore(Object.assign({}, config))
}

function getVuexConfig () {
  return {
    state: {
      value: 0
    },

    mutations: {
      increment: function (state) {
        state.value++
      }
    }
  }
}

it('throws error on missed config', function () {
  expect(function () {
    createLoguxStore()
  }).toThrowError('Missed server option in Logux client')
})

it('creates Vuex store', function () {
  var store = createStore(getVuexConfig())

  store.commit({
    type: 'increment'
  })

  expect(store.state).toEqual({ value: 1 })
})

it('creates Logux client', function () {
  var store = createStore(getVuexConfig())

  expect(store.client.options.subprotocol).toEqual('1.0.0')
})

it('sets tab ID', function () {
  var store = createStore(getVuexConfig())

  return new Promise(function (resolve) {
    store.log.on('add', function (action, meta) {
      expect(meta.tab).toEqual(store.client.id)
      expect(meta.reasons).toEqual(['tab' + store.client.id])

      resolve()
    })

    store.commit({
      type: 'increment'
    })
  })
})
