var Vue = require('vue')
var Vuex = require('vuex')
var TestTime = require('logux-core').TestTime

Vue.use(Vuex)

var createLoguxCreator = require('../create-logux-creator')

function createStore (config, opts) {
  if (!opts) opts = { }
  if (!opts.server) opts.server = 'wss://localhost:1337'

  opts.subprotocol = '1.0.0'
  opts.userId = 10
  opts.time = new TestTime()

  var creator = createLoguxCreator(opts)

  return creator(config)
}

var vuexConfig = {
  state: {
    value: 1
  }
}

it('throws error on missed config', function () {
  expect(function () {
    createLoguxCreator()
  }).toThrowError('Missed server option in Logux client')
})

it('creates Vuex store', function () {
  var store = createStore(vuexConfig)

  expect(store.state).toEqual({ value: 1 })
})

it('creates Logux client', function () {
  var store = createStore(vuexConfig)

  expect(store.client.options.subprotocol).toEqual('1.0.0')
})
