/**!
*
* Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
*/

import {assert} from '@ciscospark/test-helper-chai';
import {readExifData, orient} from '../..';
import file from '@ciscospark/test-helper-file';
import sinon from '@ciscospark/test-helper-sinon';

describe(`helper-image`, () => {
  describe(`readExifData()`, () => {
    it(`adds exif orientation information on the image file`, () => {
      const sampleFile = {
        displayName: `Portrait_7.jpg`,
        fileSize: 405822,
        type: `image/jpeg`,
        image: {
          height: 300,
          width: 362
        },
        mimeType: `image/jpeg`,
        objectType: `file`
      };

      return file.fetch(`/Portrait_7.jpg`)
      .then((f) => {
        readExifData(sampleFile, f)
        .then((res) => {
          assert.equal(res, f);
          assert.equal(sampleFile.image.orientation, 7);
        });
      });
    });
  });

  describe(`orient()`, () => {
    const events = [
      {
        orientation: 1
      },
      {
        orientation: 2,
        flip: true
      },
      {
        orientation: 3,
        rotate: `180`
      },
      {
        orientation: 4,
        flip: true,
        rotate: `180`
      },
      {
        orientation: 5,
        flip: true,
        rotate: `270`
      },
      {
        orientation: 6,
        rotate: `270`
      },
      {
        orientation: 7,
        flip: true,
        rotate: `90`
      },
      {
        orientation: 8,
        rotate: `90`
      }
    ];
    const file = {
      displayName: `Portrait_7.jpg`,
      fileSize: 405822,
      type: `image/jpeg`,
      image: {
        height: 300,
        width: 362
      },
      mimeType: `image/jpeg`,
      objectType: `file`
    };
    const options = {
      img: `Portrait_7.jpg`,
      x: 0,
      y: 0,
      width: 362,
      height: 300,
      ctx: {
        save: sinon.stub().returns(() => true),
        translate: sinon.stub().returns(() => true),
        rotate: sinon.stub().returns(() => true),
        scale: sinon.stub().returns(() => true),
        drawImage: sinon.stub().returns(() => true),
        restore: sinon.stub().returns(() => true)
      }
    };
    events.forEach((def) => {
      const {flip, orientation, rotate} = def;
      describe(`when an image file is received with orientation as ${orientation}`, () => {
        options.orientation = orientation;
        file.image.orientation = orientation;
        orient(options, file);
        let message = flip ? `flips ` : ``;
        message += rotate ? `rotates ${rotate} deg` : ``;
        message = message ? `image on the canvas ${message}` : `does nothing `;
        it(`${message}`, () => {
          assert.isTrue(options.ctx.save.called);
          assert.isTrue(options.ctx.translate.calledWith(options.x + options.width / 2, options.y + options.height / 2));
          assert.isTrue(options.ctx.drawImage.calledWith(options.img, -options.width / 2, -options.height / 2, options.width, options.height));
          assert.isTrue(options.ctx.restore.called);
          if (flip) {
            assert.isTrue(options.ctx.scale.calledWith(-1, 1));
            if (rotate) {
              assert.isTrue(options.ctx.rotate.calledWith(rotate * Math.PI / 180));
            }
          }
          else if (rotate) {
            assert.isTrue(options.ctx.rotate.calledWith(2 * Math.PI - 90 * Math.PI / 180));
          }
        });
      });
    });
  });
});
