var test = require('tap').test
var nano = require('nano')

var feed = require('.')

var COUCHDB = process.env.COUCHDB || 'http://localhost:5984'
var dbname = 'test-global-changes-stream'
var couch = nano(COUCHDB)

test('existing database and single change', function (t) {
  couch.db.destroy(dbname, function () {
    couch.db.create(dbname, function (error) {
      t.error(error, 'database created')

      feed(COUCHDB, { timeout: 100 })
        .filter(function (change) {
          if (change.db_name !== dbname) return
          if (!change.change) return
          return change.change.id === 'mydoc'
        })
        .head()
        .toArray(function (changes) {
          t.equal(changes[0].change.id, 'mydoc')
          t.end()
        })

      couch.use(dbname).insert({ _id: 'mydoc', foo: 'bar' })
    })
  })
})

test('newly created database and single change', function (t) {
  couch.db.destroy(dbname, function () {
    feed(COUCHDB, { timeout: 100 })
      .filter(function (change) {
        if (change.db_name !== dbname) return
        if (!change.change) return
        return change.change.id === 'mydoc'
      })
      .head()
      .toArray(function (changes) {
        t.equal(changes[0].change.id, 'mydoc')
        t.end()
      })

    couch.db.create(dbname, function () {
      couch.use(dbname).insert({ _id: 'mydoc', foo: 'bar' })
    })
  })
})
