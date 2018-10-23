var deepClone = require('../deep-clone')

it('Must be return null', function () {
  expect(deepClone(null)).toBe(null)
})

it('Must be return string', function () {
  expect(deepClone('str')).toBe('str')
})

it('Must be deep clone array', function () {
  var a = [3, 4]
  var b = deepClone(a)

  a[0] = 5

  expect(a).toEqual([5, 4])
  expect(b).toEqual([3, 4])
})

it('Must be deep clone object', function () {
  var a = { key: 4 }
  var b = deepClone(a)

  a.key = 5

  expect(a).toEqual({ key: 5 })
  expect(b).toEqual({ key: 4 })
})
