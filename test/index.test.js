var createLoguxStore = require('../create-logux-store')
var index = require('../')

it('has createLoguxCreator function', function () {
  expect(index.createLoguxStore).toBe(createLoguxStore)
})
