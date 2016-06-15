module.exports = function checkpointer (couch) {
  var checkpoints = {}
  var id = '_local/global-changes-stream'

  return {
    get: function (name, callback) {
      couch.use(name).get(id, function (_, checkpoint) {
        checkpoints[name] = checkpoint || {
          _id: id,
          seq: 0
        }

        callback(checkpoints[name].seq)
      })
    },
    set: function (name, seq, callback) {
      if (checkpoints[name].seq === seq) return callback()

      checkpoints[name].seq = seq
      couch.use(name).insert(checkpoints[name], function (_, response) {
        if (response) checkpoints[name]._rev = response.rev

        callback()
      })
    }
  }
}
