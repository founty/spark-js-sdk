/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
import {map} from 'lodash';
import uuid from 'uuid';

describe(`plugin-board`, () => {
  describe(`realtime - sharing mercury`, () => {
    let board, conversation, participants;

    before(`create users`, () => testUsers.create({count: 2})
      .then((users) => {
        participants = users;

        return Promise.all(map(participants, (participant) => {
          participant.spark = new CiscoSpark({
            credentials: {
              authorization: participant.token
            }
          });
          return participant.spark.device.register()
            .then(() => participant.spark.feature.setFeature(`developer`, `web-shared-mercury`, true));
        }));
      }));

    before(`create conversation`, () => participants[0].spark.conversation.create({
      displayName: `Test Board Mercury`,
      participants
    })
      .then((c) => {
        conversation = c;
        return conversation;
      }));

    before(`create channel (board)`, () => participants[0].spark.board.createChannel(conversation)
      .then((channel) => {
        board = channel;
        return channel;
      }));

    beforeEach(`connect to mercury channel`, () => {
      return Promise.all(map(participants, (participant) => {
        return participant.spark.mercury.connect();
      }));
    });

    // disconnect realtime
    afterEach(`disconnect mercury`, () => Promise.all(map(participants, (participant) => {
      return participant.spark.mercury.disconnect();
    })));

    describe(`#connectToSharedMercury`, () => {
      it(`registers to share mercury connection`, () => {
        return participants[0].spark.board.realtime.connectToSharedMercury(board)
          .then((res) => {
            assert.property(res, `action`);
            assert.property(res, `binding`);
            assert.property(res, `webSocketUrl`);
            assert.property(res, `sharedWebSocket`);
            assert.property(res, `mercuryConnectionServiceClusterUrl`);
            assert.equal(res.action, `REPLACE`);
            assert.deepEqual(res.mercuryConnectionServiceClusterUrl, participants[0].spark.mercury.localClusterServiceUrls.mercuryConnectionServiceClusterUrl);
          });
      });
    });

    describe(`#disconnectFromSharedMercury`, () => {
      it(`removes board binding from registration`, () => {
        return participants[0].spark.board.realtime.disconnectFromSharedMercury(board)
          .then((res) => {
            assert.property(res, `action`);
            assert.property(res, `binding`);
            assert.property(res, `webSocketUrl`);
            assert.property(res, `sharedWebSocket`);
            assert.equal(res.action, `REMOVE`);
          });
      });
    });

    describe(`#publish()`, () => {
      describe(`string payload`, () => {
        let uniqueRealtimeData;

        before(() => {
          return Promise.all([
            participants[0].spark.board.realtime.connectToSharedMercury(board),
            participants[1].spark.board.realtime.connectByOpenNewMercuryConnection(board)
          ]);
        });

        after(() => {
          return Promise.all(map(participants, (participant) => {
            if (participant.spark.board.realtime.isSharingMercury) {
              return participant.spark.board.realtime.disconnectFromSharedMercury(board);
            }
            return participant.spark.board.realtime.disconnect();
          }));
        });

        it(`posts a message from shared connection to the specified board`, (done) => {
          uniqueRealtimeData = uuid.v4();
          const data = {
            envelope: {
              channelId: board,
              roomId: conversation.id
            },
            payload: {
              msg: uniqueRealtimeData
            }
          };

          // participan 1 is going to listen for RT data and confirm that we
          // have the same data that was sent.
          participants[1].spark.board.realtime.once(`event:board.activity`, ({data}) => {
            assert.equal(data.contentType, `STRING`);
            assert.equal(data.payload.msg, uniqueRealtimeData);
            done();
          });

          // confirm that both are connected.
          assert.isTrue(participants[0].spark.board.realtime.isSharingMercury, `participant 0 is sharing mercury connection`);
          assert.isTrue(participants[0].spark.mercury.connected, `participant 0 is connected`);
          assert.isFalse(participants[1].spark.board.realtime.isSharingMercury, `participant 1 does not share mercury connection`);
          assert.isTrue(participants[1].spark.mercury.connected, `participant 1 is connected`);

          // do not return promise because we want done() to be called on
          // board.activity
          participants[0].spark.board.realtime.publish(board, data);
        });

        it(`posts a message from separated socket connection to the specified board`, (done) => {
          uniqueRealtimeData = uuid.v4();
          const data = {
            envelope: {
              channelId: board,
              roomId: conversation.id
            },
            payload: {
              msg: uniqueRealtimeData
            }
          };

          // participan 0 is going to listen for RT data and confirm that we
          // have the same data that was sent.
          participants[0].spark.mercury.once(`event:board.activity`, ({data}) => {
            assert.equal(data.contentType, `STRING`);
            assert.equal(data.payload.msg, uniqueRealtimeData);
            done();
          });

          // confirm that both are connected.
          assert.isTrue(participants[0].spark.mercury.connected, `participant 0 is connected`);
          assert.isTrue(participants[0].spark.board.realtime.isSharingMercury, `participant 0 is sharing mercury connection`);
          assert.isTrue(participants[1].spark.mercury.connected, `participant 1 is connected`);
          assert.isFalse(participants[1].spark.board.realtime.isSharingMercury, `participant 1 does not share mercury connection`);

          // do not return promise because we want done() to be called on
          // board.activity
          participants[1].spark.board.realtime.publish(board, data);
        });
      });
    });
  });
});
