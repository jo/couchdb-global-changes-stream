var _ = require('highland')
var JSONStream = require('JSONStream')
var request = require('request')

function isNotEmptyLine (line) {
  return line
}

function parseJSON (line) {
  return JSON.parse(line)
}

function isUpdate (change) {
  return 'type' in change && change.type === 'updated'
}

function isNoSystemDb (change) {
  return change.db_name.slice(0, 1) !== '_'
}

function getDbUpdates (couch, options) {
  var since

  return _(function (push, next) {
    var requestOptions = {
      url: '_db_updates',
      qs: {
        feed: 'continuous',
        timeout: options.timeout
      }
    }

    if (since) {
      requestOptions.qs.since = since
    }

    couch(requestOptions)
      .on('data', push.bind(null, null))
      .on('error', push)
      .on('end', function () {
        // wait a bit for the parse and filter pipeline to finish
        // to ensure `since` has been set
        setTimeout(next, 100)
      })
  })
  .split()
  .filter(isNotEmptyLine)
  .map(parseJSON)
  .map(function (data) {
    if (data.last_seq) {
      since = data.last_seq
    }
    return data
  })
  .filter(isUpdate)
  .filter(isNoSystemDb)
}

function formatChange (dbname) {
  return function (change) {
    return {
      db_name: dbname,
      change: change
    }
  }
}

function getChanges (couch) {
  return function (update) {
    return _.pipeline(
      couch({
        url: encodeURIComponent(update.db_name) + '/_changes',
        qs: {
          include_docs: true
        }
      }),
      JSONStream.parse('results.*'),
      _.map(formatChange(update.db_name))
    )
  }
}

module.exports = function (url, options) {
  var couch = request.defaults({
    baseUrl: url,
    method: 'get'
  })

  options = options || {}
  // options.timeout = options.timeout || 60000
  options.timeout = options.timeout || 1000

  return _.pipeline(
    getDbUpdates(couch, options),
    _.map(getChanges(couch)),
    _.sequence()
  )
}
