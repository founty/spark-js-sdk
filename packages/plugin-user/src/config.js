/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

export default {
  device: {
    preDiscoveryServices: {
      atlasServiceUrl: process.env.ATLAS_SERVICE_URL || `https://atlas-a.wbx2.com/admin/api/v1`
    }
  },
  user: {
    activationUrl: `https://idbroker.webex.com/idb/token/v1/actions/UserActivation/invoke`,
    batcherWait: 100,
    batcherMaxCalls: 100,
    batcherMaxWait: 1500,
    setPasswordUrl: `https://identity.webex.com/identity/scim/v1/Users`,
    verifyDefaults: {
      reqId: `WEBCLIENT`
    }
  }
};
