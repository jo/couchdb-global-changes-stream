module.exports = function checkpointer (couch, options) {
  options = options || {}
  options.scope = options.scope || ''

  var checkpoints = {}
  var id = '_local/global-changes-stream' + options.scope

  function getCheckpoint (name, callback) {
    couch.use(name).get(id, function (_, checkpoint) {
      checkpoints[name] = checkpoint || {
        _id: id,
        seq: 0
      }

      callback(checkpoints[name].seq)
    })
  }

  function storeCheckpoint (name, seq, callback) {
    couch.use(name).insert(checkpoints[name], function (_, response) {
      if (response) checkpoints[name]._rev = response.rev

      callback()
    })
  }

  return {
    get: function (name, callback) {
      if (options.persist) return getCheckpoint(name, callback)

      checkpoints[name] = checkpoints[name] || { seq: 0 }

      callback(checkpoints[name].seq)
    },
    set: function (name, seq, callback) {
      if (checkpoints[name].seq === seq) return callback()

      checkpoints[name].seq = seq

      options.persist ? storeCheckpoint(name, seq, callback) : callback()
    }
  }
}
