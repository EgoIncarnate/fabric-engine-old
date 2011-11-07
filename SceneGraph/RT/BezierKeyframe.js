
//
// Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
//

/**
 * A function to create a bezier key frame object.
 * @constructor
 * @param {number} time The time of the keyframe.
 * @param {number} value The value of the keyframe.
 * @param {number} intan The input tangent of the keyframe.
 * @param {number} outtan The output tangent of the keyframe.
 */
FABRIC.RT.BezierKeyframe = function(time, value, intan, outtan) {
  this.time = typeof time === 'number' ? time : 0;
  this.value = typeof value === 'number' ? value : 0;
  this.intangent = (intan &&
    intan.getType &&
    intan.getType() === 'FABRIC.RT.Vec2') ? intan : new FABRIC.RT.Vec2(-0.333, 0);
  this.outtangent = (outtan &&
    outtan.getType &&
    outtan.getType() === 'FABRIC.RT.Vec2') ? outtan : new FABRIC.RT.Vec2(0.333, 0);
};

FABRIC.RT.BezierKeyframe.prototype = {
  // This method enables an animation evaluator to know what kind of data
  // track full of these data types should evaluate to.
  get valueType() {
    return 'Scalar';
  },
  getType: function() {
    return 'FABRIC.RT.BezierKeyframe';
  }
};

/**
 * overloaded constructor function for BezierKeyFrame
 * @param {number} value The value of the keyframe.
 * @param {number} time The time of the keyframe.
 * @param {number} intan The input tangent of the keyframe.
 * @param {number} outtan The output tangent of the keyframe.
 * @return {object} The bezier key frame object.
 */
FABRIC.RT.bezierKeyframe = function(value, time, intan, outtan) {
  return new FABRIC.RT.BezierKeyframe(value, time, intan, outtan);
};

FABRIC.appendOnCreateContextCallback(function(context) {
  context.RegisteredTypesManager.registerType('BezierKeyframe', {
    members: {
      time: 'Scalar', value: 'Scalar', intangent: 'Vec2', outtangent: 'Vec2'
    },
    constructor: FABRIC.RT.BezierKeyframe,
    klBindings: {
      filename: 'BezierKeyframe.kl',
      sourceCode: FABRIC.loadResourceURL('FABRIC_ROOT/SceneGraph/RT/BezierKeyframe.kl')
    }
  });
});


if(!FABRIC.RT.KeyframeTrack){
  throw("please include the SceneGraph/RT/KeyframeTrack.js file before this one.");
}

FABRIC.appendOnCreateContextCallback(function(context) {
  context.RegisteredTypesManager.registerType('BezierKeyframeTrack', {
    members: {
      name: 'String',
      color: 'Color',
      keys: 'BezierKeyframe[]'
    },
    constructor: FABRIC.RT.KeyframeTrack,
    klBindings: {
      filename: 'FABRIC_ROOT/SceneGraph/RT/KeyframeTrack.kl',
      sourceCode: FABRIC.preProcessCode(
        FABRIC.loadResourceURL('FABRIC_ROOT/SceneGraph/RT/KeyframeTrack.kl'), {
          KEYFRAMETYPE: 'BezierKeyframe'
        })
    }
  });
});

FABRIC.appendOnCreateContextCallback(function(context) {
  context.RegisteredTypesManager.registerType('BezierKeyframeTrackSet', {
    members: {
      name: 'String',
      timeRange: 'Vec2',
      tracks: 'BezierKeyframeTrack[]'
    },
    constructor: FABRIC.RT.KeyframeTrackSet,
    klBindings: {
      filename: 'FABRIC_ROOT/SceneGraph/RT/KeyframeTrack.kl',
      sourceCode: FABRIC.preProcessCode(
        FABRIC.loadResourceURL('FABRIC_ROOT/SceneGraph/RT/KeyframeTrack.kl'), {
          KEYFRAMETYPE: 'BezierKeyframe'
        })
    }
  });
});
