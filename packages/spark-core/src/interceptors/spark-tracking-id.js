/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Interceptor} from '@ciscospark/http-core';

const sequenceNumbers = new WeakMap();

/**
 * @class
 */
export default class SparkTrackingIdInterceptor extends Interceptor {
  /**
   * Sequence number; increments on access
   * @type {Number}
   */
  get sequence() {
    let sq = sequenceNumbers.get(this) || 0;
    sq += 1;
    sequenceNumbers.set(this, sq);
    return sq;
  }

  /**
   * @returns {SparkTrackingIdInterceptor}
   */
  static create() {
    return new SparkTrackingIdInterceptor({spark: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    options.headers = options.headers || {};
    if (this.requiresTrackingId(options)) {
      options.headers.trackingid = `${this.spark.sessionId}_${this.sequence}`;
    }

    if (options.headers.trackingid && options.replayCount) {
      const tid = options.headers.trackingid.split(`+`);
      tid[1] = options.replayCount;
      options.headers.trackingid = tid.join(`+`);
    }

    return options;
  }

  /**
   * Determines whether or not include a tracking id
   * @param {Object} options
   * @returns {boolean}
   */
  requiresTrackingId(options) {
    return !options.headers.trackingid;
  }
}
