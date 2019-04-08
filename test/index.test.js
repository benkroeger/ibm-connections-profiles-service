// node core modules

// 3rd party modules
const test = require('ava');
const _ = require('lodash');

// internal modules
const IbmConnectionsProfilesService = require('../lib');
const vCardMapping = require('../lib/config/vcard-attribute-mapping.json');
const { mock, record, persist } = require('./fixtures/http-mocking');

// setting up variables
const { unmocked, username, password, albertUserid } = process.env;

test.before(() => (unmocked ? record() : mock()));
test.after(() => unmocked && persist());

test.beforeEach(t => {
  const serviceOptions = {
    defaults: {
      authType: '',
    },
  };

  if (unmocked) {
    Object.assign(serviceOptions.defaults, {
      auth: {
        user: username,
        pass: password,
      },
    });
  }
  const queryMock = { userid: albertUserid };
  const baseProps = [
    'photo',
    'names',
    'displayName',
    'url',
    'pronounciation',
    'email',
    'preferredLanguage',
    'organizationTitle',
    'orgId',
    'jobResp',
    'bldgId',
    'floor',
    'officeName',
    'telephoneNumber',
    'mobileNumber',
    'faxNumber',
    'ipTelephoneNumber',
    'pagerNumber',
    'tags',
    'experience',
    'description',
    'managerUid',
    'isManager',
    'key',
    'uid',
    'userid',
    'employeeNumber',
    'deptTitle',
    'profileType',
    'extattr',
  ];

  const serviceInstance = new IbmConnectionsProfilesService(
    'https://apps.na.collabserv.com/profiles/',
    serviceOptions,
  );
  _.assign(t.context, {
    serviceInstance,
    queryMock,
    baseProps,
  });
});

/* Successful scenarios validations */

test.cb(
  'validating retrieving profile entry using Profile service instance, userid provided',
  t => {
    const { serviceInstance, queryMock } = t.context;
    serviceInstance.getProfileEntry(
      queryMock,
      {
        /* options */
      },
      (err, result) => {
        t.falsy(err);
        _.keys(result).forEach(prop => {
          t.true(
            _.values(vCardMapping).includes(prop),
            `${prop} should be mapped value from {{ vCardMapping }}`,
          );
        });
        const { extattr, names } = result;

        t.is(extattr.length, 9);
        t.true(_.isPlainObject(names));

        t.true(_.isArray(extattr), 'extattr should be an array');
        ['surname', 'givenName'].forEach(prop =>
          t.true(
            prop in names,
            `${prop} should be a member of {{ names }} object`,
          ),
        );
        t.end();
      },
    );
  },
);

test.cb(
  'validating retrieving network connections using Profile service instance, userid provided',
  t => {
    const { serviceInstance, queryMock } = t.context;

    serviceInstance.getNetworkConnections(
      queryMock,
      {
        /* options */
      },
      (err, result) => {
        t.falsy(err);
        const properties = [
          'paginationLinks',
          'totalResults',
          'startIndex',
          'itemsPerPage',
          'networkConnections',
        ];
        const colleagueProps = [
          'id',
          'categories',
          'updated',
          'message',
          'summary',
          'links',
          'contributor',
        ];
        const { networkConnections, totalResults } = result;

        properties.forEach(prop => {
          t.true(prop in result, `${prop} should be a member of {{ result }}`);
        });
        t.is(
          totalResults,
          _.keys(networkConnections).length,
          `${queryMock.userid} should be a member of networkConnections`,
        );
        _.keys(networkConnections).forEach(colleagueKey => {
          colleagueProps.forEach(prop =>
            t.true(
              prop in networkConnections[colleagueKey],
              `${prop} should be a member of colleague with id [${colleagueKey}]`,
            ),
          );
          const { contributor, categories, links } = networkConnections[
            colleagueKey
          ];
          t.true(_.isPlainObject(contributor));
          t.true(_.isPlainObject(categories));

          ['type', 'connectionType', 'status'].forEach(category =>
            t.true(
              category in categories,
              `[${category}] should be a member of categories object`,
            ),
          );
          t.true(_.isPlainObject(links));
          ['self', 'edit'].forEach(link =>
            t.true(
              link in links,
              `[${link}] should be a member of links object`,
            ),
          );
        });
        t.end();
      },
    );
  },
);

test.cb('validating retrieving followed profiles', t => {
  const { serviceInstance } = t.context;
  serviceInstance.getFollowedProfiles(
    {
      /* query */
    },
    {
      /* options */
    },
    (err, result) => {
      t.falsy(err);
      const properties = [
        'paginationLinks',
        'totalResults',
        'startIndex',
        'itemsPerPage',
        'followedProfiles',
      ];
      const followedProfileProps = ['id', 'categories', 'links', 'title'];
      const { followedProfiles, totalResults } = result;

      properties.forEach(prop => {
        t.true(prop in result, `${prop} should be a member of {{ result }}`);
      });
      t.is(totalResults, _.keys(followedProfiles).length);

      _.keys(followedProfiles).forEach(profileId => {
        followedProfileProps.forEach(prop =>
          t.true(
            prop in followedProfiles[profileId],
            `${prop} should be a member of followed profile with id [${profileId}]`,
          ),
        );
        const { links, categories } = followedProfiles[profileId];
        t.true(_.isPlainObject(categories));

        ['type', 'source', 'resourceType', 'resourceId'].forEach(category =>
          t.true(
            category in categories,
            `[${category}] should be a member of categories object`,
          ),
        );
        t.true(_.isPlainObject(links));
        ['related', 'edit', 'alternate'].forEach(link =>
          t.true(link in links, `[${link}] should be a member of links object`),
        );
      });
      t.end();
    },
  );
});

test.cb('validating retrieving service document', t => {
  const { serviceInstance, queryMock } = t.context;
  serviceInstance.getServiceDocument(
    queryMock,
    {
      /* options */
    },
    (err, result) => {
      t.falsy(err);
      const properties = [
        'userid',
        'editableFields',
        'links',
        'extattrDetails',
        'services',
      ];
      const editableFieldsProps = [
        'telephoneNumber',
        'mobileNumber',
        'phone2',
        'description',
        'phone3',
        'experience',
        'phone1',
        'bldgId',
        'countryCode',
        'address4',
        'address3',
        'address2',
        'address1',
        'jobResp',
        'deptNumber',
        'profileLinks',
        'faxNumber',
        'item2',
        'item1',
      ];

      const linksProps = [
        'tag-cloud',
        'colleague',
        'reporting-chain',
        'profile-type',
        'forums',
        'blogs',
        'activities',
        'profiles',
        'wikis',
        'communities',
      ];

      const linkItemProps = ['name', 'rel', 'type', 'href'];

      const { extattrDetails, links, editableFields } = result;
      properties.forEach(prop => {
        t.true(prop in result, `${prop} should be a member of {{ result }}`);
      });

      // validate editable fields
      t.true(_.isArray(editableFields));
      editableFields.forEach(field =>
        t.true(
          editableFieldsProps.includes(field),
          `[${field}] should be a member of editableFields array`,
        ),
      );

      // validate links
      t.true(_.isPlainObject(links));
      linksProps.forEach(link => {
        t.true(link in links, `[${link}] should be a member of links object`);
        const linkItem = links[link];
        linkItemProps.forEach(linkItemProp =>
          t.true(
            linkItemProp in linkItem,
            `[${linkItemProp}] should be a member of linkItem object`,
          ),
        );
      });

      // validate extattr details
      t.true(_.isPlainObject(extattrDetails));
      t.is(_.keys(extattrDetails).length, 18);

      t.end();
    },
  );
});

/* Error / Wrong input scenarios validations */

test.cb(
  'error validation for retrieving profile entry using Profile service instance, userid not provided',
  t => {
    const { serviceInstance } = t.context;

    serviceInstance.getProfileEntry(
      {
        /* query */
      },
      {
        /* options */
      },
      error => {
        t.is(
          error.name,
          'Error',
          'when userid is not available, return an Error',
        );
        t.is(
          error.message,
          'Wrong number of entry selectors provided to receive profile entry: {}',
        );
        t.is(error.status, 400, 'Status number should be equal to 400');
        t.end();
      },
    );
  },
);

test.cb(
  'error validation for retrieving network connections using Profile service instance, userid not provided',
  t => {
    const { serviceInstance } = t.context;

    serviceInstance.getNetworkConnections(
      {
        /* query */
      },
      {
        /* options */
      },
      error => {
        t.is(
          error.name,
          'Error',
          'when userid is not available, return an Error',
        );
        t.is(
          error.message,
          'Wrong number of entry selectors provided to receive network connections: {}',
        );
        t.is(error.status, 400, 'Status number should be equal to 400');
        t.end();
      },
    );
  },
);

test.cb(
  'error validation for retrieving network connections using Profile service instance, wrong userid provided',
  t => {
    const { serviceInstance } = t.context;

    serviceInstance.getNetworkConnections(
      { userid: 'wrong user id' },
      {
        /* options */
      },
      (error, result) => {
        t.is(
          error.name,
          'Error',
          'with wrong serviceLoaderName we should get new Error when userid not available',
        );
        t.true(error.message.includes('The request is invalid'));
        t.true(
          _.isUndefined(result),
          'there should be no result since error returned',
        );
        t.end();
      },
    );
  },
);

test.cb(
  'error validation for retrieving profile entry using Profile service instance, userid provided',
  t => {
    const { serviceInstance } = t.context;

    serviceInstance.getProfileEntry(
      { userid: 'wrong user id' },
      {
        /* options */
      },
      error => {
        t.is(
          error.message,
          'Expected output type [vcard] was not found in entry document. Please provide valid profile credentials',
        );
        t.end();
      },
    );
  },
);
