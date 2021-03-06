/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import fh from '@ciscospark/test-helper-file';
import testUsers from '@ciscospark/test-helper-test-users';


describe(`plugin-support`, function() {
  this.timeout(60000);

  let spark;

  let sampleTextOne = `sample-text-one.txt`;

  before(`fetch fixtures`, () => Promise.all([
    fh.fetch(sampleTextOne)
  ])
    .then((res) => {
      [
        sampleTextOne
      ] = res;
    }));

  // Disabled because rackspace is broken
  describe.skip(`#submitLogs()`, () => {
    describe(`when the current user is authorized`, () => {
      before(() => testUsers.create({count: 1})
        .then((users) => {
          spark = new CiscoSpark({
            credentials: {
              authorization: users[0].token
            }
          });

          return spark.device.register();
        }));

      it(`uploads logs`, () => spark.support.submitLogs({}, sampleTextOne)
        .then((body) => {
          assert.isDefined(body);
          assert.property(body, `url`);
          assert.property(body, `userId`);
          assert.equal(body.userId, spark.device.userId);
        }));
    });

    // Disabled because rackspace is broken
    describe(`when the current user is not authorized`, () => {
      it(`uploads logs`, () => {
        spark = new CiscoSpark({});
        return spark.support.submitLogs({}, sampleTextOne)
          .then((body) => {
            assert.isDefined(body);
            assert.property(body, `url`);
            assert.property(body, `userId`);
          });
      });
    });
  });

});
