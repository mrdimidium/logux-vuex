var Store = require('vuex').Store
var isFirstOlder = require('logux-core/is-first-older')
var CrossTabClient = require('logux-client/cross-tab-client')

var deepClone = require('./utils/deep-clone')

function warnBadUndo (id) {
  var json = JSON.stringify(id)

  console.warn(
    'Logux can not find ' + json + ' to undo it. Maybe action was cleaned.'
  )
}

function LoguxState (client, config, vuexConfig) {
  var self = this

  Store.call(this, deepClone(vuexConfig))

  this.client = client
  this.log = client.log

  var init
  var prevMeta
  var replaying
  var wait = {}
  var history = {}
  var actionCount = 0
  var started = (function (now) {
    return { id: now, time: now[0] }
  })(client.log.generateId())

  self.initialize = new Promise(function (resolve) {
    init = resolve
  })

  self.commit = function commit () {
    var action
    var isNoObjectTypeAction

    if (typeof arguments[0] === 'string') {
      var type = arguments[0]
      var options = Array.prototype.slice.call(arguments, 1)
      isNoObjectTypeAction = true

      action = {
        type: type,
        options: options
      }
    } else {
      action = arguments[0]
    }

    var meta = {
      id: client.log.generateId(),
      tab: client.id,
      reasons: ['tab' + client.id],
      dispatch: true
    }

    client.log.add(action, meta)

    prevMeta = meta
    originCommit(action, isNoObjectTypeAction)
    saveHistory(meta)
  }

  self.commit.local = function local (action, meta) {
    meta.tab = client.id
    return client.log.add(action, meta)
  }

  self.commit.crossTab = function crossTab (action, meta) {
    return client.log.add(action, meta)
  }

  self.commit.sync = function sync (action, meta) {
    if (!meta) meta = {}
    if (!meta.reasons) meta.reasons = []

    meta.sync = true
    meta.reasons.push('waitForSync')

    return client.log.add(action, meta)
  }

  client.log.on('preadd', function (action, meta) {
    if (action.type === 'logux/undo' && meta.reasons.length === 0) {
      meta.reasons.push('reasonsLoading')
    }

    if (!isFirstOlder(prevMeta, meta) && meta.reasons.length === 0) {
      meta.reasons.push('replay')
    }
  })

  var lastAdded = 0
  var dispatchCalls = 0
  client.on('add', function (action, meta) {
    if (meta.added > lastAdded) lastAdded = meta.added

    if (meta.dispatch) {
      dispatchCalls += 1

      if (lastAdded > config.dispatchHistory && dispatchCalls % 25 === 0) {
        client.log.removeReason('tab' + client.id, {
          maxAdded: lastAdded - config.dispatchHistory
        })
      }

      return
    }

    process(action, meta, isFirstOlder(meta, started))
  })

  client.on('clean', function (action, meta) {
    var key = meta.id.join('\t')

    delete wait[key]
    delete history[key]
  })

  client.sync.on('state', function () {
    if (client.sync.state === 'synchronized') {
      client.log.removeReason('waitForSync', { maxAdded: client.sync.lastSent })
    }
  })

  var previous = []
  var ignores = {}
  client.log.each(function (action, meta) {
    if (!meta.tab) {
      if (action.type === 'logux/undo') {
        ignores[action.id.join('\t')] = true
      } else if (!ignores[meta.id.join('\t')]) {
        previous.push([action, meta])
      }
    }
  }).then(function () {
    if (previous.length > 0) {
      previous.forEach(function (i) {
        process(i[0], i[1], true)
      })
    }

    init()
  })

  // Functions
  function saveHistory (meta) {
    actionCount += 1

    if (
      config.saveStateEvery === 1 || actionCount % config.saveStateEvery === 1
    ) {
      history[meta.id.join('\t')] = deepClone(self.state)
    }
  }

  function originCommit (action, isNotObjectTypeAction) {
    if (action.type === 'logux/state') {
      self.replaceState(action.state)

      return
    }

    var commitArgs = arguments

    if (isNotObjectTypeAction) {
      commitArgs = [action.type].concat(action.options)
    }

    if (action.type in self._mutations) {
      Store.prototype.commit.apply(self, commitArgs)
    }
  }

  function replaceState (state, actions) {
    var newState = actions.reduceRight(function (prev, i) {
      var changed = deepClone(prev)

      if (vuexConfig.mutations[i[0].type]) {
        vuexConfig.mutations[i[0].type](changed, i[0])
      }

      if (history[i[1]]) history[i[1]] = changed

      return changed
    }, state)

    originCommit({ type: 'logux/state', state: newState })
  }

  function replay (actionId, replayIsSafe) {
    var until = actionId.join('\t')

    var ignore = {}
    var actions = []
    var replayed = false
    var newAction
    var collecting = true

    replaying = new Promise(function (resolve) {
      client.log.each(function (action, meta) {
        if (meta.tab && meta.tab !== client.id) return true

        var id = meta.id.join('\t')

        if (collecting || !history[id]) {
          if (action.type === 'logux/undo') {
            ignore[action.id.join('\t')] = true
            return true
          }

          if (!ignore[id]) actions.push([action, id])
          if (id === until) {
            newAction = action
            collecting = false
          }

          return true
        } else {
          replayed = true
          replaceState(history[id], actions)

          return false
        }
      }).then(function () {
        if (!replayed) {
          if (config.onMissedHistory) config.onMissedHistory(newAction)

          var full
          if (replayIsSafe) {
            full = actions
          } else {
            full = actions.slice(0)
            while (actions.length > 0) {
              var last = actions[actions.length - 1]
              actions.pop()
              if (history[last[1]]) {
                replayed = true
                replaceState(history[last[1]], actions.concat([
                  [newAction, until]
                ]))
                break
              }
            }
          }

          if (!replayed) {
            replaceState(deepClone(vuexConfig.state), full)
          }
        }

        replaying = false
        resolve()
      })
    })

    return replaying
  }

  function process (action, meta, replayIsSafe) {
    if (replaying) {
      var key = meta.id.join('\t')
      wait[key] = true

      replaying.then(function () {
        if (wait[key]) {
          process(action, meta, replayIsSafe)

          delete wait[key]
        }
      })

      return
    }

    if (action.type === 'logux/undo') {
      var reasons = meta.reasons
      client.log.byId(action.id).then(function (result) {
        if (result[0]) {
          if (reasons.length === 1 && reasons[0] === 'reasonsLoading') {
            client.log.changeMeta(meta.id, { reasons: result[1].reasons })
          }
          delete history[action.id.join('\t')]
          replay(action.id)
        } else {
          client.log.changeMeta(meta.id, { reasons: [] })
          warnBadUndo(action.id)
        }
      })
    } else if (isFirstOlder(prevMeta, meta)) {
      prevMeta = meta
      originCommit(action)
      if (meta.added) saveHistory(meta)
    } else {
      replay(meta.id, replayIsSafe).then(function () {
        if (meta.reasons.indexOf('replay') !== -1) {
          client.log.changeMeta(meta.id, {
            reasons: meta.reasons.filter(function (i) {
              return i !== 'replay'
            })
          })
        }
      })
    }
  }
}

LoguxState.prototype = Object.create(Store.prototype)

LoguxState.prototype.constructor = LoguxState

function createLoguxState (config) {
  if (!config) config = {}

  var client = new CrossTabClient(config)

  return LoguxState.bind(null, client, {
    dispatchHistory: config.dispatchHistory || 1000,
    saveStateEvery: config.saveStateEvery || 50,
    onMissedHistory: config.onMissedHistory
  })
}

module.exports = createLoguxState
