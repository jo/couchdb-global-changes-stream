var test = require('tap').test
var nano = require('nano')

var feed = require('.')

var COUCHDB = process.env.COUCHDB || 'http://localhost:5984'
var dbname = 'test-global-changes-stream'
var couch = nano(COUCHDB)

test('existing database and single change', function (t) {
  console.log('start test...')
  couch.db.destroy(dbname, function () {
    console.log('create db...')
    couch.db.create(dbname, function () {
      console.log('start feed...')
      feed(COUCHDB, function (stream) {
        console.log('feed started...')

        stream.on('data', function (change) {
          console.log('on data', change, change.db_name !== dbname)

          if (change.db_name !== dbname) return

          t.equal(change.change.id, 'mydoc')

          console.log('stopping stream...')
          stream.stop()
        })

        stream.on('end', t.end)

        couch.use(dbname).insert({ _id: 'mydoc', foo: 'bar' })
      })
    })
  })
})

// test('newly created database and single change', function (t) {
//   couch.db.destroy(dbname, function () {
//     feed(COUCHDB, function (stream) {
//       stream.on('data', function (change) {
//         if (change.db_name !== dbname) return
//
//         t.equal(change.change.seq, 1)
//         t.equal(change.change.id, 'mydoc')
//
//         stream.stop()
//       })
//
//       stream.on('end', t.end)
//
//       couch.db.create(dbname, function () {
//         couch.use(dbname).insert({ _id: 'mydoc', foo: 'bar' })
//       })
//     })
//   })
// })
