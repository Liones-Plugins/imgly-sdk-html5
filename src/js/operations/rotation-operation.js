"use strict";
/*!
 * Copyright (c) 2013-2015 9elements GmbH
 *
 * Released under Attribution-NonCommercial 3.0 Unported
 * http://creativecommons.org/licenses/by-nc/3.0/
 *
 * For commercial use, please contact us at contact@9elements.com
 */

import Operation from "./operation";
import Vector2 from "../lib/math/vector2";

/**
 * An operation that can crop out a part of the image and rotates it
 *
 * @class
 * @alias ImglyKit.Operations.RotationOperation
 * @extends ImglyKit.Operation
 */
class RotationOperation extends Operation {
  constructor (...args) {
    this.availableOptions = {
      degrees: { type: "number", default: 0, validation: function (value) {
        if (value % 90 !== 0) {
          throw new Error("RotationOperation: `rotation` has to be a multiple of 90.");
        }
      }}
    };

    /**
     * The fragment shader used for this operation
     */
    this.vertexShader = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      uniform mat3 u_matrix;

      void main() {
        gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1);
        v_texCoord = a_texCoord;
      }
    `;

    super(...args);
  }

  /**
   * A unique string that identifies this operation. Can be used to select
   * operations.
   * @type {String}
   */
  get identifier () {
    return "rotation";
  }

  /**
   * Rotates the image using WebGL
   * @param  {WebGLRenderer} renderer
   */
  /* istanbul ignore next */
  _renderWebGL (renderer) {
    var canvas = renderer.getCanvas();
    var gl = renderer.getContext();

    var actualDegrees = this._options.degrees % 360;
    var lastTexture = renderer.getLastTexture();

    // If we're not rotating by 180 degrees, we need to resize the canvas
    // and the texture
    if (actualDegrees % 180 !== 0) {
      let newDimensions = this.getNewDimensions(renderer);

      // Resize the canvas
      canvas.width = newDimensions.x;
      canvas.height = newDimensions.y;

      // Resize the current texture
      var currentTexture = renderer.getCurrentTexture();
      gl.bindTexture(gl.TEXTURE_2D, currentTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

      // Resize all other textures except the input texture
      var textures = renderer.getTextures();
      var texture;
      for (var i = 0; i < textures.length; i++) {
        texture = textures[i];

        // We resize the input texture at the end
        if (texture === lastTexture) continue;

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
    }

    // Build the rotation matrix
    var radians = actualDegrees * (Math.PI / 180);
    var c = Math.cos(radians);
    var s = Math.sin(radians);
    var rotationMatrix = [
      c,-s, 0,
      s, c, 0,
      0, 0, 1
    ];

    // Run the shader
    renderer.runShader(this.vertexShader, null, {
      uniforms: {
        u_matrix: { type: "mat3fv", value: rotationMatrix }
      }
    });

    // Resize input texture
    gl.bindTexture(gl.TEXTURE_2D, lastTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  /**
   * Crops the image using Canvas2D
   * @param  {CanvasRenderer} renderer
   */
  _renderCanvas (renderer) {
    var canvas = renderer.getCanvas();

    var actualDegrees = this._options.degrees % 360;
    let newDimensions = this.getNewDimensions(renderer);

    // Create a rotated canvas
    var newCanvas = renderer.createCanvas();
    newCanvas.width = newDimensions.x;
    newCanvas.height = newDimensions.y;
    var newContext = newCanvas.getContext("2d");

    newContext.save();

    // Translate the canvas
    newContext.translate(newCanvas.width / 2, newCanvas.height / 2);

    // Rotate the canvas
    newContext.rotate(actualDegrees * (Math.PI / 180));

    // Create a temporary canvas so that we can draw the image
    // with the applied transformation
    var tempCanvas = renderer.cloneCanvas();
    newContext.drawImage(tempCanvas, -canvas.width / 2, -canvas.height / 2);

    // Restore old transformation
    newContext.restore();

    renderer.setCanvas(newCanvas);
  }

  /**
   * Gets the new dimensions
   * @param {Renderer} renderer
   * @param {Vector2} [dimensions]
   * @return {Vector2}
   */
  getNewDimensions (renderer, dimensions) {
    let canvas = renderer.getCanvas();
    dimensions = dimensions || new Vector2(canvas.width, canvas.height);

    let actualDegrees = this._options.degrees % 360;
    if (actualDegrees % 180 !== 0) {
      let tempX = dimensions.x;
      dimensions.x = dimensions.y;
      dimensions.y = tempX;
    }

    return dimensions;
  }
}

export default RotationOperation;
