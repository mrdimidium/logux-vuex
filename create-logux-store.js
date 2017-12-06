var CrossTabClient = require('logux-client/cross-tab-client')
var Store = require('vuex').Store

function createLoguxStore (config) {
  if (!config) {
    config = {}
  }

  // eslint-disable-next-line no-unused-vars
  var dispatchHistory = config.dispatchHistory || 1000
  delete config.dispatchHistory

  // eslint-disable-next-line no-unused-vars
  var saveStateEvery = config.saveStateEvery || 50
  delete config.saveStateEvery

  // eslint-disable-next-line no-unused-vars
  var onMissedHistory = config.onMissedHistory
  delete config.onMissedHistory

  var client = new CrossTabClient(config)

  function LoguxStore (options) {
    var self = this

    Store.call(self, options)

    this.client = client
    this.log = this.client.log

    this.commit = function commit (action) {
      var meta = {
        id: this.log.generateId(),
        tab: this.client.id,
        reasons: ['tab' + this.client.id],
        dispatch: true
      }

      this.log.add(action, meta)

      originalCommit.call(this, action)
    }

    function originalCommit (action) {
      Store.prototype.commit.call(self, action)
    }

    var lastAdded = 0
    var dispatchCalls = 0
    this.client.on('add', function (action, meta) {
      if (meta.added > lastAdded) lastAdded = meta.added

      if (meta.dispatch) {
        dispatchCalls += 1

        if (lastAdded > dispatchHistory && dispatchCalls % 25 === 0) {
          self.log.removeReason('tab' + self.client.id, {
            maxAdded: lastAdded - dispatchHistory
          })
        }

        return
      }

      originalCommit.call(self, action.type)
    })

    this.client.on('clean', function () {})

    this.client.sync.on('state', function () {})
  }

  LoguxStore.prototype = Object.create(Store.prototype)

  LoguxStore.prototype.constructor = LoguxStore

  return LoguxStore
}

module.exports = createLoguxStore
