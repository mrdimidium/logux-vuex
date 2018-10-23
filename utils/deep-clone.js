module.exports = function clone (element) {
  // "string", number, boolean
  if (typeof element !== 'object') {
    return element
  }

  if (!element) {
    return element
  }

  if (Array.isArray(element)) {
    return element.map(clone)
  }

  return Object.keys(element).reduce(function (all, key) {
    all[key] = clone(element[key])

    return all
  }, {})
}
