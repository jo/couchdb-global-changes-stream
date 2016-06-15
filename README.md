# couchdb-global-changes-stream
Multiplexed persisted global couchdb changes stream across all databases.

## API
```js
var feed = require('couchdb-global-changes-stream')

feed('http://localhost:5984')
  .pipe(process.stdout)
```

## CLI
```sh
couchdb-global-changes-stream http://localhost:5984
```

## Test
```sh
npm test
```

## License
Apache 2.0  
(c) 2016 Johannes J. Schmidt, TF
