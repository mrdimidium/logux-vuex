var CrossTabClient = require('logux-client/cross-tab-client')
var Store = require('vuex').Store

function createLoguxStore (config) {
  if (!config) {
    config = {}
  }

  var client = new CrossTabClient(config)

  function LoguxStore (options) {
    Store.call(this, options)

    this.client = client
    this.log = client.log
  }

  LoguxStore.prototype = Object.create(Store.prototype)

  LoguxStore.prototype.constructor = LoguxStore

  return LoguxStore
}

module.exports = createLoguxStore
