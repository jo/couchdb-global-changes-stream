# couchdb-global-changes-stream
Multiplexed persisted global couchdb changes stream across all databases.

[![Build
Status](https://travis-ci.org/jo/couchdb-view-cache-stream.svg?branch=master)](https://travis-ci.org/jo/couchdb-view-cache-stream)

## API
```js
var feed = require('couchdb-global-changes-stream')

feed().pipe(stringify).pipe(process.stdout)
```

## CLI
```sh
couchdb-global-changes-stream [URL]
```

## Test
```sh
npm test
```

## License
Apache 2.0  
(c) 2016 Johannes J. Schmidt, TF
