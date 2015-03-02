#  [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-url]][daviddm-image]

> An IBM Connections Profiles API Wrapper, using the oniyi-request package for http and caching


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
[travis-url]: https://travis-ci.org/benkroeger/ibm-connections-profiles
[travis-image]: https://travis-ci.org/benkroeger/ibm-connections-profiles.svg?branch=master
[daviddm-url]: https://david-dm.org/benkroeger/ibm-connections-profiles.svg?theme=shields.io
[daviddm-image]: https://david-dm.org/benkroeger/ibm-connections-profiles
