/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import Metrics, {config} from '../..';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';

describe(`plugin-metrics`, () => {
  describe(`Metrics`, () => {
    let spark;
    let metrics;
    const eventName = `test_event`;
    const mockPayload = {
      fields: {
        testField: 123
      },
      tags: {
        testTag: `tag value`
      },
      metricName: eventName,
      test: `this field should not be included in final payload`,
      type: `behavioral`
    };
    const transformedProps = {
      fields: {
        testField: 123
      },
      tags: {
        testTag: `tag value`
      },
      metricName: eventName,
      type: `behavioral`
    };
    const preLoginId = `1b90cf5e-27a6-41aa-a208-1f6eb6b9e6b6`;
    const preLoginProps = {
      metrics: [
        transformedProps
      ]
    };

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          metrics: Metrics
        }
      });

      spark.config.metrics = config.metrics;
      metrics = spark.metrics;

      spark.request = function(options) {
        return Promise.resolve({
          statusCode: 204,
          body: undefined,
          options
        });
      };
      sinon.spy(spark, `request`);
      sinon.spy(metrics, `postPreLoginMetric`);
      sinon.spy(metrics, `aliasUser`);
    });

    describe(`#submit()`, () => {
      it(`submits a metric`, () => {
        return metrics.submit(`testMetric`)
          .then(() => {
            assert.calledOnce(spark.request);
            const req = spark.request.args[0][0];
            const metric = req.body.metrics[0];

            assert.property(metric, `key`);
            assert.property(metric, `version`);
            assert.property(metric, `appType`);
            assert.property(metric, `env`);
            assert.property(metric, `time`);
            assert.property(metric, `version`);

            assert.equal(metric.key, `testMetric`);
            assert.equal(metric.version, spark.version);
            assert.equal(metric.env, `TEST`);
          });
      });
    });

    describe(`#submitClientMetrics()`, () => {
      describe(`before login`, () => {
        it(`posts pre-login metric`, () => {
          metrics.submitClientMetrics(eventName, mockPayload, preLoginId);
          assert.calledWith(metrics.postPreLoginMetric, preLoginProps, preLoginId);
        });
      });
      describe(`after login`, () => {
        it(`submits a metric to clientmetrics`, () => {
          const testPayload = {
            tags: {success: true},
            fields: {perceivedDurationInMillis: 314}
          };
          return metrics.submitClientMetrics(`test`, testPayload)
            .then(() => {
              assert.calledOnce(spark.request);
              const req = spark.request.args[0][0];
              const metric = req.body.metrics[0];

              assert.property(metric, `metricName`);
              assert.property(metric, `tags`);
              assert.property(metric, `fields`);

              assert.equal(metric.metricName, `test`);
              assert.equal(metric.tags.success, true);
              assert.equal(metric.fields.perceivedDurationInMillis, 314);
            });
        });
      });
    });

    describe(`#postPreLoginMetric()`, () => {
      it(`returns an HttpResponse object`, () => {
        return metrics.postPreLoginMetric(preLoginProps, preLoginId)
          .then(() => {
            assert.calledOnce(spark.request);
            const req = spark.request.args[0][0];
            const metric = req.body.metrics[0];
            const headers = req.headers;

            assert.property(headers, `x-prelogin-userid`);
            assert.property(metric, `metricName`);
            assert.property(metric, `tags`);
            assert.property(metric, `fields`);

            assert.equal(metric.metricName, eventName);
            assert.equal(metric.tags.testTag, `tag value`);
            assert.equal(metric.fields.testField, 123);
          });
      });
    });

    describe(`#aliasUser()`, () => {
      it(`returns an HttpResponse object`, () => {
        return metrics.aliasUser(preLoginId)
          .then(() => {
            assert.calledOnce(spark.request);
            const req = spark.request.args[0][0];
            const params = req.qs;

            sinon.match(params, {alias: true});
          });
      });
    });
  });
});
