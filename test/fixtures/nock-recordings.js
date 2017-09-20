'use strict';

const nock = require('nock');

/* eslint-disable */

nock('https://apps.na.collabserv.com:443', {"encodedQueryParams":true})
  .get('/profiles/atom/profileService.do')
  .query({"userid":"23176546"})
  .reply(200, "<?xml version=\"1.0\"?><service xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\" xmlns:atom=\"http://www.w3.org/2005/Atom\" xmlns=\"http://www.w3.org/2007/app\"><atom:generator version=\"6.0.0.0\" uri=\"http://www.ibm.com/xmlns/prod/sn\">IBM Connections - Profiles</atom:generator><workspace><atom:title type=\"text\">Albert Energy</atom:title><collection href=\"https://apps.na.collabserv.com/profiles/atom/profile.do?userid=23176546&amp;output=vcard\"><atom:title type=\"text\">Albert Energy</atom:title><snx:userid>23176546</snx:userid><snx:editableFields><snx:editableField name=\"telephoneNumber\"></snx:editableField><snx:editableField name=\"mobileNumber\"></snx:editableField><snx:editableField name=\"phone2\"></snx:editableField><snx:editableField name=\"description\"></snx:editableField><snx:editableField name=\"phone3\"></snx:editableField><snx:editableField name=\"experience\"></snx:editableField><snx:editableField name=\"phone1\"></snx:editableField><snx:editableField name=\"bldgId\"></snx:editableField><snx:editableField name=\"countryCode\"></snx:editableField><snx:editableField name=\"address4\"></snx:editableField><snx:editableField name=\"address3\"></snx:editableField><snx:editableField name=\"address2\"></snx:editableField><snx:editableField name=\"address1\"></snx:editableField><snx:editableField name=\"jobResp\"></snx:editableField><snx:editableField name=\"deptNumber\"></snx:editableField><snx:editableField name=\"profileLinks\"></snx:editableField><snx:editableField name=\"faxNumber\"></snx:editableField><snx:editableField name=\"item2\"></snx:editableField><snx:editableField name=\"item1\"></snx:editableField></snx:editableFields></collection><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileTags.do?targetKey=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/tag-cloud\" type=\"application/atomcat+xml\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/connections/opensocial/rest/activitystreams/@me/@self/@status?rollup=true\" rel=\"http://www.ibm.com/xmlns/prod/sn/status/opensocial\" type=\"application/json\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/connections/opensocial/rest/activitystreams/@me/@all@status\" rel=\"http://www.ibm.com/xmlns/prod/sn/status/opensocial\" type=\"application/json\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/connections.do?connectionType=colleague&amp;key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/connections/colleague\" type=\"application/atom+xml\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/reportingChain.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65\" rel=\"http://www.ibm.com/xmlns/prod/sn/reporting-chain\" type=\"application/atom+xml\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileType.do?type=default\" rel=\"http://www.ibm.com/xmlns/prod/sn/profile-type\" type=\"application/profile-type+xml\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item2&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item2\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item1&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item1\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=address3&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"address3\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=address2&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"address2\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=address1&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"address1\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=phone2&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"phone2\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=phone3&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"phone3\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item10&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item10\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=phone1&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"phone1\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=profileLinks&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/xml\" snx:extensionId=\"profileLinks\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item8&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item8\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item7&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item7\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=address4&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"address4\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item9&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item9\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item4&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item4\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item3&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item3\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item6&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item6\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https://apps.na.collabserv.com/profiles/atom/profileExtension.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;extensionId=item5&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/ext-attr\" type=\"text/plain\" snx:extensionId=\"item5\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"></atom:link><atom:link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fforums%2Fhtml%2Fsearch%3Fuserid%3D23176546%26name%3DAlbert+Energy\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/forums\" type=\"text/html\"></atom:link><atom:link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fblogs%2Froller-ui%2Fallblogs%3Fuserid%3D23176546\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/blogs\" type=\"text/html\"></atom:link><atom:link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Factivities%2Fservice%2Fhtml%2Fmainpage%23dashboard%252Cmyactivities%252Cuserid%253D23176546%252Cname%253DAlbert+Energy\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/activities\" type=\"text/html\"></atom:link><atom:link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fprofiles%2Fhtml%2FsimpleSearch.do%3FsearchFor%3D23176546%26searchBy%3Duserid\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/profiles\" type=\"text/html\"></atom:link><atom:link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Ffiles%2Fapp%2Fperson%2F23176546\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/files\" type=\"text/html\"></atom:link><atom:link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fwikis%2Fhome%2Fsearch%3Fuid%3D23176546%26name%3DAlbert+Energy\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/wikis\" type=\"text/html\"></atom:link><atom:link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fcommunities%2Fservice%2Fhtml%2Fallcommunities%3Fuserid%3D23176546\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/communities\" type=\"text/html\"></atom:link></workspace></service>", [ 'Content-Language',
  'en-US',
  'Content-Type',
  'application/atomsvc+xml; charset=UTF-8',
  'Last-Modified',
  'Thu, 14 Sep 2017 09:32:30 GMT',
  'p3p',
  'CP="NON CUR OTPi OUR NOR UNI"',
  'x-frame-options',
  'SAMEORIGIN',
  'Cache-Control',
  'private, max-age=600, no-cache=set-cookie, private, must-revalidate',
  'Expires',
  'Thu, 01 Dec 1994 16:00:00 GMT',
  'x-lconn-auth',
  'true',
  'x-ua-compatible',
  'IE=edge',
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload',
  'X-Padding',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'X-Content-Type-Options',
  'nosniff',
  'Content-Length',
  '10240',
  'Date',
  'Wed, 20 Sep 2017 13:28:51 GMT',
  'Connection',
  'close']);


nock('https://apps.na.collabserv.com:443', {"encodedQueryParams":true})
  .get('/profiles/atom/connections.do')
  .query({"connectionType":"colleague","outputType":"connection","page":"1","userid":"23176546","output":"vcard","format":"lite","sortBy":"displayName","sortOrder":"asc"})
  .reply(200, "<?xml version=\"1.0\" encoding=\"UTF-8\"?><feed xmlns:app=\"http://www.w3.org/2007/app\" xmlns:thr=\"http://purl.org/syndication/thread/1.0\" xmlns:fh=\"http://purl.org/syndication/history/1.0\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\" xmlns:opensearch=\"http://a9.com/-/spec/opensearch/1.1/\" xmlns=\"http://www.w3.org/2005/Atom\"><id>tag:profiles.ibm.com,2006:feed</id><generator version=\"6.0.0.0\" uri=\"http://www.ibm.com/xmlns/prod/sn\">IBM Connections - Profiles</generator><title type=\"text\">Connections of Albert Energy</title><author><name>IBM Connections - Profiles</name></author><updated>2017-09-20T13:28:51.777Z</updated><opensearch:totalResults>1</opensearch:totalResults><opensearch:startIndex>1</opensearch:startIndex><opensearch:itemsPerPage>10</opensearch:itemsPerPage><link href=\"https://apps.na.collabserv.com/profiles/atom/connections.do?output=vcard&amp;userid=23176546&amp;sortOrder=asc&amp;page=1&amp;format=lite&amp;connectionType=colleague&amp;outputType=connection&amp;sortBy=displayName\" rel=\"self\" type=\"application/atom+xml\"></link><entry><id>tag:profiles.ibm.com,2006:entry125ee794-2689-4092-b572-326c957ec633</id><title type=\"text\">Jack Developer</title><updated>2017-05-15T13:37:45.123Z</updated><category term=\"connection\" scheme=\"http://www.ibm.com/xmlns/prod/sn/type\"></category><category term=\"colleague\" scheme=\"http://www.ibm.com/xmlns/prod/sn/connection/type\"></category><category term=\"accepted\" scheme=\"http://www.ibm.com/xmlns/prod/sn/status\"></category><author><name>Albert Energy</name><snx:userid>23176546</snx:userid><email>albert.energy@gis-demo.com</email><snx:userState>active</snx:userState><snx:isExternal>false</snx:isExternal></author><contributor><name>Jack Developer</name><snx:userid>23176544</snx:userid><email>jack.developer@gis-demo.com</email><snx:userState>active</snx:userState><snx:isExternal>false</snx:isExternal></contributor><snx:connection><contributor snx:rel=\"http://www.ibm.com/xmlns/prod/sn/connection/source\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"><name>Albert Energy</name><snx:userid>23176546</snx:userid><email>albert.energy@gis-demo.com</email><snx:userState>active</snx:userState><snx:isExternal>false</snx:isExternal></contributor><contributor snx:rel=\"http://www.ibm.com/xmlns/prod/sn/connection/target\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"><name>Jack Developer</name><snx:userid>23176544</snx:userid><email>jack.developer@gis-demo.com</email><snx:userState>active</snx:userState><snx:isExternal>false</snx:isExternal></contributor></snx:connection><content type=\"html\"></content><link href=\"https://apps.na.collabserv.com/profiles/atom/connection.do?connectionId=125ee794-2689-4092-b572-326c957ec633\" rel=\"self\" type=\"application/atom+xml\"></link><link href=\"https://apps.na.collabserv.com/profiles/atom/connection.do?connectionId=125ee794-2689-4092-b572-326c957ec633&amp;inclMessage=true\" rel=\"edit\" type=\"application/atom+xml\"></link><summary type=\"text\"></summary></entry></feed>", [ 'Content-Language',
  'en-US',
  'Content-Type',
  'application/atom+xml;charset=UTF-8',
  'Last-Modified',
  'Wed, 20 Sep 2017 13:28:51 GMT',
  'p3p',
  'CP="NON CUR OTPi OUR NOR UNI"',
  'x-frame-options',
  'SAMEORIGIN',
  'Cache-Control',
  'private, max-age=600, no-cache=set-cookie, private, must-revalidate',
  'Expires',
  'Thu, 01 Dec 1994 16:00:00 GMT',
  'x-lconn-auth',
  'true',
  'x-ua-compatible',
  'IE=edge',
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload',
  'X-Padding',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'X-Content-Type-Options',
  'nosniff',
  'Date',
  'Wed, 20 Sep 2017 13:28:51 GMT',
  'Content-Length',
  '2965',
  'Connection',
  'close',
  'Set-Cookie']);


nock('https://apps.na.collabserv.com:443', {"encodedQueryParams":true})
  .get('/profiles/follow/atom/resources')
  .query({"type":"profile","source":"profiles","page":"1"})
  .reply(200, "<?xml version=\"1.0\" encoding=\"UTF-8\"?><feed xmlns=\"http://www.w3.org/2005/Atom\" xmlns:openSearch=\"http://a9.com/-/spec/opensearch/1.1/\"><generator uri=\"http://www.ibm.com/xmlns/prod/sn\" version=\"6.0.0.0\">IBM Connections - Follow service</generator><title type=\"text\">Followed resources for Albert Energy</title><updated>2017-09-20T13:28:51.780Z</updated><id>urn:lsid:ibm.com:follow:feed-com.ibm.lc.f5a8b431-a19b-4524-a107-b3649afd2c48</id><openSearch:itemsPerPage xmlns:openSearch=\"http://a9.com/-/spec/opensearch/1.1/\">20</openSearch:itemsPerPage><openSearch:startIndex xmlns:openSearch=\"http://a9.com/-/spec/opensearch/1.1/\">1</openSearch:startIndex><openSearch:totalResults xmlns:openSearch=\"http://a9.com/-/spec/opensearch/1.1/\">3</openSearch:totalResults><link rel=\"self\" href=\"https://apps.na.collabserv.com/profiles/follow/atom/resources?ps=20&amp;page=1&amp;source=profiles&amp;type=profile\" type=\"application/atom+xml\"></link><link rel=\"alternate\" href=\"https://apps.na.collabserv.com/profiles\" type=\"text/html\"></link><author xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\"><name>Albert Energy</name><snx:userid xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\">23176546</snx:userid><snx:userState xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\">active</snx:userState><email></email><uri>https://apps.na.collabserv.com/profiles/html/profile.do?userid=23176546</uri></author><entry><id>urn:lsid:ibm.com:follow:resource-d8552ca1-873c-4152-96b8-efc88e14ae32</id><category term=\"resource-follow\" scheme=\"http://www.ibm.com/xmlns/prod/sn/type\"></category><category term=\"profiles\" scheme=\"http://www.ibm.com/xmlns/prod/sn/source\"></category><category term=\"profile\" scheme=\"http://www.ibm.com/xmlns/prod/sn/resource-type\"></category><category term=\"23176544\" scheme=\"http://www.ibm.com/xmlns/prod/sn/resource-id\"></category><title type=\"text\">Jack Developer</title><link href=\"https://apps.na.collabserv.com/profiles/follow/atom/resources/d8552ca1-873c-4152-96b8-efc88e14ae32?source=PROFILES&amp;type=PROFILE&amp;resource=23176544\" rel=\"edit\" type=\"application/atom+xml\"></link><link href=\"https://apps.na.collabserv.com/profiles/atom/profile.do?userid=23176544\" rel=\"related\" type=\"application/atom+xml\"></link><link href=\"https://apps.na.collabserv.com/profiles/profiles/view/23176544\" rel=\"alternate\" type=\"text/html\"></link></entry><entry><id>urn:lsid:ibm.com:follow:resource-bf8f2bbd-4525-4151-9d14-cf34492b139b</id><category term=\"resource-follow\" scheme=\"http://www.ibm.com/xmlns/prod/sn/type\"></category><category term=\"profiles\" scheme=\"http://www.ibm.com/xmlns/prod/sn/source\"></category><category term=\"profile\" scheme=\"http://www.ibm.com/xmlns/prod/sn/resource-type\"></category><category term=\"23026382\" scheme=\"http://www.ibm.com/xmlns/prod/sn/resource-id\"></category><title type=\"text\">Alex Olson</title><link href=\"https://apps.na.collabserv.com/profiles/follow/atom/resources/bf8f2bbd-4525-4151-9d14-cf34492b139b?source=PROFILES&amp;type=PROFILE&amp;resource=23026382\" rel=\"edit\" type=\"application/atom+xml\"></link><link href=\"https://apps.na.collabserv.com/profiles/atom/profile.do?userid=23026382\" rel=\"related\" type=\"application/atom+xml\"></link><link href=\"https://apps.na.collabserv.com/profiles/profiles/view/23026382\" rel=\"alternate\" type=\"text/html\"></link></entry><entry><id>urn:lsid:ibm.com:follow:resource-e224443a-ae76-4ed6-8795-644317b4c6e1</id><category term=\"resource-follow\" scheme=\"http://www.ibm.com/xmlns/prod/sn/type\"></category><category term=\"profiles\" scheme=\"http://www.ibm.com/xmlns/prod/sn/source\"></category><category term=\"profile\" scheme=\"http://www.ibm.com/xmlns/prod/sn/resource-type\"></category><category term=\"22842877\" scheme=\"http://www.ibm.com/xmlns/prod/sn/resource-id\"></category><title type=\"text\">Markus Langer</title><link href=\"https://apps.na.collabserv.com/profiles/follow/atom/resources/e224443a-ae76-4ed6-8795-644317b4c6e1?source=PROFILES&amp;type=PROFILE&amp;resource=22842877\" rel=\"edit\" type=\"application/atom+xml\"></link><link href=\"https://apps.na.collabserv.com/profiles/atom/profile.do?userid=22842877\" rel=\"related\" type=\"application/atom+xml\"></link><link href=\"https://apps.na.collabserv.com/profiles/profiles/view/22842877\" rel=\"alternate\" type=\"text/html\"></link></entry></feed>", [ 'Content-Language',
  'en-US',
  'Content-Type',
  'application/atom+xml; charset=UTF-8',
  'p3p',
  'CP="NON CUR OTPi OUR NOR UNI"',
  'x-frame-options',
  'SAMEORIGIN',
  'Cache-Control',
  'no-store, no-cache, must-revalidate, private, must-revalidate',
  'Expires',
  'Thu, 1 Jan 1970 00:00:00 GMT',
  'x-lconn-auth',
  'true',
  'Pragma',
  'no-cache',
  'x-ua-compatible',
  'IE=edge',
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload',
  'X-Padding',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'X-Content-Type-Options',
  'nosniff',
  'Date',
  'Wed, 20 Sep 2017 13:28:51 GMT',
  'Content-Length',
  '4246',
  'Connection',
  'close']);


nock('https://apps.na.collabserv.com:443', {"encodedQueryParams":true})
  .get('/profiles/atom/profileEntry.do')
  .query({"format":"full","output":"vcard","userid":"23176546"})
  .reply(200, "<?xml version=\"1.0\" encoding=\"UTF-8\"?><entry xmlns:app=\"http://www.w3.org/2007/app\" xmlns:thr=\"http://purl.org/syndication/thread/1.0\" xmlns:fh=\"http://purl.org/syndication/history/1.0\" xmlns:snx=\"http://www.ibm.com/xmlns/prod/sn\" xmlns:opensearch=\"http://a9.com/-/spec/opensearch/1.1/\" xmlns=\"http://www.w3.org/2005/Atom\"><id>tag:profiles.ibm.com,2006:entry263d8c21-62e7-43f7-920d-fc95f91ead65</id><title type=\"text\">Albert Energy</title><updated>2017-09-14T09:32:30.813Z</updated><category term=\"profile\" scheme=\"http://www.ibm.com/xmlns/prod/sn/type\"></category><link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fforums%2Fhtml%2Fsearch%3Fuserid%3D23176546%26name%3DAlbert+Energy\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/forums\" type=\"text/html\"></link><link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fblogs%2Froller-ui%2Fallblogs%3Fuserid%3D23176546\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/blogs\" type=\"text/html\"></link><link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Factivities%2Fservice%2Fhtml%2Fmainpage%23dashboard%252Cmyactivities%252Cuserid%253D23176546%252Cname%253DAlbert+Energy\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/activities\" type=\"text/html\"></link><link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fprofiles%2Fhtml%2FsimpleSearch.do%3FsearchFor%3D23176546%26searchBy%3Duserid\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/profiles\" type=\"text/html\"></link><link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Ffiles%2Fapp%2Fperson%2F23176546\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/files\" type=\"text/html\"></link><link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fwikis%2Fhome%2Fsearch%3Fuid%3D23176546%26name%3DAlbert+Energy\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/wikis\" type=\"text/html\"></link><link href=\"https%3A%2F%2Fapps.na.collabserv.com%2Fcommunities%2Fservice%2Fhtml%2Fallcommunities%3Fuserid%3D23176546\" rel=\"http://www.ibm.com/xmlns/prod/sn/service/communities\" type=\"text/html\"></link><contributor><name>Albert Energy</name><snx:userid>23176546</snx:userid><email>albert.energy@gis-demo.com</email><snx:userState>active</snx:userState><snx:isExternal>false</snx:isExternal></contributor><link href=\"https://apps.na.collabserv.com/profiles/atom/profileEntry.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;output=vcard&amp;format=full\" rel=\"self\" type=\"application/atom+xml\"></link><link href=\"https://apps.na.collabserv.com/profiles/atom/profileType.do?type=default\" rel=\"http://www.ibm.com/xmlns/prod/sn/profile-type\" type=\"application/profile-type+xml\"></link><link href=\"https://apps.na.collabserv.com/profiles/html/profileView.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65\" rel=\"related\" type=\"text/html\"></link><link href=\"https://apps.na.collabserv.com/profiles/photo.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/image\" type=\"image\"></link><link href=\"https://apps.na.collabserv.com/profiles/audio.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;lastMod=1505381550813\" rel=\"http://www.ibm.com/xmlns/prod/sn/pronunciation\" type=\"audio\"></link><link href=\"https://apps.na.collabserv.com/profiles/atom/profileEntry.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;output=vcard&amp;format=full\" rel=\"edit\" type=\"application/atom+xml\"></link><summary type=\"text\">Profile information for Albert Energy</summary><content type=\"text\">\nBEGIN:VCARD\nVERSION:2.1\nPHOTO;VALUE=URL:https://apps.na.collabserv.com/profiles/photo.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;lastMod=1505381550813\nN:Energy;Albert\nFN:Albert Energy\nHONORIFIC_PREFIX:\nNICKNAME:\nX_PREFERRED_LAST_NAME:\nX_NATIVE_FIRST_NAME:\nX_NATIVE_LAST_NAME:\nX_ALTERNATE_LAST_NAME:\nURL:https://apps.na.collabserv.com/profiles/atom/profile.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65\nSOUND;VALUE=URL:https://apps.na.collabserv.com/profiles/audio.do?key=263d8c21-62e7-43f7-920d-fc95f91ead65&amp;lastMod=1505381550813\nEMAIL;INTERNET:albert.energy@gis-demo.com\nEMAIL;X_GROUPWARE_MAIL:\nX_BLOG_URL;VALUE=URL:\nTZ:Europe/Berlin\nX_PREFERRED_LANGUAGE:\nORG:\nX_ORGANIZATION_CODE:\nROLE:\nX_EMPTYPE:\nTITLE:theoretical physicist\nX_BUILDING:Building number 12\nX_FLOOR:\nX_OFFICE_NUMBER:\nTEL;WORK:+41500000\nTEL;CELL:+415111111\nTEL;FAX:+415222222\nTEL;X_IP:\nTEL;PAGER:\nX_PAGER_ID:\nX_PAGER_TYPE:\nX_PAGER_PROVIDER:\nCATEGORIES:\nX_EXPERIENCE:&lt;p dir=\"ltr\"&gt;Couple of hundreds &lt;strong&gt;theories&lt;/strong&gt; and &lt;em&gt;published&lt;/em&gt; documents,&lt;/p&gt;\n\n&lt;p dir=\"ltr\"&gt;simple background data.&lt;/p&gt;\nX_DESCRIPTION:&lt;p dir=\"ltr\"&gt;This is some &lt;span style=\"font-size:14px;\"&gt;&lt;strong&gt;about me &lt;/strong&gt;text&lt;strong&gt;.&lt;/strong&gt;&lt;/span&gt;&lt;/p&gt;\nX_MANAGER_UID:\nX_IS_MANAGER:\nX_PROFILE_KEY:263d8c21-62e7-43f7-920d-fc95f91ead65\nUID:23176546\nX_PROFILE_UID:23176546\nX_LCONN_USERID:23176546\nX_EMPLOYEE_NUMBER:\nX_DEPARTMENT_NUMBER:\nX_DEPARTMENT_TITLE:\nX_SHIFT:\nREV:2017-09-14T09:32:30.813Z\nX_PROFILE_TYPE:default\nX_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:item2;VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:no personal number, sorry ladies;VALUE=X_EXTENSION_DATA_TYPE:\nX_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:item1;VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:GIS fake loKation;VALUE=X_EXTENSION_DATA_TYPE:\nX_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:address3;VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:and before that theory of special relativity, for fun;VALUE=X_EXTENSION_DATA_TYPE:\nX_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:address2;VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:Created something simple as theory of general relativity;VALUE=X_EXTENSION_DATA_TYPE:\nX_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:address1;VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:My fake address 12;VALUE=X_EXTENSION_DATA_TYPE:\nX_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:phone2;VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:+415444444 cell;VALUE=X_EXTENSION_DATA_TYPE:\nX_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:phone3;VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:+415555555 home;VALUE=X_EXTENSION_DATA_TYPE:\nX_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:phone1;VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:+41533333 work;VALUE=X_EXTENSION_DATA_TYPE:\nX_EXTENSION_PROPERTY;VALUE=X_EXTENSION_PROPERTY_ID:address4;VALUE=X_EXTENSION_KEY:;VALUE=X_EXTENSION_VALUE:testing last information;VALUE=X_EXTENSION_DATA_TYPE:\nEND:VCARD\n</content></entry>", [ 'Content-Language',
  'en-US',
  'Content-Type',
  'application/atom+xml;charset=UTF-8',
  'Last-Modified',
  'Wed, 20 Sep 2017 13:28:51 GMT',
  'p3p',
  'CP="NON CUR OTPi OUR NOR UNI"',
  'x-frame-options',
  'SAMEORIGIN',
  'Cache-Control',
  'private, max-age=600, no-cache=set-cookie, private, must-revalidate',
  'Expires',
  'Thu, 01 Dec 1994 16:00:00 GMT',
  'x-lconn-auth',
  'true',
  'x-ua-compatible',
  'IE=edge',
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload',
  'X-Padding',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'X-Content-Type-Options',
  'nosniff',
  'Date',
  'Wed, 20 Sep 2017 13:28:51 GMT',
  'Content-Length',
  '6420',
  'Connection',
  'close']);


nock('https://apps.na.collabserv.com:443', {"encodedQueryParams":true})
  .get('/profiles/atom/connections.do')
  .query({"connectionType":"colleague","outputType":"connection","page":"1","userid":"mock%20user%20id","output":"vcard","format":"lite","sortBy":"displayName","sortOrder":"asc"})
  .reply(400, "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n<error xmlns=\"http://www.ibm.com/xmlns/prod/sn\">\r\n\t<code>\r\n\t\t\r\n\t\t\t400\r\n\t\t\r\n\t</code>\r\n\t<message>\r\n\t\t\r\n\t\t\t\r\n\t\t\t\r\n\t\t\t\r\n\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\tCLFRN1172E: The request is invalid.\r\n\t\t\t\t\t\r\n\t\t\t\t\r\n\t\t\t\r\n\t\t\r\n\t</message>\r\n\t<trace>\r\n\t\t\r\n\t\t\r\n\t\t\r\n\t\t\tOMITTED\r\n\t\t\r\n\t\t\r\n\t</trace>\t\t\t\r\n</error>\r\n\r\n\r\n", [ 'Content-Language',
  'en-US',
  'Content-Type',
  'text/xml;charset=UTF-8',
  'p3p',
  'CP="NON CUR OTPi OUR NOR UNI"',
  'x-frame-options',
  'SAMEORIGIN',
  'Cache-Control',
  'no-cache="set-cookie, set-cookie2", private, must-revalidate',
  'Expires',
  'Thu, 01 Dec 1994 16:00:00 GMT',
  'x-lconn-auth',
  'true',
  'x-ua-compatible',
  'IE=edge',
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload',
  'X-Padding',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'X-Content-Type-Options',
  'nosniff',
  'Date',
  'Wed, 20 Sep 2017 13:28:51 GMT',
  'Connection',
  'close']);


nock('https://apps.na.collabserv.com:443', {"encodedQueryParams":true})
  .get('/profiles/atom/profileTags.do')
  .query({"targetEmail":"albert.energy%40gis-demo.com"})
  .reply(403, "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n\r\n<error xmlns=\"http://www.ibm.com/xmlns/prod/sn\">\r\n\t<code>\r\n\t\t\r\n\t\t\t403\r\n\t\t\r\n\t</code>\r\n\t<message>\r\n\t\t\r\n\t\t\t\r\n\t\t\t\r\n\t\t\t\r\n\t\t\t\t\r\n\t\t\t\t\t\r\n\t\t\t\t\t\tCLFRN1174E: You are not authorized to perform that action.\r\n\t\t\t\t\t\r\n\t\t\t\t\r\n\t\t\t\r\n\t\t\r\n\t</message>\r\n\t<trace>\r\n\t\t\r\n\t\t\r\n\t\t\r\n\t\t\tOMITTED\r\n\t\t\r\n\t\t\r\n\t</trace>\t\t\t\r\n</error>\r\n\r\n\r\n", [ 'Content-Language',
  'en-US',
  'Content-Type',
  'text/xml;charset=UTF-8',
  'p3p',
  'CP="NON CUR OTPi OUR NOR UNI"',
  'x-frame-options',
  'SAMEORIGIN',
  'Cache-Control',
  'no-cache="set-cookie, set-cookie2", private, must-revalidate',
  'Expires',
  'Thu, 01 Dec 1994 16:00:00 GMT',
  'x-lconn-auth',
  'true',
  'x-ua-compatible',
  'IE=edge',
  'Strict-Transport-Security',
  'max-age=31536000; includeSubDomains; preload',
  'X-Padding',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'X-Content-Type-Options',
  'nosniff',
  'Date',
  'Wed, 20 Sep 2017 13:28:51 GMT',
  'Connection',
  'close']);

/* eslint-enable */
