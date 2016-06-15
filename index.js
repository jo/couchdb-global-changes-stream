var nano = require('nano')
var from = require('from')

var checkpointer = require('./lib/checkpointer')

module.exports = function (url, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  options = options || {}

  options.concurrency = options.concurrency || 1
  options.limit = options.limit || 1000
  options.include_docs = options.include_docs || false

  var couch = nano(url)
  var cp = checkpointer(couch)

  // List of dbs to be processed
  // a dbname can occure more than once
  var dbnames = []

  var feed = from(function getChunk (count, next) {
    var dbname = dbnames.shift()

    if (!dbname) {
      feed.pause()
      return true
    }

    cp.get(dbname, function (seq) {
      couch.db
        .changes(dbname, {
          since: seq,
          limit: options.limit,
          include_docs: options.include_docs
        }, function (error, response) {
          if (error) return next()

          if (response.results.length) {
            response.results
              .map(function map (change) {
                return {
                  db_name: dbname,
                  change: change
                }
              })
              .forEach(feed.emit.bind(feed, 'data'))
          }

          cp.set(dbname, response.last_seq, function () {
            if (response.results.length === options.limit) {
              dbnames.push(dbname)

              if (feed.paused) feed.resume()
            }

            next()
          })
        })
    })

    return true
  })

  var dbUpdates = couch.followUpdates({})
  dbUpdates.on('change', function (change) {
    if (change.type === 'deleted') {
      var idx = dbnames.indexOf(change.db_name)
      if (idx > -1) dbnames.splice(idx, 1)
      return
    }

    dbnames.push(change.db_name)

    if (feed.paused) feed.resume()
  })

  feed.stop = function () {
    feed.emit('end')
    dbUpdates.stop()
    console.log('feed stop: emitted end.')
  }

  couch.db.list(function (error, result) {
    if (error) return

    dbnames = dbnames.concat(result)

    if (feed.paused) feed.resume()

    dbUpdates.follow()

    callback(feed)
  })
}
