/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint max-nested-callbacks: [0] */

import 'webrtc-adapter';
import transform from 'sdp-transform';
import {curry, defaults, find} from 'lodash';
import {tap} from '@ciscospark/common';

const startSendingMedia = curry((kind, pc) => {
  let foundKind = false;
  pc.getLocalStreams().forEach((stream) => {
    stream.getTracks().forEach((track) => {
      if (track.kind === kind) {
        foundKind = true;
        track.enabled = true;
      }
    });
  });

  // If we didn't find any tracks for this stream/pc, we need to get new media
  if (!foundKind) {
    const constraints = {
      audio: kind === `audio`,
      video: kind === `video`
    };

    return getUserMedia(constraints)
      .then((stream) => {
        const localStream = pc.getLocalStreams()[0];
        if (localStream) {
          if (pc.addTrack) {
            stream.getTracks().forEach((track) => {
              if (localStream.addTrack) {
                localStream.addTrack(track);
              }
              if (stream.removeTrack) {
                stream.removeTrack(track);
              }
              pc.addTrack(track, localStream);
            });
          }
          else {
            stream.getTracks().forEach((track) => {
              localStream.addTrack(track);
            });
          }

          // The next few lines are a silly hack to deal with chrome not
          // firing the negotiationneeded event when tracks get added to
          // streams. We'll just have to check periodically to see if this has
          // been fixed.
          if (pc.removeStream) {
            pc.removeStream(localStream);
            pc.addStream(localStream);
          }
        }
        else {
          addStream(pc, stream);
        }
      });
  }

  return Promise.resolve();
});

const stopSendingMedia = curry((kind, pc) => {
  pc.getLocalStreams().forEach((stream) => {
    stream.getTracks().forEach((track) => {
      if (track.kind === kind) {
        track.enabled = false;
      }
    });
  });
});

/**
 * Adds a bandwith limit line to the sdp; without this line, calling fails
 * @param {string} sdp SDP
 * @private
 * @returns {string} The modified SDP
 */
function limitBandwith(sdp) {
  return sdp.split(`\r\n`).reduce((lines, line) => {
    lines.push(line);
    if (line.startsWith(`m=`)) {
      lines.push(`b=TIAS:${line.includes(`audio`) ? 64000 : 1000000}`);
    }
    return lines;
  }, []).join(`\r\n`);
}

/**
 * Ends all streams for the specified RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to end all
 * streams
 * @private
 * @returns {undefined}
 */
function endAllStreams(pc) {
  pc.getLocalStreams().forEach(stopStream);
  pc.getRemoteStreams().forEach(stopStream);
}

/**
 * Stops the specified stream's tracks and the stream (depending on browser
 * capabilities)
 * @param {MediaStream} stream The MediaStream to stop
 * @private
 * @returns {undefined}
 */
function stopStream(stream) {
  // need to reattach any removed tracks (even if they're stopped) to make sure
  // the camera gets turned off.
  if (stream.getTracks) {
    stream.getTracks().forEach((track) => track.stop());
  }

  if (stream.stop) {
    stream.stop();
  }
}

/**
 * Stops sending audio via the specified RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to stop audio
 * @private
 * @returns {Promise}
 */
export const startSendingAudio = startSendingMedia(`audio`);
/**
 * Stops sending video via the specified RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to stop video
 * @private
 * @returns {Promise}
 */
export const startSendingVideo = startSendingMedia(`video`);
/**
 * Starts sending audio via the specified RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to start audio
 * @private
 * @returns {Promise}
 */
export const stopSendingAudio = stopSendingMedia(`audio`);
/**
 * Stops sending video via the specified RTCPeerConnection
 * @param {RTCPeerConnection} pc The RTCPeerConnection for which to start video
 * @private
 * @returns {Promise}
 */
export const stopSendingVideo = stopSendingMedia(`video`);

/**
 * Wrapper around navigator.mediaDevices.getUserMedia()
 * @param {MediaStreamConstraints} constraints if NODE_ENV is `test`, will
 * automatically add `{fake: true}`. If this is problematic for your use case,
 * you'll need to explicitly include `{fake: false}`
 * @private
 * @returns {Promise<MediaStream>} The resultant MediaStream
 */
export function getUserMedia(constraints) {
  defaults(constraints, {fake: process.env.NODE_ENV === `test`});
  return navigator.mediaDevices.getUserMedia(constraints);
}

/**
 * Creates an offer sdp based on the state of the specified RTCPeerConnection and
 * offer options
 * @param {RTCPeerConnection} pc
 * @param { RTCOfferOptions} offerOptions
 * @private
 * @returns {Promise<string>} Resolves with the offer sdp
 */
export const createOffer = curry((pc, offerOptions) => {
  offerOptions = offerOptions || {};
  defaults(offerOptions, {
    offerToReceiveVideo: true,
    offerToReceiveAudio: true
  });

  const promise = new Promise((resolve) => {
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        pc.onicecandidate = undefined;
        resolve();
      }
    };

    setTimeout(() => {
      pc.onicecandidate = undefined;
      resolve();
    }, 500);

  });

  return pc.createOffer(offerOptions)
    .then(tap((offer) => {offer.sdp = limitBandwith(offer.sdp);}))
    .then(tap((offer) => {
      if (process.env.LOG_SDP) {
        // eslint-disable-next-line no-console
        console.info(`offer`, offer.sdp);
      }
    }))
    .then((offer) => pc.setLocalDescription(offer))
    .then(() => Promise.resolve(promise))
    // Apparently chrome somehow moves the bandwith limit out of the video
    // section, so we need to reapply it.
    .then(() => limitBandwith(pc.localDescription.sdp));
});

/**
 * Applies an incoming answer sdp to the specified RTCPeerConnection
 * @param {RTCPeerConnection} pc
 * @param {string} sdp
 * @private
 * @returns {Promise}
 */
export const acceptAnswer = curry((pc, sdp) => {
  if (process.env.LOG_SDP) {
    // eslint-disable-next-line no-console
    console.info(`answer`, sdp);
  }
  return pc.setRemoteDescription(new RTCSessionDescription({
    sdp,
    type: `answer`
  }));
});

/**
 * Terminates the specified RTCPeerConnection
 * @param {RTCPeerConnection} pc
 * @private
 * @returns {undefined}
 */
export const end = curry((pc) => {
  if (pc.signalingState !== `closed`) {
    endAllStreams(pc);
    pc.close();
  }
});

const curriedAddStream = curry(addStream);
const curriedRemoveStream = curry(removeStream);

/**
 * Adds the specified stream to the specified RTCPeerConnection
 * @name addStream
 * @param {PeerConnection} pc The RTCPeerConnection to which to add the stream
 * @param {MediaStream} stream The stream to add
 * @private
 * @returns {undefined}
 */
export {curriedAddStream as addStream};

/**
 * Removes the specified stream from the specified RTCPeerConnection
 * @name addStream
 * @param {PeerConnection} pc
 * @param {MediaStream} stream
 * @private
 * @returns {undefined}
 */

export {curriedRemoveStream as removeStream};

/**
 * Adds the specified stream to the specified RTCPeerConnection
 * @param {PeerConnection} pc The RTCPeerConnection to which to add the stream
 * @param {MediaStream} stream The stream to add
 * @private
 * @returns {undefined}
 */
function addStream(pc, stream) {
  if (pc.addTrack) {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  }
  else {
    pc.addStream(stream);
  }
}

/**
 * Removes the specified stream from the specified RTCPeerConnection
 * @param {PeerConnection} pc
 * @param {MediaStream} stream
 * @private
 * @returns {undefined}
 */
function removeStream(pc, stream) {
  if (pc.removeTrack && pc.getSenders) {
    const senders = pc.getSenders();
    stream.getTracks().forEach((track) => {
      // Becuase why would `removeTrack` accept a MediaStreamTrack?
      pc.removeTrack(senders.find((sender) => sender.track === track), stream);
    });
  }
  else {
    pc.removeStream(stream);
  }
}

/**
 * returns the direction line for the specified media type.
 * @param {string} type
 * @param {RTCPeerConnection} pc
 * @private
 * @returns {string}
 */
export function mediaDirection(type, pc) {
  if (pc.connectionState === `closed` || pc.signalingState === `closed`) {
    return `inactive`;
  }

  if (!pc.localDescription) {
    return `inactive`;
  }
  const sdp = transform.parse(pc.localDescription.sdp);
  const media = find(sdp.media, {type});
  if (!media) {
    return `inactive`;
  }

  if (type === `audio` && media.direction === `sendonly`) {
    const remoteSdp = transform.parse(pc.remoteDescription.sdp);
    const remoteMedia = find(remoteSdp.media, {type});
    if (remoteMedia && remoteMedia.direction === `inactive`) {
      return `inactive`;
    }
  }

  return media.direction;
}

/**
 * Checks a given sdp to ensure it contains an offer for the h264 codec
 * @param {Boolean} wantsVideo
 * @param {String} offer
 * @returns {String} returns the offer to simplify use in promise chains
 */
export const ensureH264 = curry((wantsVideo, offer) => {
  if (wantsVideo) {
    if (!offer.includes(`m=video`)) {
      throw new Error(`No video section found in offer`);
    }
    if (!/[hH]264/.test(offer)) {
      throw new Error(`Offer does not include h264 codec`);
    }
  }
  return offer;
});
