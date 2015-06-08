#  [![NPM version][npm-image]][npm-url]

> An IBM Connections Profiles API Wrapper, using the oniyi-http-client package for http abstraction


## Install

```sh
$ npm install --save ibm-connections-profiles-service
```


## Usage

```js
var IbmConnectionsProfilesService = require('ibm-connections-profiles-service');

var profiles = new IbmConnectionsProfilesService();

profiles.getEntry({email: 'fritz@brause.de'}).then(function(profileEntry){
	console.log(profileEntry);
});

```


## License

MIT © [Benjamin Kroeger]()


[npm-url]: https://npmjs.org/package/ibm-connections-profiles
[npm-image]: https://badge.fury.io/js/ibm-connections-profiles.svg
