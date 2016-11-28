var _ = require('highland')
var JSONStream = require('JSONStream')
var request = require('request')


function isNotEmptyLine (line) {
  return line
}

function parseJSON (line) {
  var json = {}
  try {
    json = JSON.parse(line)
  } catch (e) {}
  return json
}

function isValid (change) {
  return 'db_name' in change
}

function isUpdate (change) {
  return 'type' in change && change.type === 'updated'
}

function isNoSystemDb (change) {
  return change.db_name.slice(0, 1) !== '_'
}

function doCheckpoint (couch, checkpoint, done) {
  if (checkpoint.seq) {
    // console.error('storing checkpoint:', checkpoint.seq)
    couch({
      url: '_global_changes', 
      method: 'post',
      json: true,
      body: checkpoint
    }, function (error, response, body) {
      if (error) return done(error)
      if (body.rev) checkpoint._rev = body.rev
      done()
    })
  } else {
    couch({
      url: '_global_changes/' + encodeURIComponent(checkpoint._id), 
      method: 'get',
      json: true
    }, function (error, response, body) {
      // console.error('got checkpoint:', body)
      if (error) return done(error)
      if (body.seq) checkpoint.seq = body.seq
      if (body._rev) checkpoint._rev = body._rev
      done()
    })
  }
}

function getDbUpdates (couch, options) {
  var checkpoint = {
    _id: '_local/couchdb-global-changes-feed-checkpoint'
  }

  return _(function (push, next) {
    var requestOptions = {
      url: '_db_updates',
      qs: {
        feed: 'continuous',
        timeout: options.timeout,
        limit: 100
      }
    }

    doCheckpoint(couch, checkpoint, function (error) {
      if (error) return push(error)

      if (checkpoint.seq) {
        requestOptions.qs.since = checkpoint.seq
      }

      couch(requestOptions)
        .on('data', push.bind(null, null))
        .on('error', push)
        .on('end', function () {
          // wait a bit for the parse and filter pipeline to finish
          // to ensure `checkpoint.seq` has been set
          setTimeout(next, 10)
        })
    })
  })
  .split()
  .filter(isNotEmptyLine)
  .map(parseJSON)
  .map(function (data) {
    if (data.last_seq) {
      checkpoint.seq = data.last_seq
    }
    return data
  })
  .filter(isValid)
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
  var checkpoints = {}

  return function (update) {
    var requestOptions = {
      url: encodeURIComponent(update.db_name) + '/_changes',
      qs: {
        include_docs: true
      }
    }
    if (update.db_name in checkpoints) {
      requestOptions.qs.since = checkpoints[update.db_name]
    }

    return _.pipeline(
      couch(requestOptions),
      JSONStream.parse('results.*'),
      _.map(function (data) {
        if (data.seq) {
          checkpoints[update.db_name] = data.seq
        }
        return data
      }),
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
