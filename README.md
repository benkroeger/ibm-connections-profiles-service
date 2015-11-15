#  [![NPM version][npm-image]][npm-url]

> An IBM Connections Profiles API Wrapper, using the oniyi-http-client package for http abstraction


## Install

```sh
$ npm install --save ibm-connections-profiles-service
```


## Usage

```js
var IbmConnectionsProfilesService = require('ibm-connections-profiles-service');

var profiles = new IbmConnectionsProfilesService('http://my-server.example.com/profiles');

var options = {} // request options --> use to set options for oniyi-http-client's request

profiles.getEntry({email: 'fritz@brause.de'}, options, function(err, profileEntry){
  console.log(profileEntry);
});

```

## Breaking change in 1.0.0
- no promises anymore, all is with callbacks

## License

MIT © [Benjamin Kroeger]()