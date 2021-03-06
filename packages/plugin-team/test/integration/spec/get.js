/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';
import '@ciscospark/plugin-wdm';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import {every, find, map} from 'lodash';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';

function ensureGeneral(team, conversations) {
  assert.isConversation(find(conversations, (conversation) => {
    return team.generalConversationUuid === conversation.id && conversation.tags.includes(`TEAM`);
  }));
}

describe(`plugin-team`, () => {

  let kirk, spock, team0, team1, teamConvo0, teamConvo1;

  before(() => testUsers.create({count: 2})
    .then((users) => {
      [kirk, spock] = users;

      kirk.spark = new CiscoSpark({
        credentials: {
          authorization: kirk.token
        },
        config: {
          conversation: {
            keepEncryptedProperties: true
          }
        }
      });

      spock.spark = new CiscoSpark({
        credentials: {
          authorization: spock.token
        },
        config: {
          conversation: {
            keepEncryptedProperties: true
          }
        }
      });

      return Promise.all([
        kirk.spark.mercury.connect(),
        spock.spark.mercury.connect()
      ]);
    })
  );

  before(() => {
    team0 = {
      displayName: `test-team-0`,
      summary: `test-team-0-summary`,
      participants: [
        kirk,
        spock
      ]
    };

    team1 = {
      displayName: `test-team-1`,
      participants: [
        kirk
      ]
    };

    return Promise.all([
      kirk.spark.team.create(team0),
      kirk.spark.team.create(team1)
    ])
      .then((teams) => {
        team0 = teams[0];
        team1 = teams[1];

        const emptyRoom = {
          displayName: `team-conversation-${uuid.v4()}`,
          participants: [
            kirk
          ]
        };

        return Promise.all([
          kirk.spark.team.createConversation(team0, emptyRoom),
          kirk.spark.team.createConversation(team0, emptyRoom)
        ]);
      })
      .then((conversations) => {
        [teamConvo0, teamConvo1] = conversations;
      });
  });

  after(() => Promise.all([
    kirk && kirk.spark.mercury.disconnect(),
    spock && spock.spark.mercury.disconnect()
  ]));

  describe(`#get()`, () => {
    it(`retrieves a team`, () => kirk.spark.team.get(team0)
      .then((t) => {
        assert.isInternalTeam(t);
        assert.equal(t.id, team0.id);
        assert.match(t.teamColor, team0.teamColor);

        assert.equal(t.displayName, team0.displayName);
        assert.equal(t.summary, team0.summary);

        assert.lengthOf(t.teamMembers.items, 0);
        assert.lengthOf(t.conversations.items, 0);
      }));

    it(`retrieves a team with teamMembers`, () => kirk.spark.team.get(team0, {includeTeamMembers: true})
      .then((t) => {
        assert.isInternalTeam(t);
        assert.equal(t.id, team0.id);
        assert.lengthOf(t.teamMembers.items, team0.teamMembers.items.length);
        assert.lengthOf(t.conversations.items, 0);
      }));

    it(`retrieves a team with conversations`, () => kirk.spark.team.get(team0, {includeTeamConversations: true})
      .then((t) => {
        assert.isInternalTeam(t);
        assert.equal(t.id, team0.id);
        assert.lengthOf(t.teamMembers.items, 0);
        // Note we get the general conversation back in addition to the 2 added rooms
        assert.lengthOf(t.conversations.items, 3);
        ensureGeneral(t, t.conversations.items);
        assert.include(map(t.conversations.items, `url`), teamConvo0.url);
        assert.include(map(t.conversations.items, `url`), teamConvo1.url);
      }));
  });

  describe(`#listConversations()`, () => {
    it(`retrieves and decrypts conversations for a team`, () => kirk.spark.team.listConversations(team0)
      .then((conversations) => {
        assert.lengthOf(conversations, 3);
        ensureGeneral(team0, conversations);
        assert.include(map(conversations, `url`), teamConvo0.url);
        assert.include(map(conversations, `url`), teamConvo1.url);

        conversations.forEach((c) => {
          assert.isInternalTeamConversation(c);
          assert.include(map([team0, teamConvo0, teamConvo1], `displayName`), c.displayName);
        });
      }));

    it(`retrieves and decypts conversations for a team (including unjoined)`, () => spock.spark.team.listConversations(team0)
      .then((conversations) => {
        assert.lengthOf(conversations, 3);
        ensureGeneral(team0, conversations);
        assert.include(map(conversations, `url`), teamConvo0.url);
        assert.include(map(conversations, `url`), teamConvo1.url);

        conversations.forEach((c) => {
          assert.isInternalTeamConversation(c);
          assert.include(map([team0, teamConvo0, teamConvo1], `displayName`), c.displayName);
        });
      }));
  });

  describe(`#list()`, () => {
    it(`retrieves a list of teams`, () => kirk.spark.team.list()
      .then((teams) => {
        assert.equal(teams.length, 2);

        every(teams, (team) => {
          assert.lengthOf(team.teamMembers.items, 0);
          assert.lengthOf(team.conversations.items, 0);
        });
      }));

    it(`retrieves a list of teams with teamMembers`, () => kirk.spark.team.list({includeTeamMembers: true})
      .then((teams) => {
        assert.equal(teams.length, 2);

        every(teams, (team) => {
          assert.isAbove(team.teamMembers.items.length, 0);
          assert.lengthOf(team.conversations.items, 0);
        });
      }));

    it(`retrieves a list of teams with conversations`, () => kirk.spark.team.list({includeTeamConversations: true})
      .then((teams) => {
        assert.equal(teams.length, 2);

        every(teams, (team) => {
          assert.lengthOf(team.teamMembers.items, 0);
          assert.isAbove(team.conversations.items.length, 0);
          ensureGeneral(team, team.conversations.items);
        });
      }));
  });
});
