#!/usr/bin/env node

var _ = require('highland')
var feed = require('.')

var url = process.argv[2]

function stringify (change) {
  return JSON.stringify(change) + '\n'
}

var pipeline = _.pipeline(
  feed(url),
  _.map(stringify)
)

pipeline.pipe(process.stdout)
