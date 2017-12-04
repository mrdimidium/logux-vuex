var CrossTabClient = require('logux-client/cross-tab-client')
var Store = require('vuex').Store

function createLoguxCreator (config) {
  if (!config) {
    config = {}
  }

  var client = new CrossTabClient(config)
  var log = client.log

  return function createLoguxStore (options) {
    var store = new Store(options)

    store.client = client
    store.log = log

    return store
  }
}

module.exports = createLoguxCreator
