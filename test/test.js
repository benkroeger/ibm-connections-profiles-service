/*global describe, it */
'use strict';
var assert = require('assert');
var IbmConnectionsProfiles = require('../');


var profilesService = new IbmConnectionsProfiles('https://singapptest1.ibm-sba.com/profiles', {
	requestOptions: {
		auth: {
			username: 'fadams',
			password: process.env.password
		}
	}
});

profilesService.getEntry({
	email: 'fadams@greenwell.com'
}).then(function(entry){
	// console.log(entry);

	entry.jobResp = 'Baumeister2';
	return profilesService.updateEntry({
		entry: entry
	});
})
.done(function(result){
	console.log(result);
}, function(reason){
	console.log(reason);
	console.log(reason.stack);
});