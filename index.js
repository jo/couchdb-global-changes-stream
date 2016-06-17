var nano = require('nano')
var Readable = require('stream').Readable

var checkpointer = require('./lib/checkpointer')

module.exports = function (url, options) {
  url = url || 'http://localhost:5984'

  options = options || {}
  options.limit = options.limit || 1
  options.persist = options.persist || false
  options.include_docs = options.include_docs || false

  var stopped = false

  var feed = Readable({ objectMode: true })

  var dbs = Readable({ objectMode: true })
  var dbnames = []
  dbs.on('data', function (db) {
    dbnames.push(db.name)
  })

  var couch = nano(url)
  var cp = checkpointer(couch, {
    persist: options.persist
  })

  dbs._read = function () {}

  function getNextDb (callback) {
    if (dbnames.length) return callback(dbnames.shift())
    dbs.once('data', function (db) {
      getNextDb(callback)
    })
  }

  function getChanges (dbname) {
    cp.get(dbname, function (seq) {
      couch.db
        .changes(dbname, {
          since: seq,
          limit: options.limit,
          include_docs: options.include_docs
        }, function (error, response) {
          if (error) return

          if (response.results.length) {
            response.results
              .map(function map (change) {
                return {
                  db_name: dbname,
                  change: change
                }
              })
              .forEach(function (change) {
                // TODO: stop when push returns false and store the seq then:
                // https://nodejs.org/api/stream.html#stream_class_stream_readable_1
                // read() should continue reading from the resource and pushing
                // data until push returns false, at which point it should stop
                // reading from the resource.
                if (!feed.ended && !stopped) feed.push(change)
              })
          }

          cp.set(dbname, response.last_seq, function () {
            if (response.results.length === options.limit) {
              // same as above
              if (!feed.ended && !stopped) dbs.push({ name: dbname })
            }
            if (!response.results.length) {
              if (!feed.ended && !stopped) feed.push({ db_name: dbname })
              getNextDb(getChanges)
            }
          })
        })
    })
  }

  // improvement: the `size` argument could be handled
  feed._read = function (size) {
    getNextDb(getChanges)
  }

  couch.db.list(function (error, result) {
    if (error) return

    dbs.setMaxListeners(result.length * 2)
    result.forEach(function (name) {
      dbs.push({ name: name })
    })
  })

  var dbUpdates = couch.followUpdates({})
  dbUpdates.on('change', function (change) {
    if (change.type === 'deleted') return

    dbs.push({ name: change.db_name })
  })
  dbUpdates.follow()

  feed.stop = function () {
    if (feed.ended || stopped) return
    stopped = true
    feed.emit('end')
    dbUpdates.stop()
  }

  return feed
}
