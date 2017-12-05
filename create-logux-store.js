var CrossTabClient = require('logux-client/cross-tab-client')
var Store = require('vuex').Store

function createLoguxStore (config) {
  if (!config) {
    config = {}
  }

  var client = new CrossTabClient(config)
  var log = client.log

  function LoguxStore (options) {
    Store.call(this, options)

    this.client = client
    this.log = client.log
  }

  LoguxStore.prototype = Object.create(Store.prototype)

  LoguxStore.prototype.constructor = LoguxStore

  LoguxStore.prototype.commit.local = commit.bind(LoguxStore, ['local'])

  LoguxStore.prototype.commit.crossTab = commit.bind(LoguxStore, ['crossTab'])

  LoguxStore.prototype.commit.sync = commit.bind(LoguxStore, ['sync'])

  log.on('preadd', function () {})

  log.on('add', function () {})

  client.on('add', function () {})

  client.on('clean', function () {})

  client.sync.on('state', function () {})

  function commit (type, mutationName, meta) {
    if (!meta) meta = {}
    if (!meta.reasons) meta.reasons = []

    switch (type) {
      case 'local': {
        meta.tab = client.id

        break
      }
      case 'sync': {
        meta.sync = true
        meta.reasons.push('waitForSync')

        break
      }
    }

    log.add(mutationName, meta)
  }

  return LoguxStore
}

module.exports = createLoguxStore
