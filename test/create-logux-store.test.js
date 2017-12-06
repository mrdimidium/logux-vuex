var Vue = require('vue')
var Vuex = require('vuex')

var TestPair = require('logux-sync').TestPair
var TestTime = require('logux-core').TestTime

Vue.use(Vuex)

var createLoguxStore = require('../create-logux-store')

function createStore (mutations, opts) {
  if (!opts) opts = { }
  if (!opts.server) opts.server = 'wss://localhost:1337'

  opts.subprotocol = '1.0.0'
  opts.userId = 10
  opts.time = new TestTime()

  var LoguxStore = createLoguxStore(opts)
  var store = new LoguxStore({
    state: { value: 0 },

    mutations: mutations
  })

  var prev = 0
  store.log.generateId = function () {
    prev += 1
    return [prev, store.client.options.userId + ':uuid', 0]
  }

  return store
}

function increment (state) {
  state.value = state.value + 1
}

function historyLine (state, action) {
  state.value = state.value + action.value
}

function actions (log) {
  return log.store.created.map(function (i) {
    return i[0]
  })
}

var originWarn = console.warn
afterEach(function () {
  console.warn = originWarn
})

it('throws error on missed config', function () {
  expect(function () {
    createLoguxStore()
  }).toThrowError('Missed server option in Logux client')
})

it('creates Vuex store', function () {
  var store = createStore({ increment: increment })

  store.commit({
    type: 'increment'
  })

  expect(store.state).toEqual({ value: 1 })
})

it('creates Logux client', function () {
  var store = createStore({ increment: increment })

  expect(store.client.options.subprotocol).toEqual('1.0.0')
})

it('sets tab ID', function () {
  var store = createStore({ increment: increment })

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

it('has shortcut for add', function () {
  var store = createStore({ increment: increment })

  return store.commit.crossTab(
    { type: 'increment' }, { reasons: ['test'] }
  ).then(function () {
    expect(store.state).toEqual({ value: 1 })
    expect(store.log.store.created[0][1].reasons).toEqual(['test'])
  })
})

it('listen for action from other tabs', function () {
  var store = createStore({ increment: increment })

  store.client.emitter.emit('add', { type: 'increment' }, { id: [1, 't', 0] })

  expect(store.state).toEqual({ value: 1 })
})

it('saves previous states', function () {
  var calls = 0

  var store = createStore({
    a: function () {
      calls += 1
    }
  })

  var promise = Promise.resolve()

  for (var i = 0; i < 60; i++) {
    if (i % 2 === 0) {
      promise = promise.then(function () {
        return store.commit.crossTab({ type: 'a' }, { reasons: ['test'] })
      })
    } else {
      store.commit({ type: 'a' })
    }
  }

  return promise.then(function () {
    expect(calls).toEqual(60)
    calls = 0

    return store.commit.crossTab(
      { type: 'a' }, { id: [57, '10:uuid', 1], reasons: ['test'] }
    )
  }).then(function () {
    expect(calls).toEqual(10)
  })
})

it('changes history recording frequency', function () {
  var calls = 0

  var store = createStore({
    a: function () {
      calls += 1
    }
  }, {
    saveStateEvery: 1
  })

  return Promise.all([
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] })
  ]).then(function () {
    calls = 0
    return store.commit.crossTab(
      { type: 'a' }, { id: [3, '10:uuid', 1], reasons: ['test'] })
  }).then(function () {
    expect(calls).toEqual(2)
  })
})

it('cleans its history on removing action', function () {
  var calls = 0
  var store = createStore({
    a: function () {
      calls += 1
    }
  }, {
    saveStateEvery: 2
  })

  return Promise.all([
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab({ type: 'a' }, { reasons: ['test'] })
  ]).then(function () {
    return store.log.changeMeta([5, '10:uuid', 0], { reasons: [] })
  }).then(function () {
    calls = 0
    return store.commit.crossTab(
      { type: 'a' }, { id: [5, '10:uuid', 1], reasons: ['test'] })
  }).then(function () {
    expect(calls).toEqual(3)
  })
})

it('changes history', function () {
  var store = createStore({ historyLine: historyLine })

  return Promise.all([
    store.commit.crossTab(
      { type: 'historyLine', value: 'a' }, { reasons: ['test'] }
    ),
    store.commit.crossTab(
      { type: 'historyLine', value: 'b' }, { reasons: ['test'] }
    )
  ]).then(function () {
    store.commit({ type: 'historyLine', value: 'c' })
    store.commit({ type: 'historyLine', value: 'd' })

    return store.commit.crossTab(
      { type: 'historyLine', value: '|' },
      { id: [2, '10:uuid', 1], reasons: ['test'] }
    )
  }).then(function () {
    expect(store.state.value).toEqual('0ab|cd')
  })
})

it('undoes actions', function () {
  var store = createStore({ historyLine: historyLine })

  return Promise.all([
    store.commit.crossTab(
      { type: 'historyLine', value: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'b' }, { reasons: ['test'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'c' }, { reasons: ['test'] })
  ]).then(function () {
    expect(store.state.value).toEqual('0abc')

    return store.commit.crossTab(
      { type: 'logux/undo', id: [2, '10:uuid', 0] }, { reasons: ['test'] }
    )
  }).then(function () {
    expect(store.state.value).toEqual('0ac')
  })
})

it('warns about undoes cleaned action', function () {
  console.warn = jest.fn()
  var store = createStore({ increment: increment })

  return store.commit.crossTab(
    { type: 'logux/undo', id: [1, 't', 0] }, { reasons: [] }
  ).then(function () {
    expect(console.warn).toHaveBeenCalledWith(
      'Logux can not find [1,"t",0] to undo it. Maybe action was cleaned.'
    )
  })
})

it('replays history since last state', function () {
  var onMissedHistory = jest.fn()

  var store = createStore({ historyLine: historyLine }, {
    onMissedHistory: onMissedHistory,
    saveStateEvery: 2
  })

  return Promise.all([
    store.commit.crossTab(
      { type: 'historyLine', value: 'a' }, { reasons: ['one'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'b' }, { reasons: ['test'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'c' }, { reasons: ['test'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'd' }, { reasons: ['test'] })
  ]).then(function () {
    return store.log.removeReason('one')
  }).then(function () {
    return store.commit.crossTab(
      { type: 'historyLine', value: '|' },
      { id: [1, '10:uuid', 0], reasons: ['test'] }
    )
  }).then(function () {
    expect(onMissedHistory)
      .toHaveBeenCalledWith({ type: 'historyLine', value: '|' })
    expect(store.state.value).toEqual('0abc|d')
  })
})

it('replays history for reason-less action', function () {
  var store = createStore({ historyLine: historyLine })

  return Promise.all([
    store.commit.crossTab(
      { type: 'historyLine', value: 'a' }, { reasons: ['test'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'b' }, { reasons: ['test'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'c' }, { reasons: ['test'] })
  ]).then(function () {
    return store.commit.crossTab(
      { type: 'historyLine', value: '|' }, { id: [1, '10:uuid', 1] }
    )
  }).then(function () {
    return Promise.resolve()
  }).then(function () {
    expect(store.state.value).toEqual('0a|bc')
    expect(store.log.store.created).toHaveLength(3)
  })
})

it('replays actions before staring since initial state', function () {
  var onMissedHistory = jest.fn()
  var store = createStore({ historyLine: historyLine }, {
    onMissedHistory: onMissedHistory,
    saveStateEvery: 2
  })

  return Promise.all([
    store.commit.crossTab(
      { type: 'historyLine', value: 'b' }, { reasons: ['test'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'c' }, { reasons: ['test'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'd' }, { reasons: ['test'] })
  ]).then(function () {
    return store.commit.crossTab(
      { type: 'historyLine', value: '|' },
      { id: [0, '10:uuid', 0], reasons: ['test'] }
    )
  }).then(function () {
    expect(store.state.value).toEqual('0|bcd')
  })
})

it('replays actions on missed history', function () {
  var onMissedHistory = jest.fn()

  var store = createStore({ historyLine: historyLine }, {
    onMissedHistory: onMissedHistory
  })

  return Promise.all([
    store.commit.crossTab(
      { type: 'historyLine', value: 'a' }, { reasons: ['one'] }),
    store.commit.crossTab(
      { type: 'historyLine', value: 'b' }, { reasons: ['test'] })
  ]).then(function () {
    return store.log.removeReason('one')
  }).then(function () {
    return store.commit.crossTab(
      { type: 'historyLine', value: '|' },
      { id: [0, '10:uuid', 0], reasons: ['test'] }
    )
  }).then(function () {
    expect(onMissedHistory)
      .toHaveBeenCalledWith({ type: 'historyLine', value: '|' })
    expect(store.state.value).toEqual('0|b')
  })
})

it('does not fall on missed onMissedHistory', function () {
  var store = createStore({ historyLine: historyLine })

  return Promise.all([
    store.commit.crossTab(
      { type: 'historyLine', value: 'a' }, { reasons: ['first'] })
  ]).then(function () {
    return store.log.removeReason('first')
  }).then(function () {
    return store.commit.crossTab(
      { type: 'historyLine', value: '|' },
      { id: [0, '10:uuid', 0], reasons: ['test'] }
    )
  }).then(function () {
    expect(store.state.value).toEqual('0|')
  })
})

it('cleans action added by commit', function () {
// TODO: fix commitHistory

//   var store = createStore({ historyLine: historyLine }, {
//     commitHistory: 3
//   })

//   function add (index) {
//     return function () {
//       store.commit({ type: 'historyLine', value: index })
//     }
//   }

//   var promise = Promise.resolve()
//   for (var i = 1; i <= 25; i++) {
//     promise = promise.then(add(i))
//   }

//   return promise.then(function () {
//     expect(actions(store.log)).toEqual([
//       { type: 'historyLine', value: 25 },
//       { type: 'historyLine', value: 24 },
//       { type: 'historyLine', value: 23 }
//     ])
//   })
})

it('cleans last 1000 by default', function () {
  var store = createStore({ increment: increment })

  var promise = Promise.resolve()

  for (var i = 0; i < 1050; i++) {
    promise = promise.then(function () {
      store.commit({ type: 'increment' })
    })
  }

  return promise.then(function () {
    expect(actions(store.log)).toHaveLength(1000)
  })
})

it('copies reasons to undo action', function () {
  var store = createStore({ increment: increment })

  return store.commit.crossTab(
    { type: 'increment' }, { reasons: ['a', 'b'] }
  ).then(function () {
    return store.commit.crossTab(
      { type: 'logux/undo', id: [1, '10:uuid', 0] }, { reasons: [] })
  }).then(function () {
    return store.log.byId([2, '10:uuid', 0])
  }).then(function (result) {
    expect(result[0].type).toEqual('logux/undo')
    expect(result[1].reasons).toEqual(['a', 'b'])
  })
})

it('does not override undo action reasons', function () {
  var store = createStore({ increment: increment })

  return store.commit.crossTab(
    { type: 'increment' }, { reasons: ['a', 'b'] }
  ).then(function () {
    return store.commit.crossTab(
      { type: 'logux/undo', id: [1, '10:uuid', 0] },
      { reasons: ['c'] }
    )
  }).then(function () {
    return store.log.byId([2, '10:uuid', 0])
  }).then(function (result) {
    expect(result[0].type).toEqual('logux/undo')
    expect(result[1].reasons).toEqual(['c'])
  })
})

it('commites local actions', function () {
  var store = createStore({ increment: increment })

  return store.commit.local(
    { type: 'increment' }, { reasons: ['test'] }
  ).then(function () {
    expect(store.log.store.created[0][0]).toEqual({ type: 'increment' })
    expect(store.log.store.created[0][1].tab).toEqual(store.client.id)
    expect(store.log.store.created[0][1].reasons).toEqual(['test'])
  })
})

it('commites sync actions', function () {
  var store = createStore({ increment: increment })

  return store.commit.sync(
    { type: 'increment' }, { reasons: ['test'] }
  ).then(function () {
    var log = store.log.store.created

    expect(log[0][0]).toEqual({ type: 'increment' })
    expect(log[0][1].sync).toBeTruthy()
    expect(log[0][1].reasons).toEqual(['test', 'waitForSync'])
  })
})

it('cleans sync action after synchronization', function () {
  var pair = new TestPair()
  var store = createStore({ increment: increment }, { server: pair.left })

  store.client.start()
  return pair.wait('left').then(function () {
    var protocol = store.client.sync.localProtocol
    pair.right.send(['connected', protocol, 'server', [0, 0]])
    return store.client.sync.waitFor('synchronized')
  }).then(function () {
    store.commit.sync({ type: 'increment' })
    return pair.wait('right')
  }).then(function () {
    expect(actions(store.log)).toEqual([{ type: 'increment' }])
    pair.right.send(['synced', 1])
    return store.client.sync.waitFor('synchronized')
  }).then(function () {
    return Promise.resolve()
  }).then(function () {
    expect(actions(store.log)).toEqual([])
  })
})

it('applies old actions from store', function () {
  var store1 = createStore({ historyLine: historyLine })
  var store2

  return Promise.all([
    store1.commit.crossTab(
      { type: 'historyLine', value: '1' },
      { id: [0, '10:x', 1], reasons: ['test'] }
    ),
    store1.commit.crossTab(
      { type: 'historyLine', value: '2' },
      { id: [0, '10:x', 2], reasons: ['test'] }
    ),
    store1.commit.crossTab(
      { type: 'historyLine', value: '3' },
      { id: [0, '10:x', 3], reasons: ['test'] }
    ),
    store1.commit.crossTab(
      { type: 'historyLine', value: '4' },
      { id: [0, '10:x', 4], reasons: ['test'] }
    ),
    store1.log.add(
      { type: 'historyLine', value: '5' },
      { id: [0, '10:x', 5], reasons: ['test'], tab: store1.client.id }
    ),
    store1.commit.crossTab(
      { type: 'logux/undo', id: [0, '10:x', 2] },
      { id: [0, '10:x', 6], reasons: ['test'] }
    )
  ]).then(function () {
    store2 = createStore(
      { historyLine: historyLine }, { store: store1.log.store })

    store2.commit({ type: 'historyLine', value: 'a' })
    store2.commit.crossTab(
      { type: 'historyLine', value: 'b' }, { reasons: ['test'] }
    )
    expect(store2.state.value).toEqual('0a')

    return store2.initialize
  }).then(function () {
    expect(store2.state.value).toEqual('0134ab')
  })
})
