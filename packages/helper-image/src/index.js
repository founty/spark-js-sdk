/**!
*
* Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
*/

/* global Uint8Array, FileReader */

const ExifImage = require(`exif`).ExifImage;

/**
* Draws the image on the canvas so that the thumbnail
* could be generated
* @param {Object} options(options(orientation: image exif orientation range from 1-8, img: Image object, x: start x-axis, y: start y-axis, width: width of the thumbnail, height: height of the thumbnail, deg: counterclockwise degree rotation, flip: flip Image, ctx: canvas context))
* @returns {Object}
*/
export function drawImage(options) {
  // save current context before applying transformations
  options.ctx.save();
  let rad;
  // convert degrees to radians
  if (options.flip) {
    rad = options.deg * Math.PI / 180;
  }
  else {
    rad = 2 * Math.PI - options.deg * Math.PI / 180;
  }
  // set the origin to the center of the image
  options.ctx.translate(options.x + options.width / 2, options.y + options.height / 2);
  // rotate the canvas around the origin
  options.ctx.rotate(rad);
  if (options.flip) {
    // flip the canvas
    options.ctx.scale(-1, 1);
  }
  // draw the image
  options.ctx.drawImage(options.img, -options.width / 2, -options.height / 2, options.width, options.height);
  // restore the canvas
  options.ctx.restore();
}

/**
* Updates the image file with exif information, required to correctly rotate the image activity
* @param {Object} file
* @returns {Promise<Object>}
*/
export function updateImageOrientation(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = function onload() {
      const arrayBuffer = reader.result;
      const buf = new Buffer(arrayBuffer.byteLength);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < buf.length; ++i) {
        buf[i] = view[i];
      }
      resolve(buf);
    };
  })
  .then((buf) => readExifData(file, buf));
}

/**
* Adds exif orientation information on the image file
* @param {Object} file
* @param {Object} buf
* @returns {Promise<ExifImage>}
*/
export function readExifData(file, buf) {
  return new Promise((resolve) => {
    // For avatar images the file.type is set as image/jpeg, however for images shared in an activity file.mimeType is set as image/jpeg. Handling both conditions.
    if (file && file.image && (file.type === `image/jpeg` || file.mimeType === `image/jpeg`)) {
      /* eslint-disable no-new */
      new ExifImage({image: buf}, (error, exifData) => {
        if (!error && exifData) {
          file.image.orientation = exifData.image.Orientation;
        }
        resolve(buf);
      });
    }
    else {
      resolve(buf);
    }
  });
}

/* eslint complexity: ["error", 9] */
/**
* Rotates/flips the image on the canvas as per exif information
* @param {Object} options(orientation: image exif orientation range from 1-8, img: Image object, x: start x-axis, y: start y-axis, width: width of the thumbnail, height: height of the thumbnail, ctx: canvas context)
* @param {Object} file
* @returns {Object}
*/
export function orient(options, file) {
  if (file && file.image && file.image.orientation && file.image.orientation !== 1) {
    const image = {
      img: options.img,
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      deg: 0,
      flip: true,
      ctx: options.ctx
    };
    switch (options && options.orientation) {
    case 3:
      // rotateImage180
      image.deg = 180;
      image.flip = false;
      break;
    case 4:
      // rotate180AndFlipImage
      image.deg = 180;
      image.flip = true;
      break;
    case 5:
      // rotate90AndFlipImage
      image.deg = 270;
      image.flip = true;
      break;
    case 6:
      // rotateImage90
      image.deg = 270;
      image.flip = false;
      break;
    case 7:
      // rotateNeg90AndFlipImage
      image.deg = 90;
      image.flip = true;
      break;
    case 8:
      // rotateNeg90
      image.deg = 90;
      image.flip = false;
      break;
    default:
      break;
    }
    drawImage(image);
  }
  else {
    options.ctx.drawImage(options.img, options.x, options.y, options.width, options.height);
  }
}
