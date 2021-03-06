var test = require('tap').test
var nano = require('nano')

var feed = require('.')

var COUCHDB = process.env.COUCHDB || 'http://localhost:5984'
var dbname = 'test-global-changes-stream'
var couch = nano(COUCHDB)

test('existing database and single change', function (t) {
  couch.db.destroy(dbname, function () {
    couch.db.create(dbname, function () {
      var stream = feed(COUCHDB, { persist: true })
      stream.on('data', function (change) {
        if (change.db_name !== dbname) return

        if (!change.change) return
        t.equal(change.change.id, 'mydoc')

        stream.stop()
      })

      stream.on('end', t.end)

      couch.use(dbname).insert({ _id: 'mydoc', foo: 'bar' })
    })
  })
})

test('newly created database and single change', function (t) {
  couch.db.destroy(dbname, function () {
    var stream = feed(COUCHDB, { persisted: true })
    stream.on('data', function (change) {
      if (change.db_name !== dbname) return
      if (!change.change) return

      t.equal(change.change.seq, 1)
      t.equal(change.change.id, 'mydoc')

      stream.stop()
    })

    stream.on('end', t.end)

    couch.db.create(dbname, function () {
      couch.use(dbname).insert({ _id: 'mydoc', foo: 'bar' })
    })
  })
})
