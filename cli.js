#!/usr/bin/env node

var feed = require('.')
var through = require('through')

var url = process.argv[2]

if (!url) {
  console.log('Usage: couchdb-global-changes-stream URL')
  process.exit()
}

var stringify = through(function write (data) {
  this.emit('data', JSON.stringify(data) + '\n')
})

feed(url)
  .pipe(stringify)
  .pipe(process.stdout)
