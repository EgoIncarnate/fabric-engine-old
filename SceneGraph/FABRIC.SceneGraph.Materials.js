
//
// Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
//


FABRIC.SceneGraph.registerNodeType('Texture', {
  briefDesc: 'The Texture node is an Image node which can be used for texturing of a 3D object.',
  detailedDesc: 'The Texture node is an Image node which can be used for texturing of a 3D object.',
  parentNodeDesc: 'SceneGraphNode',
  factoryFn: function(options, scene) {
    var textureNode = scene.constructNode('SceneGraphNode', options);
    return textureNode;
  }});

  // TODO: The texture image type needs to be broken into LDR and HDR.
  // here we have HDR image loading mixed in with LDR image loading,
  // but it should be a separate type.
FABRIC.SceneGraph.registerNodeType('Image', {
  briefDesc: 'The Image node holds image data, and optionally creates an URL image loader and an OpenGL texture.',
  detailedDesc: 'The Image node holds generic image data (members: pixels, width, height), which might be HDR (member: hdr). ' +
                'If \'options.createResourceLoadNode\', an URL-based image loader will be incorporated, and currently supports ' +
                '.png, .tga, .exr and .hdr image formats. If \'options.createLoadTextureEventHandler\', an OpenGL texture ' +
                'will be created from the image.',
  parentNodeDesc: 'Texture',
  optionsDesc: {
    wantHDR: 'Set to true this flags enables the Image node to use float values instead if bytes.',
    wantRGBA: 'Set to true this flag enables the Image node to store the A channel.',
    createDgNode: 'If this is set to true the Image node will contain a dgnode to store the pixel data.',
    createResourceLoadNode: 'Set to true this flag will enable the Image node to load a texture off a resource load node.',
    createLoadTextureEventHandler: 'If the image uses a ResouceLoadNode and this flag is set, it will create an EventHandler for the Image being loaded.',
    width: 'The width of the empty Image',
    height: 'The height of the empty Image',
    color: 'The standard color for the empty Image',
    url: 'The URL to load the Image from',
    forceRefresh: 'If this is set, the Image will always be re-loaded onto the GPU. This is useful for animated Images.'
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
      wantHDR: false,
      wantRGBA: true,
      createDgNode: false,
      createResourceLoadNode: true,
      createLoadTextureEventHandler: true,
      initImage: true,
      width: 128,
      height: 128,
      color: FABRIC.RT.rgba(0.0,0.0,0.0,0.0),
      url: undefined,
      forceRefresh: false,
      glRepeat: true
    });
    
    var imageNode = scene.constructNode('Texture', options);
    if(options.createDgNode){
      var dgnode = imageNode.constructDGNode('DGNode')
      dgnode.addMember('hdr', 'Boolean', options.wantHDR);
      dgnode.addMember('width', 'Size', options.createResourceLoadNode ? undefined : options.width);
      dgnode.addMember('height', 'Size', options.createResourceLoadNode ? undefined : options.height);
      dgnode.addMember('pixels', (options.wantHDR ? 'Color' : (options.wantRGBA ? 'RGBA' : 'RGB')) + '[]');
  
      imageNode.addMemberInterface(dgnode, 'width');
      imageNode.addMemberInterface(dgnode, 'height');
    }

    if (options.createResourceLoadNode) {
      var resourceLoadNode = scene.constructNode('ResourceLoad', options);
      var resourceloaddgnode = resourceLoadNode.getDGLoadNode();
      if(options.createDgNode){
        dgnode.setDependency(resourceloaddgnode, 'resource');
        dgnode.bindings.append(scene.constructOperator({
          operatorName: (options.wantHDR ? 'loadImageHDR' : 'loadImageLDR'),
          parameterLayout: [
            'resource.resource',
            'self.width',
            'self.height',
            'self.pixels'
          ],
          entryFunctionName: (options.wantHDR ? 'loadImageHDR' : 'loadImageLDR'),
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadTexture.kl'
        }));
      };

      imageNode.pub.getResourceLoadNode = function() {
        return resourceLoadNode.pub;
      };

      imageNode.pub.isImageLoaded = function() {
        return resourceLoadNode ? resourceLoadNode.pub.isLoaded() : false;
      };
    } else {
      if(options.createDgNode && options.initImage && options.width && options.height){
        dgnode.addMember('color', 'RGBA', options.color);
        dgnode.addMember('initiated', 'Boolean', false);
        dgnode.bindings.append(scene.constructOperator({
          operatorName: 'initImageFromColor',
          parameterLayout: [
            'self.width',
            'self.height',
            'self.color',
            'self.pixels',
            'self.initiated'
          ],
          entryFunctionName: 'initImageFromColor',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadTexture.kl'
        }));
      };
    }

    if (options.createLoadTextureEventHandler) {
      // Construct the handler for loading the image into texture memory.
      var redrawEventHandler = imageNode.constructEventHandlerNode('Redraw');
      var oglTexture = options.wantHDR ? FABRIC.RT.oglTexture2D_Color() : FABRIC.RT.oglTexture2D();
      if(!options.glRepeat) {
        oglTexture.wrapS = FABRIC.SceneGraph.OpenGLConstants.GL_CLAMP;
        oglTexture.wrapT = FABRIC.SceneGraph.OpenGLConstants.GL_CLAMP;
      }
      oglTexture.forceRefresh = options.forceRefresh;
      redrawEventHandler.addMember('oglTexture2D', 'OGLTexture2D', oglTexture);
      if(options.createDgNode){
        redrawEventHandler.setScope('image', dgnode);
        redrawEventHandler.preDescendBindings.append(scene.constructOperator({
          operatorName: 'bindTexture' + (options.wantHDR ? 'HDR' : 'LDR'),
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadTexture.kl',
          entryFunctionName: 'bindTexture' + (options.wantHDR ? 'HDR' : 'LDR'),
          parameterLayout: [
            'image.width',
            'image.height',
            'image.pixels',
            'self.oglTexture2D',
            'textureStub.textureUnit'
          ]
        }));
      }
      else if(options.createResourceLoadNode){
        redrawEventHandler.setScope('resource', resourceloaddgnode);
        redrawEventHandler.preDescendBindings.append(scene.constructOperator({
          operatorName: 'loadAndBindTextureLDR',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadTexture.kl',
          entryFunctionName: 'loadAndBindTextureLDR',
          parameterLayout: [
            'resource.resource',
            'self.oglTexture2D',
            'textureStub.textureUnit'
          ]
        }));
      }
    }

    imageNode.pub.getURL = function() {
      return resourceLoadNode ? resourceLoadNode.pub.getUrl() : '';
    };

    return imageNode;
  }});

FABRIC.SceneGraph.registerNodeType('Image3D', {
  briefDesc: 'The Image node holds 3D image data, and optionally creates an URL image loader and an OpenGL texture.',
  detailedDesc: 'The Image node holds generic image data (members: pixels, width, height, depth), which might be color or grayscale, LDR or HDR. ' +
                'If \'options.createResourceLoadNode\', an URL-based image loader will be incorporated, and currently supports ' +
                '(todo) image formats. If \'options.createLoadTextureEventHandler\', an OpenGL 3D texture ' +
                'will be created from the image.',
  parentNodeDesc: 'Texture',
  optionsDesc: {
    format: 'Pixel format. Currently supported: RGBA, UShort, Byte, Color, Scalar.',
    createDgNode: 'If this is set to true the Image node will contain a dgnode to store the pixel data.',
    createResourceLoadNode: 'Set to true this flag will enable the Image node to load a texture off a resource load node.',
    createLoadTextureEventHandler: 'If the image uses a ResouceLoadNode and this flag is set, it will create an EventHandler for the Image being loaded.',
    width: 'The width of the empty Image',
    height: 'The height of the empty Image',
    depth: 'The depth of the empty Image',
    color: 'The standard color for the empty Image',
    resourceTargetTransformNode: 'If loaded from resource, set the resource-stored transfo to that node',
    url: 'The URL to load the Image from'
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
      format: 'UShort',
      createDgNode: true,
      createResourceLoadNode: true,
      createLoadTextureEventHandler: true,
      initImage: true,
      width: 16,
      height: 16,
      depth: 16,
      url: undefined,
      glRepeat: true
    });
    if(options.color === undefined) {
      if(options.format === 'RGBA')
        options.color = new FABRIC.RT.RGBA(0,0,0,0);
      else if(options.format === 'Color')
        options.color = new FABRIC.RT.Color(0,0,0,0);
      else
        options.color = 0;
    }
    
    var imageNode = scene.constructNode('Texture', options);
    if(options.createDgNode){
      var dgnode = imageNode.constructDGNode('DGNode')
      dgnode.addMember('width', 'Size', options.width);
      dgnode.addMember('height', 'Size', options.height);
      dgnode.addMember('depth', 'Size', options.depth);
      if(options.format === 'UShort')
        dgnode.addMember('pixels', 'Byte[]');
      else
        dgnode.addMember('pixels', options.format + '[]');
  
      imageNode.addMemberInterface(dgnode, 'width');
      imageNode.addMemberInterface(dgnode, 'height');
      imageNode.addMemberInterface(dgnode, 'depth');
    }

    if (options.createResourceLoadNode) {
      if(options.format !== 'UShort')
        throw ('Only UShort 3D textures are currently supported');

      var resourceLoadNode = scene.constructNode('ResourceLoad', options);
      var resourceloaddgnode = resourceLoadNode.getDGLoadNode();
      if(options.createDgNode){
        dgnode.addMember('xfoMat', 'Mat44');
        dgnode.setDependency(resourceloaddgnode, 'resource');
        dgnode.bindings.append(scene.constructOperator({
          operatorName: 'load3DImageUShortData',
          parameterLayout: [
            'resource.resource',
            'self.width',
            'self.height',
            'self.depth',
            'self.pixels',
            'self.xfoMat'
          ],
          entryFunctionName: 'load3DImageUShortData',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/load3DTexture.kl'
        }));

        if(options.resourceTargetTransformNode) {
          var resourceTargetTransformNode = scene.getPrivateInterface(options.resourceTargetTransformNode);
          var resourceTargetTransformDGNode = resourceTargetTransformNode.getDGNode();
          resourceTargetTransformDGNode.setDependency(dgnode, 'image3DSource');
          resourceTargetTransformDGNode.bindings.insert(scene.constructOperator({
            operatorName: 'setFromImage3DSource',
            parameterLayout: [
              'image3DSource.xfoMat',
              'self.globalXfo'
            ],
            entryFunctionName: 'setFromImage3DSource',
            srcCode: 'use Xfo; operator setFromImage3DSource(io Mat44 src, io Xfo dst){dst.setFromMat44(src);}'
          }),0);

        }
      };

      imageNode.pub.getResourceLoadNode = function() {
        return resourceLoadNode.pub;
      };

      imageNode.pub.isImageLoaded = function() {
        return resourceLoadNode ? resourceLoadNode.pub.isLoaded() : false;
      };
    } else {
      if(options.createDgNode && options.initImage && options.width && options.height && options.depth){
        if(options.format === 'UShort')
          dgnode.addMember('color', 'Byte', options.color);
        else
          dgnode.addMember('color', options.format, options.color);
        dgnode.addMember('initiated', 'Boolean', false);
        dgnode.bindings.append(scene.constructOperator({
          operatorName: 'initImageFrom' + options.format,
          parameterLayout: [
            'self.width',
            'self.height',
            'self.depth',
            'self.color',
            'self.pixels',
            'self.initiated'
          ],
          entryFunctionName: 'initImageFrom' + options.format,
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/load3DTexture.kl'
        }));
      };
    }

    if (options.createLoadTextureEventHandler) {
      // Construct the handler for loading the image into texture memory.
      var redrawEventHandler = imageNode.constructEventHandlerNode('Redraw');
      var oglTexture;

      if(options.format === 'Byte')
         oglTexture = FABRIC.RT.oglTexture3D_Byte();
      else if(options.format === 'Color')
         oglTexture = FABRIC.RT.oglTexture3D_Color();
      else if(options.format === 'Scalar')
         oglTexture = FABRIC.RT.oglTexture3D_Scalar();
      else if(options.format === 'UShort')
         oglTexture = FABRIC.RT.oglTexture3D_UShort();
      else
         oglTexture = FABRIC.RT.oglTexture3D_RGBA();

      if(!options.glRepeat) {
        oglTexture.wrapS = FABRIC.SceneGraph.OpenGLConstants.GL_CLAMP;
        oglTexture.wrapT = FABRIC.SceneGraph.OpenGLConstants.GL_CLAMP;
        oglTexture.wrapR = FABRIC.SceneGraph.OpenGLConstants.GL_CLAMP;
      }
      redrawEventHandler.addMember('oglTexture3D', 'OGLTexture3D', oglTexture);
      if(options.createDgNode){
        redrawEventHandler.setScope('image', dgnode);
        redrawEventHandler.preDescendBindings.append(scene.constructOperator({
          operatorName: 'bind' + options.format + 'Texture3D',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/load3DTexture.kl',
          entryFunctionName: 'bind' + options.format + 'Texture3D',
          parameterLayout: [
            'image.width',
            'image.height',
            'image.depth',
            'image.pixels',
            'self.oglTexture3D',
            'textureStub.textureUnit'
          ]
        }));
      }
      else if(options.createResourceLoadNode){
        redrawEventHandler.setScope('resource', resourceloaddgnode);
        redrawEventHandler.preDescendBindings.append(scene.constructOperator({
          operatorName: 'loadAndBindUShortTexture',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/load3DTexture.kl',
          entryFunctionName: 'loadAndBindUShortTexture',
          parameterLayout: [
            'resource.resource',
            'self.oglTexture3D',
            'textureStub.textureUnit'
          ]
        }));
      }
    }

    imageNode.pub.getURL = function() {
      return resourceLoadNode ? resourceLoadNode.pub.getUrl() : '';
    };

    return imageNode;
  }});

FABRIC.SceneGraph.registerNodeType('CubeMap', {
  briefDesc: 'The CubeMap node contains 6 Image nodes which can be used to texture with cubic mapping. ',
  detailedDesc: 'The CubeMap node contains 6 Image nodes which can be used to texture with cubic mapping. ' +
                'This means it requires six images to be aligned in a cubic fashion.',
  parentNodeDesc: 'Texture',
  optionsDesc: {
    urls: 'An array of six URLs to the six images to load.',
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
      urls: []
    });
    
    var cubMapNode = scene.constructNode('Texture', options);
    var redrawEventHandler = cubMapNode.constructEventHandlerNode('Redraw');
    redrawEventHandler.addMember('cubeMap', 'OGLTextureCube', FABRIC.RT.cubeMapLDR());
    
    var createTextureLoaderNode = function(url, faceId){
      var resourceLoadNode = scene.constructNode('ResourceLoad', { url: url });
      var resourceloaddgnode = resourceLoadNode.getDGLoadNode();
      redrawEventHandler.setScope('resource'+faceId, resourceloaddgnode);
    }
    createTextureLoaderNode(options.urls[0], 0);
    createTextureLoaderNode(options.urls[1], 1);
    createTextureLoaderNode(options.urls[2], 2);
    createTextureLoaderNode(options.urls[3], 3);
    createTextureLoaderNode(options.urls[4], 4);
    createTextureLoaderNode(options.urls[5], 5);

    redrawEventHandler.preDescendBindings.append(scene.constructOperator({
        operatorName: 'bindCubeMap',
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadCubeMap.kl',
        entryFunctionName: 'bindCubeMap',
        parameterLayout: [
          'resource0.resource',
          'resource1.resource',
          'resource2.resource',
          'resource3.resource',
          'resource4.resource',
          'resource5.resource',
          'self.cubeMap',
          'textureStub.textureUnit'
        ]
      }));
    return cubMapNode;
  }});

FABRIC.SceneGraph.registerNodeType('Video', {
  briefDesc: 'The Video node is an Image node that changes over time.',
  detailedDesc: 'The Video node uses the ffmpeg extension to load animated video footage into an Image node. ' +
                'For that the image content is repeatedly copied onto the GPU.',
  parentNodeDesc: 'Image',
  optionsDesc: {
    localFileName: 'The Video node currently only supports a local filename, not an URL.',
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
        url: '',
        loop: false,
        nbCachedFrames: 0,
        animationControllerNode: undefined
      });

    // ensure to use the right settings for video
    options.createResourceLoadNode = true;
    options.createLoadTextureEventHandler = false;
    options.createDgNode = false;
    options.initImage = false;
    options.wantHDR = false;
    options.wantRGBA = false;

    // check if we have an url
    if (!options.url) {
        throw ('You need to specify a valid url for a video node!');
    }

    var videoNode = scene.constructNode('Image', options);
    // add all members
    var dgnode = scene.getPrivateInterface(videoNode.pub.getResourceLoadNode()).getDGLoadNode();
    dgnode.addMember('handle', 'VideoHandle');
    dgnode.addMember('pixels', 'RGB[]');

    videoNode.addMemberInterface(dgnode, 'handle');
  
    // decode the resource
    dgnode.bindings.append(scene.constructOperator({
      operatorName: 'videoLoadResource',
      srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadVideo.kl',
      entryFunctionName: 'videoLoadResource',
      parameterLayout: [
        'self.resource',
        'self.handle'
      ]
    }));

    // make it dependent on the scene time
    var timeBinding = 'globals.time';
    if(options.loop || options.animationControllerNode)
    {
      // use the options animation controller
      var animationController = undefined;
      if(options.animationControllerNode)
      {
        animationController = scene.getPrivateInterface(options.animationControllerNode);
        var animationControllerDGNode = animationController.getDGNode();
        dgnode.setDependency(animationControllerDGNode, 'controller');
      }
      else
      {
        animationController = scene.constructNode('AnimationController');
        var animationControllerDGNode = animationController.getDGNode();
        dgnode.setDependency(animationControllerDGNode, 'controller');
        dgnode.bindings.append(scene.constructOperator({
          operatorName: 'videoSetTimeRange',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadVideo.kl',
          entryFunctionName: 'videoSetTimeRange',
          parameterLayout: [
            'self.handle',
            'controller.timeRange',
          ]
        }));
      }
      videoNode.pub.getAnimationController = function(){
        return animationController.pub;
      };
      timeBinding = 'controller.localTime';
    }
    else
      dgnode.setDependency(scene.getGlobalsNode(), 'globals');

    // use a dict for storing the already parsed frames
    dgnode.addMember('pixelCache','RGB[][]')
    dgnode.addMember('pixelCacheIndex','Integer[]')
    dgnode.addMember('pixelCacheLimit','Integer',options.nbCachedFrames)
    
    dgnode.bindings.append(scene.constructOperator({
      operatorName: 'videoSeekTimeCached',
      srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadVideo.kl',
      entryFunctionName: 'videoSeekTime',
      parameterLayout: [
        'self.handle',
        timeBinding,
        'self.pixels',
        'self.pixelCache',
        'self.pixelCacheIndex',
        'self.pixelCacheLimit'
      ]
    }));

    var redrawEventHandler = videoNode.constructEventHandlerNode('Redraw');
    redrawEventHandler.setScope('video', dgnode);
    redrawEventHandler.addMember('bufferID', 'Size', 0);
    redrawEventHandler.preDescendBindings.append(scene.constructOperator({
        operatorName: 'videoLoadToGPU',
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadVideo.kl',
        entryFunctionName: 'videoLoadToGPU',
        parameterLayout: [
          'video.handle',
          'video.pixels',
          'self.bufferID',
          'textureStub.textureUnit'
        ]
    }));
    
    // extend public interface
    videoNode.pub.forceEvaluate = function(){
      dgnode.evaluate();
    };
    videoNode.pub.getDuration = function(){
      return dgnode.getData("duration");
    };
    videoNode.pub.getFps = function(){
      return dgnode.getData("fps");
    };

    return videoNode;
  }});

FABRIC.SceneGraph.registerNodeType('PointSpriteTexture', {
  briefDesc: 'The PointSpriteTexture is an Image node that can be used to texture a point using a sprite.',
  detailedDesc: 'The PointSpriteTexture is an Image node that can be used to texture a point using a sprite. ' +
                'You can specify the resolution of the sprite.',
  parentNodeDesc: 'Texture',
  optionsDesc: {
    spriteResolution: 'The resolution of the sprite texture.',
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
        spriteResolution: 32
      });
    
    var pointSpriteTextureNode = scene.constructNode('Texture', options);
    
    var dgnode = pointSpriteTextureNode.constructDGNode('DGNode');
    dgnode.addMember('resolution', 'Integer', options.spriteResolution);

    var redrawEventHandler = pointSpriteTextureNode.constructEventHandlerNode('Redraw');
    redrawEventHandler.setScope('image', dgnode);
    redrawEventHandler.addMember('bufferID', 'Size', 0);
    redrawEventHandler.preDescendBindings.append(scene.constructOperator({
            operatorName: 'createSpriteTexture',
            srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadTexture.kl',
            entryFunctionName: 'createSpriteTexture',
            parameterLayout: [
              'image.resolution',
              'self.bufferID',
              'textureStub.textureUnit'
            ]
          }));

    return pointSpriteTextureNode;
  }});


/**
 * Table storing all of the known shader attributes and their types.
 */
FABRIC.SceneGraph.getShaderParamID = ( function(){
  var paramCount = 0;
  var paramMap = {};
  return function(name){
    if(paramMap[name]){
      return paramMap[name];
    }
    else{
      paramCount++;
      paramMap[name] = paramCount;
      return paramCount;
    }
  }
})();


FABRIC.SceneGraph.registerNodeType('Shader', {
  briefDesc: 'The Shader node is used to load a GLSL shader onto the GPU.',
  detailedDesc: 'The Shader node is used to load a GLSL shader onto the GPU. ' +
                'It provides access to the uniforms of the GLSL shader. Shaders node are re-used to ensure ' +
                'maximum performance as well as low memory use.',
  parentNodeDesc: 'SceneGraphNode',
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
        parentEventHandler: scene.getSceneRedrawOpaqueObjectsEventHandler(),
        debug: false,
        unloadShader: true
      });
    var shaderNode = scene.constructNode('SceneGraphNode', options),
      redrawEventHandler = shaderNode.constructEventHandlerNode('Redraw'),
      shaderProgram = new FABRIC.RT.OGLShaderProgram(options.name);
      i;
    
    redrawEventHandler.setScopeName('shader');

    if (options.fragmentShader) {
      shaderProgram.shaderSources.push(new FABRIC.RT.OGLShaderSource(
        options.fragmentShader, FABRIC.SceneGraph.OpenGLConstants.GL_FRAGMENT_SHADER));
    }
    if (options.vertexShader) {
      shaderProgram.shaderSources.push(new FABRIC.RT.OGLShaderSource(
        options.vertexShader, FABRIC.SceneGraph.OpenGLConstants.GL_VERTEX_SHADER));
    }
    if (options.tessControlShader) {
      shaderProgram.shaderSources.push(new FABRIC.RT.OGLShaderSource(
        options.tessControlShader, FABRIC.SceneGraph.OpenGLConstants.GL_TESS_CONTROL_SHADER));
    }
    if (options.tessEvalShader) {
      shaderProgram.shaderSources.push(new FABRIC.RT.OGLShaderSource(
        options.tessEvalShader, FABRIC.SceneGraph.OpenGLConstants.GL_TESS_EVALUATION_SHADER));
    }
    if (options.geometryShader) {
      shaderProgram.shaderSources.push(new FABRIC.RT.OGLShaderSource(
        options.geometryShader, FABRIC.SceneGraph.OpenGLConstants.GL_GEOMETRY_SHADER_EXT));
    }
    
    ///////////////////////////////////////////////////
    // Uniform Values
    for (i in options.shaderUniforms) {
      shaderProgram.uniformValues.push(new FABRIC.RT.OGLShaderValue(
        options.shaderUniforms[i].name, FABRIC.SceneGraph.getShaderParamID(i)));
    }

    ///////////////////////////////////////////////////
    // Attribute Values
    var attributeValues = [];
    for (i in options.shaderAttributes) {
      shaderProgram.attributeValues.push(new FABRIC.RT.OGLShaderValue(
        options.shaderAttributes[i].name, FABRIC.SceneGraph.getShaderParamID(i)));
    }

    ///////////////////////////////////////////////////
    // Enable Options
    if(options.disableOptions){
      shaderProgram.disableOptions = options.disableOptions;
    }
    if(options.enableOptions){
      shaderProgram.enableOptions = options.enableOptions;
    }
    if(options.blendModeSfactor){
      shaderProgram.blendModeSfactor = options.blendModeSfactor;
    }
    if(options.blendModeDfactor){
      shaderProgram.blendModeDfactor = options.blendModeDfactor;
    }
    if(options.cullFace){
      shaderProgram.cullFace = options.cullFace;
    }
    
    ///////////////////////////////////////////////////
    // EXT Params
    for (i in options.programParams) {
       shaderProgram.programParams.push(new FABRIC.RT.OGLShaderProgramParam(
        FABRIC.SceneGraph.OpenGLConstants[i], options.programParams[i]));
    }
    
    ///////////////////////////////////////////////////
    // Draw Params
    if(options.drawParams) {
      if(options.drawParams.drawMode){
        shaderProgram.drawMode = FABRIC.SceneGraph.OpenGLConstants[options.drawParams.drawMode];
      }
      if(options.drawParams.patchVertices){
        shaderProgram.patchVertices = options.drawParams.patchVertices;
      }
    }
    
    shaderProgram.debug = options.debug;
    redrawEventHandler.addMember('shaderProgram', 'OGLShaderProgram', shaderProgram);
  
    var loadShaderOp = scene.constructOperator({
      operatorName: 'loadShader',
      srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadShader.kl',
      entryFunctionName: 'loadShader',
      parameterLayout: [
        'self.shaderProgram'
      ]
    });
    
    if(options.assignUniformsOnPostDescend == true){
      // Post Processing operators invoke the shader on the post
      // decent pass. After the geometry in the sub tree is drawn.
      redrawEventHandler.postDescendBindings.append(loadShaderOp);
    }else{
      redrawEventHandler.preDescendBindings.append(loadShaderOp);
    }
    
    // Note: This optimization causes the lamborgini scene to crash
    // after a few seconds. The OpenGL stack is probably overflowing.
    // Ideally we don't need this when we aren't changing options.
  /*  if((options.disableOptions &&
        options.disableOptions.length > 0) ||
       (options.enableOptions &&
        options.enableOptions.length > 0)){
  */  redrawEventHandler.postDescendBindings.append(scene.constructOperator({
        operatorName: 'unloadShader',
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadShader.kl',
        entryFunctionName: 'unloadShader',
        parameterLayout: [
          'self.shaderProgram'
        ]
      }));
// }
    
    if (options.parentEventHandler !== false) {
      // The shader is registered with the scenegraph, which will
      // handle passing render events to the shader from the cameras.
      options.parentEventHandler.appendChildEventHandler(redrawEventHandler);
    }
    
    shaderNode.getVBORequirements = function() {
      return options.shaderAttributes;
    };
    return shaderNode;
  }}
);



FABRIC.SceneGraph.registerNodeType('Material', {
  briefDesc: 'The Material node is the base node for all Materials.',
  detailedDesc: 'The Material node is the base node for all Materials. It should not be used directly, ' +
                'rather through other Material presets such as \'FlatMaterial\' for example.',
  parentNodeDesc: 'SceneGraphNode',
  optionsDesc: {
    separateShaderNode: 'If set to true, this will allow to create a separate shader node for optimizing performance.',
    shaderNode: 'If specified, use the given shaderNode instead of creating a new one.',
    storeUniformsInDGNode: 'If set to true, the uniforms of the shader will be stored in a separate uniforms dgnode.',
    assignUniformsOnPostDescend: 'If set to true the uniforms will be assigned on the post descend of the event handler.'
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
        separateShaderNode: true,
        shaderNode: undefined,
        storeUniformsInDGNode: false,
        assignUniformsOnPostDescend: false
      });

    var materialNode,
      dgnode,
      redrawEventHandler,
      materialType = options.type,
      shader,
      i;

    if(options.drawOverlaid){
      options.disableOptions = (options.disableOptions ? options.disableOptions : []);
      if(options.disableOptions.indexOf(FABRIC.SceneGraph.OpenGLConstants.GL_DEPTH_TEST) == -1){
        options.disableOptions.push(FABRIC.SceneGraph.OpenGLConstants.GL_DEPTH_TEST);
      }
      options.parentEventHandler = scene.getSceneRedrawOverlayObjectsEventHandler();
      options.shaderNameDecoration = (options.shaderNameDecoration ? options.shaderNameDecoration : "") + "Overlay";
    }
        
    if (options.separateShaderNode) {
      if(options.shaderNode){
        shader = options.shaderNode;
      }
      else{
      
        var shaderName = materialType + 'Shader' + (options.shaderNameDecoration !== undefined ?
                                                options.shaderNameDecoration : '');
  
        shader = scene.constructShaderNode(shaderName, {
          name: shaderName,
          fragmentShader: options.fragmentShader,
          vertexShader: options.vertexShader,
          tessControlShader: options.tessControlShader,
          tessEvalShader: options.tessEvalShader,
          geometryShader: options.geometryShader,
          shaderUniforms: options.shaderUniforms,
          shaderAttributes: options.shaderAttributes,
          programParams: options.programParams,
          drawParams: options.drawParams,
          disableOptions: options.disableOptions,
          enableOptions: options.enableOptions,
          cullFace: options.cullFace,
          blendModeSfactor: options.blendModeSfactor,
          blendModeDfactor: options.blendModeDfactor,
          parentEventHandler: options.parentEventHandler,
          assignUniformsOnPostDescend: options.assignUniformsOnPostDescend,
          debug: options.debug
        });
      }
      
      materialNode = scene.constructNode('SceneGraphNode', options);
      redrawEventHandler = materialNode.constructEventHandlerNode('Redraw');

      shader.getRedrawEventHandler().appendChildEventHandler(redrawEventHandler);

      materialNode.getShaderNode = function() {
        return shader;
      };
      materialNode.getVBORequirements = function() {
        return shader.getVBORequirements();
      };
    }
    else {
      // The shader and the material properties are stored in the same node.
      // we simply extend the shader with the material paramters. 
      materialNode = scene.constructNode('Shader', options);
      redrawEventHandler = materialNode.getRedrawEventHandler();
    }

    var capitalizeFirstLetter = function(str) {
      return str[0].toUpperCase() + str.substr(1);
    };
    
    /////////////////////////////////
    // Material uniform interface definition.
    // Here we expose define members on our dgnode to store
    // the material uniforms, and apply operators to load those
    // values during render traversial.
    var operators = redrawEventHandler.preDescendBindings;
    if(options.assignUniformsOnPostDescend===true){
      operators = redrawEventHandler.postDescendBindings;
    }
    for (var uniformName in options.shaderUniforms) {
      var uniform = options.shaderUniforms[uniformName];
      // TODO: generalize a method for looking up uniform values from 'known owners'.
      if (uniform.owner !== undefined && uniform.owner !== 'window') {
        continue;
      }
      var uniformOwner;
      if (uniform.owner === undefined) {
        if(options.storeUniformsInDGNode){
          if(!dgnode){
            dgnode = materialNode.constructDGNode('DGNode');
            redrawEventHandler.setScope('material', dgnode);
          }
          dgnode.addMember(uniformName, uniform.type, uniform.defaultValue);
          materialNode.addMemberInterface(dgnode, uniformName, true);
          uniformOwner = 'material';
        }
        else{
          redrawEventHandler.addMember(uniformName, uniform.type, uniform.defaultValue);
          materialNode.addMemberInterface(redrawEventHandler, uniformName, true);
          uniformOwner = 'self';
        }
      }else{
        uniformOwner = uniform.owner;
      }
      
      operators.append(scene.constructOperator({
        operatorName: 'load' + capitalizeFirstLetter(uniformName),
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadUniforms.kl',
        preProcessorDefinitions: {
          ATTRIBUTE_NAME: uniformName,
          ATTRIBUTE_ID: FABRIC.SceneGraph.getShaderParamID(uniformName),
          DATA_TYPE: uniform.type
        },
        entryFunctionName: 'loadUniform',
        parameterLayout: [
          (options.separateShaderNode ? 'shader.shaderProgram' : 'self.shaderProgram'),
          uniformOwner + '.' + uniformName
        ]
      }));
    }

    if (options.lights) {
      var addLightInterface = function(lightName, lightDef) {
        var lightStub = materialNode.constructEventHandlerNode('Draw_' + lightName);
        redrawEventHandler.appendChildEventHandler(lightStub);
        
        var setLightNodeFn = function(node) {
          if (!node.isTypeOf(lightDef.type)) {
            throw ('Incorrect type assignment. Must assign a ' + lightDef.type);
          }
          node = scene.getPrivateInterface(node);
          lightStub.appendChildEventHandler(node.getRedrawEventHandler());
        };
        materialNode.pub['set' + capitalizeFirstLetter(lightName) + 'Node'] = setLightNodeFn;
        if (lightDef.node !== undefined) {
          setLightNodeFn(lightDef.node);
        }
      };
      for (i in options.lights) {
        addLightInterface(i, options.lights[i]);
      }
    }
    if (options.textures) {
      var addTextureInterface = function(textureName, textureDef, textureUnit) {
        var textureStub = materialNode.constructEventHandlerNode(textureName + '_Stub');
        textureStub.setScopeName('textureStub');
        textureStub.addMember('textureUnit', 'Integer', textureUnit);
        redrawEventHandler.appendChildEventHandler(textureStub);
        
        textureStub.preDescendBindings.append(scene.constructOperator({
          operatorName: 'load' + textureName + 'TextureUnit',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadUniforms.kl',
          preProcessorDefinitions: {
            ATTRIBUTE_NAME: capitalizeFirstLetter(textureName),
            ATTRIBUTE_ID: FABRIC.SceneGraph.getShaderParamID(textureName),
            DATA_TYPE: 'Integer'
          },
          entryFunctionName: 'loadUniform',
          parameterLayout: [
            'shader.shaderProgram',
            'self.textureUnit'
          ]
        }));

        // Now add a method to assign the texture to the material
        var setTextureFn = function(node) {
          if (!node.isTypeOf('Texture')) {
            throw ('Incorrect type assignment. Must assign a Texture');
          }
          node = scene.getPrivateInterface(node);
          textureStub.appendChildEventHandler(node.getRedrawEventHandler());
        };
        materialNode.pub['set' + capitalizeFirstLetter(textureName) + 'Node'] = setTextureFn;

        if (textureDef.node !== undefined) {
          setTextureFn(textureDef.node);
        }
      };
      var textureUnit = 0;
      for (i in options.textures) {
        if (options.textures[i].owner !== undefined) {
          continue;
        }
        addTextureInterface(i, options.textures[i], textureUnit);
        textureUnit++;
      }
      
      redrawEventHandler.addMember('numTextures', 'Size', textureUnit);
      redrawEventHandler.postDescendBindings.append(scene.constructOperator({
        operatorName: 'unbindTextures',
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/loadTexture.kl',
        entryFunctionName: 'unbindTextures',
        parameterLayout: [
          'self.numTextures'
        ]
      }));
    }
    
    return materialNode;
  }});


FABRIC.SceneGraph.registerNodeType('PointMaterial', {
  briefDesc: 'The PointMaterial node is a prototype for materials for points.',
  detailedDesc: 'The PointMaterial node is a prototype for materials for points. It introduces a new ' +
                'uniform, the pointSize, which can be used to draw points.',
  parentNodeDesc: 'Material',
  optionsDesc: {
    pointSize: 'The size of the drawn points.'
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
        pointSize: 3.0
      });

    var pointMaterial = scene.constructNode('Material', options);
    var dgnode;
    if(pointMaterial.getDGNode){
      dgnode = pointMaterial.getDGNode();
    }
    else{
      dgnode = pointMaterial.constructDGNode('DGNode');
      pointMaterial.getRedrawEventHandler().setScope('material', dgnode);
    }
    dgnode.addMember('pointSize', 'Scalar', options.pointSize);
    pointMaterial.addMemberInterface(dgnode, 'pointSize', true);

    // Note: this method of setting the point size is probably obsolete.
    // TODO: Define a new effect and use material uniforms.
    pointMaterial.getRedrawEventHandler().preDescendBindings.append(scene.constructOperator({
        operatorName: 'setPointSize',
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/drawPoints.kl',
        entryFunctionName: 'setPointSize',
        parameterLayout: ['material.pointSize']
      }));
    return pointMaterial;
  }});


FABRIC.SceneGraph.registerNodeType('PointSpriteMaterial', {
  briefDesc: 'The PointSpriteMaterial allows to draw sprites for each point in a Points node.',
  detailedDesc: 'The PointSpriteMaterial allows to draw sprites for each point in a Points node. This ' +
                'works both for shaders using positions as vec4 as well as vec3.',
  parentNodeDesc: 'Material',
  optionsDesc: {
    pointSize: 'The size of the drawn points.',
    positionsVec4: 'If set to true, the shader\'s positions attribute is expected to be vec4, otherwise vec3.'
  },
  factoryFn: function(options, scene) {

    scene.assignDefaults(options, {
        pointSize: 5,
        positionsVec4:false
      });

    var pointSpriteTextureNode = options.spriteTextureNode;
    if (pointSpriteTextureNode === undefined) {
      pointSpriteTextureNode = scene.constructNode('PointSpriteTexture');
    }
    options.shaderUniforms = {
      modelViewProjectionMatrix: { name: 'u_modelViewProjectionMatrix', owner: 'instance' },
      modelViewMatrix: { name: 'u_modelViewMatrix', owner: 'instance' },
      spriteTexture: { name: 'u_splatSampler', owner: 'texture' }
    };
    options.shaderAttributes = {
      vertexColors: { name: 'a_color' },
      positions: { name: 'a_position' }
    };
    
    options.textures = {
      spriteTexture: { node: pointSpriteTextureNode.pub }
    };
    options.vertexShader = FABRIC.loadResourceURL('FABRIC_ROOT/SceneGraph/Shaders/PointSpriteVertexShader.glsl');
    options.fragmentShader = FABRIC.loadResourceURL('FABRIC_ROOT/SceneGraph/Shaders/PointSpriteFragmentShader.glsl');

    var pointSpriteMaterialNode = scene.constructNode('Material', options);
    
    // TODO: Stop using fixed function pipeline calls. Use Geometry shaders
    var redrawEventHandler = pointSpriteMaterialNode.getRedrawEventHandler();
    redrawEventHandler.addMember('pointSize', 'Scalar', options.pointSize);
    pointSpriteMaterialNode.addMemberInterface(redrawEventHandler, 'pointSize', true);
    
    redrawEventHandler.preDescendBindings.append(scene.constructOperator({
        operatorName: 'preDrawSpritePoints',
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/drawPoints.kl',
        entryFunctionName: 'preDrawSpritePoints',
        parameterLayout: ['self.pointSize']
      }));
    redrawEventHandler.postDescendBindings.append(scene.constructOperator({
        operatorName: 'postDrawSpritePoints',
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/drawPoints.kl',
        entryFunctionName: 'postDrawSpritePoints',
        parameterLayout: []
      }));

    return pointSpriteMaterialNode;
  }});


FABRIC.SceneGraph.registerNodeType('ShadowMapMaterial', {
  briefDesc: 'The ShadowMapMaterial allows to draw a shadow.',
  detailedDesc: 'The ShadowMapMaterial allows to draw a shadow. This is used when working with shadow maps.',
  parentNodeDesc: 'Material',
  factoryFn: function(options, scene) {
    options.parentEventHandler = scene.getBeginRenderShadowMapEventHandler();
    var shadowMapMaterial = scene.constructNode('Material', options);
    return shadowMapMaterial;
  }});

FABRIC.SceneGraph.registerNodeType('TransparentMaterial', {
  briefDesc: 'The TransparentMaterial is a protoype for all transparent materials.',
  detailedDesc: 'The TransparentMaterial is a protoype for all transparent materials. It uses a different redraw event handler' +
                ' to ensure that the transparent objects are drawn last.',
  parentNodeDesc: 'Material',
  factoryFn: function(options, scene) {
    options.parentEventHandler = scene.getSceneRedrawTransparentObjectsEventHandler();
    var transparentMaterial = scene.constructNode('Material', options);
    return transparentMaterial;
  }});


FABRIC.SceneGraph.registerNodeType('PostProcessEffect', {
  briefDesc: 'The PostProcessEffect node allows to compute an effect after the drawing of the viewport.',
  detailedDesc: 'The PostProcessEffect node allows to compute an effect after the drawing of the viewport. It utilizes a GLSL shader which operates ' +
                'on the framebuffer of the main viewport.',
  parentNodeDesc: 'Material',
  optionsDesc: {
    fragmentShader: 'The fragment shader to use for the post effect.',
    vertexShader: 'The optional vertex shader to use for the post effect.',
    shaderAttributes: 'The attributes of the shader to use.',
    shaderUniforms: 'The uniforms of the shader to the use.',
    renderTarget: 'The render target to use for this post process effect. By default this is a new rendertarget.'
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
        fragmentShader: undefined,
        vertexShader: undefined,
        shaderAttributes: undefined,
        shaderUniforms: undefined,
        parentEventHandler: false,
        separateShaderNode: false,
        assignUniformsOnPostDescend:true,
        renderTarget: FABRIC.RT.oglPostProcessingRenderTarget(0)
      });

    if (options.fragmentShader === undefined) {
      throw 'No pixel shader specified';
    }
    if (!options.vertexShader) {
      options.vertexShader =
        'attribute vec4 a_position;' +
        'attribute vec4 a_texCoord;' +
        'void main() {' +
        '  gl_TexCoord[0].st = a_texCoord.xy;' +
        '  gl_Position = a_position;' +
        '}';
    }

    options.shaderAttributes = scene.assignDefaults(options.shaderAttributes, {
      positions: { name: 'a_position' },
      uvs0: { name: 'a_texCoord' }
    });
    options.shaderUniforms = scene.assignDefaults(options.shaderUniforms, {
      fboTexture: { name: 'u_rgbaImage', owner: 'fbo' }
    });

    var postProcessEffect = scene.constructNode('Material', options);
    var redrawEventHandler = postProcessEffect.getRedrawEventHandler();

    // Set up FBO rendering and draw the textured quad on the way back
    redrawEventHandler.addMember('renderTarget', 'OGLRenderTarget', options.renderTarget);
    
    redrawEventHandler.preDescendBindings.append(
      scene.constructOperator({
          operatorName: 'bindScreenRenderTarget',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/renderTarget.kl',
          entryFunctionName: 'bindScreenRenderTarget',
          parameterLayout: [
            'window.width',
            'window.height',
            'self.renderTarget'
          ]
        }));
    redrawEventHandler.postDescendBindings.insert(
      scene.constructOperator({
          operatorName: 'unbindRenderTarget',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/renderTarget.kl',
          entryFunctionName: 'unbindRenderTarget',
          parameterLayout: [
            'self.renderTarget'
          ]
        }), 0);
    redrawEventHandler.postDescendBindings.append(
      scene.constructOperator({
          operatorName: 'drawRenderTargetToView',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/renderTarget.kl',
          entryFunctionName: 'drawRenderTargetToView',
          parameterLayout: [
            'self.renderTarget',
            'self.shaderProgram'
          ]
        }));
    return postProcessEffect;
  }}
);

/**
 * Function to create an effect based on an
 * effect xml file.
 * @param {string} effectfile The path to the xml file.
 */
FABRIC.SceneGraph.defineEffectFromFile = function(effectName, effectfile) {
  
  var preprocessorDirectives,
      effectParameters,
      separateShaderNode = false;
  
  var parseEffectFile = function(){
    var xmlText,
      parser,
      xmlDoc,
      xmlRoot,
      effectFilePathArray,
      effectFilePath,
      collectUniforms,
      collectAttributes,
      collectLights,
      collectTextures,
      collectProgramParams,
      collectPreprocessorDirectives,
      collectShaderSource,
      len,
      i,
      childNode;
      
    preprocessorDirectives = {};
    effectParameters = {
      prototypeMaterialType: 'Material',
      separateShaderNode:false
    };
  
    xmlText = FABRIC.loadResourceURL(effectfile, 'text/xml');
    parser = new DOMParser();
    xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    xmlRoot = xmlDoc.firstChild;
    effectFilePathArray = effectfile.split('/');
    effectFilePathArray.pop();
    effectFilePath = effectFilePathArray.join('/') + '/';
  
    if (xmlRoot.nodeName !== 'shader') {
      throw ':XML file must define a shader.';
    }
  
    collectUniforms = function(node) {
      var len, j, uniformNode, uniformName;
      effectParameters.shaderUniforms = {};
      len = node.childNodes.length;
      for (j = 0; j < len; j++) {
        if (node.childNodes[j].nodeName === '#text') {
          continue;
        }
        uniformNode = node.childNodes[j];
        uniformName = uniformNode.getAttribute('constant');
        effectParameters.shaderUniforms[uniformName] = {
          name: uniformNode.getAttribute('name')
        };
        if (uniformNode.getAttribute('type')) {
          effectParameters.shaderUniforms[uniformName].type = uniformNode.getAttribute('type');
        }else{
          throw 'missing type information :' + uniformName + ' in effect file :' + effectfile;
        }
        if (uniformNode.getAttribute('defaultValue')) {
          effectParameters.shaderUniforms[uniformName].defaultValue = eval(uniformNode.getAttribute('defaultValue'));
        }
        if (uniformNode.getAttribute('owner')) {
          effectParameters.shaderUniforms[uniformName].owner = uniformNode.getAttribute('owner');
        }else{
          effectParameters.separateShaderNode = true;
        }
        if (uniformNode.getAttribute('state')) {
          effectParameters.shaderUniforms[uniformName].state = uniformNode.getAttribute('state');
        }
      }
    };
  
    collectAttributes = function(node) {
      var len, j, attributeNode;
      effectParameters.shaderAttributes = {};
      len = node.childNodes.length;
      for (j = 0; j < len; j++) {
        if (node.childNodes[j].nodeName === '#text') {
          continue;
        }
        attributeNode = node.childNodes[j];
        effectParameters.shaderAttributes[attributeNode.getAttribute('binding')] = {
          name: attributeNode.getAttribute('name')
        };
      }
    };
  
    collectLights = function(node) {
      var len, j, lightNode;
      effectParameters.lights = {};
      len = node.childNodes.length;
      for (j = 0; j < len; j++) {
        if (node.childNodes[j].nodeName === '#text') {
          continue;
        }
        lightNode = node.childNodes[j];
        effectParameters.lights[lightNode.getAttribute('binding')] = {
          type: lightNode.getAttribute('type')
        };
        if (lightNode.getAttribute('shadowMap')) {
          effectParameters.lights[lightNode.getAttribute('binding')].shadowMap = lightNode.getAttribute('shadowMap');
        }
      }
    };
  
    collectTextures = function(node) {
      var len, j, textureNode, textureName;
      effectParameters.textures = {};
      len = node.childNodes.length;
      for (j = 0; j < len; j++) {
        if (node.childNodes[j].nodeName === '#text') {
          continue;
        }
        textureNode = node.childNodes[j];
        textureName = textureNode.getAttribute('binding');
        effectParameters.textures[textureName] = {
          name: textureName
        };
        if (textureNode.getAttribute('owner')) {
          effectParameters.textures[textureName].owner = textureNode.getAttribute('owner');
        }
      }
    };
  
    collectProgramParams = function(node) {
      var len, j, paramNode, paramValue;
      effectParameters.programParams = {};
      len = node.childNodes.length;
      for (j = 0; j < len; j++) {
        if (node.childNodes[j].nodeName === '#text') {
          continue;
        }
        paramNode = node.childNodes[j];
        paramValue = paramNode.getAttribute('value');
        if (isNaN(parseInt(paramValue, 10))) {
          effectParameters.programParams[paramNode.getAttribute('name')] = FABRIC.SceneGraph.OpenGLConstants[paramValue];
        }
        else {
          effectParameters.programParams[paramNode.getAttribute('name')] = parseInt(paramValue, 10);
        }
      }
    };
  
    collectDrawParams = function(node) {
      var len, j, paramNode;
      effectParameters.drawParams = {};
      len = node.childNodes.length;
      for (j = 0; j < len; j++) {
        paramNode = node.childNodes[j];
        switch (node.childNodes[j].nodeName ) {
          case '#text':
            continue;
          case 'drawMode':
            effectParameters.drawParams.drawMode = paramNode.getAttribute('value');
            break;
          case 'patchVertices':
            effectParameters.drawParams.patchVertices = parseInt(paramNode.getAttribute('value'));
            break;
        }
      }
    };
    
    collectOGLStateParams = function(node) {
      var collectParamArray = function(node) {
        var len, j, paramNode;
        var vals = [];
        len = node.childNodes.length;
        for (j = 0; j < len; j++) {
          paramNode = node.childNodes[j];
          switch (paramNode.nodeName ) {
            case '#text':
              continue;
            default:
              vals.push(FABRIC.SceneGraph.OpenGLConstants[paramNode.firstChild.data]);
              break;
          }
        }
        return vals;
      }
      
      var len, j, paramNode, paramValue;
      effectParameters.drawParams = {};
      len = node.childNodes.length;
      for (j = 0; j < len; j++) {
        paramNode = node.childNodes[j];
        switch (paramNode.nodeName ) {
          case '#text':
            continue;
          case 'disableOptions':
            effectParameters.disableOptions = collectParamArray(paramNode);
            break;
          case 'enableOptions':
            effectParameters.enableOptions = collectParamArray(paramNode);
            break;
          case 'cullFace':
            effectParameters.cullFace = FABRIC.SceneGraph.OpenGLConstants[paramNode.firstChild.data];
            break;
          case 'blendModeSfactor':
            effectParameters.blendModeSfactor = FABRIC.SceneGraph.OpenGLConstants[paramNode.firstChild.data];
            break;
          case 'blendModeDfactor':
            effectParameters.blendModeDfactor = FABRIC.SceneGraph.OpenGLConstants[paramNode.firstChild.data];
            break;
        }
      }
    };
  
    collectPreprocessorDirectives = function(node) {
      var len, j, directiveNode;
      len = node.childNodes.length;
      for (j = 0; j < len; j++) {
        if (node.childNodes[j].nodeName === '#text') {
          continue;
        }
        directiveNode = node.childNodes[j];
        preprocessorDirectives[directiveNode.getAttribute('binding')] = directiveNode.getAttribute('name');
      }
    };
  
    collectShaderSource = function(node) {
      var len, j, source = '';
      len = node.childNodes.length;
      for (j = 0; j < len; j++) {
        if (node.childNodes[j].nodeName === 'source') {
          source = source + node.childNodes[j].textContent;
        }
        if (node.childNodes[j].nodeName === 'include') {
          // Included file paths are relative to the effect file.
          var path = node.childNodes[j].getAttribute('file');
          if (path.split('/')[0] !== 'FABRIC_ROOT') {
            path = effectFilePath + path;
          }
          source = source + FABRIC.loadResourceURL(path, 'text/plain');
        }
      }
      return source;
    };
  
    len = xmlRoot.childNodes.length;
    for (i = 0; i < len; i++) {
      childNode = xmlRoot.childNodes[i];
      switch (childNode.nodeName) {
        case '#text':
          continue;
        case 'name':
          effectParameters.name = childNode.firstChild.data;
          break;
        case 'prototypeMaterialType':
          effectParameters.prototypeMaterialType = childNode.firstChild.data;
          break;
        case 'uniforms':
          collectUniforms(childNode);
          break;
        case 'attributes':
          collectAttributes(childNode);
          break;
        case 'lights':
          collectLights(childNode);
          break;
        case 'textures':
          collectTextures(childNode);
          break;
        case 'programParams':
          collectProgramParams(childNode);
          break;
        case 'drawParams':
          collectDrawParams(childNode);
          break;
        case 'openglstateparams':
          collectOGLStateParams(childNode);
          break;
        case 'preprocessordirectives':
          collectPreprocessorDirectives(childNode);
          break;
        case 'vertexshader':
          effectParameters.vertexShader = collectShaderSource(childNode);
          break;
        case 'tesscontrolshader':
          effectParameters.tessControlShader = collectShaderSource(childNode);
          break;
        case 'tessevalshader':
          effectParameters.tessEvalShader = collectShaderSource(childNode);
          break;
        case 'geometryshader':
          effectParameters.geometryShader = collectShaderSource(childNode);
          break;
        case 'fragmentshader':
          effectParameters.fragmentShader = collectShaderSource(childNode);
          break;
        default:
          console.warn(effectfile + ': Unhandled Effect Parameter:' + childNode.nodeName);
      }
    }
  }

  FABRIC.SceneGraph.registerNodeType(effectName, {
    briefDesc: 'The '+effectName+' node is a xml based GLSL shader.',
    detailedDesc: 'The '+effectName+' GLSL shader is implemented in "'+effectfile+'".',
    factoryFn: function(options, scene) {
      if(!effectParameters){
        parseEffectFile();
      }
      scene.assignDefaults(options, effectParameters);
      var directives = {},
        preProcessCode = false,
        i,
        materialNode,
        uniformName,
        lightName,
        textureName,
        setterName;

      directives = {};
      preProcessCode = false;
      for (i in preprocessorDirectives) {
        if (!options[i]) {
          throw ('Error costructing ' + effectParameters.name + '. ' +
                 'Preprocessor directive not defined:' + preprocessorDirectives[i]);
        }
        directives[preprocessorDirectives[i]] = options[i];
        preProcessCode = true;
      }
      if (preProcessCode) {
        if (effectParameters.vertexShader) {
          options.vertexShader = FABRIC.preProcessCode(effectParameters.vertexShader, directives);
        }
        if (effectParameters.tessControlShader) {
          options.tessControlShader = FABRIC.preProcessCode(effectParameters.tessControlShader, directives);
        }
        if (effectParameters.tessEvalShader) {
          options.tessEvalShader = FABRIC.preProcessCode(effectParameters.tessEvalShader, directives);
        }
        if (effectParameters.geometryShader) {
          options.geometryShader = FABRIC.preProcessCode(effectParameters.geometryShader, directives);
        }
        if (effectParameters.fragmentShader) {
          options.fragmentShader = FABRIC.preProcessCode(effectParameters.fragmentShader, directives);
        }
        options.shaderNameDecoration = '';
        for (i in directives) {
          options.shaderNameDecoration = options.shaderNameDecoration + i + directives[i];
        }
      }

      materialNode = scene.constructNode(options.prototypeMaterialType, options);
      
      var capitalizeFirstLetter = function(str) {
        return str[0].toUpperCase() + str.substr(1);
      };
      for (uniformName in effectParameters.shaderUniforms) {
        if (options[uniformName] != undefined && materialNode.pub['set' + capitalizeFirstLetter(uniformName)]) {
          materialNode.pub['set' + capitalizeFirstLetter(uniformName)](options[uniformName]);
        }
      }
      for (lightName in effectParameters.lights) {
        if (options[lightName + 'Node'] && materialNode.pub['set' + capitalizeFirstLetter(lightName) + 'Node']) {
          materialNode.pub['set' + capitalizeFirstLetter(lightName) + 'Node'](options[lightName + 'Node']);
        }
      }
      for (textureName in effectParameters.textures) {
        if (options[textureName + 'Node']) {
          materialNode.pub['set' + capitalizeFirstLetter(textureName) + 'Node'](options[textureName + 'Node']);
        }
      }
      return materialNode;
    }});
};

FABRIC.SceneGraph.defineEffectFromFile('EmptyMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/EmptyShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('FlatMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/FlatShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('FlatPerInstanceMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/FlatPerInstanceShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('FlatScreenSpaceMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/FlatScreenSpaceShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('PhongMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('ShadowMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/ShadowMapShader.xml');

FABRIC.SceneGraph.defineEffectFromFile('FlatTextureMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/FlatTextureShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('FlatUVMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/FlatUVShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('FlatBlendTextureMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/FlatBlendTextureShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('PhongInstancingMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongInstancingShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('PhongInstancingExtMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongInstancingExtShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('PhongTextureMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongTextureShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('PhongTextureSimpleMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongTextureShaderSimple.xml');
FABRIC.SceneGraph.defineEffectFromFile('PhongBumpReflectMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongBumpReflectShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('PhongSkinningMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongSkinningShader.xml');

FABRIC.SceneGraph.defineEffectFromFile('ShadowReceivingPhongMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/ShadowReceivingPhongShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('PhongBumpReflectSkinningMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongBumpReflectSkinningShader.xml');

FABRIC.SceneGraph.defineEffectFromFile('VertexColorMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/VertexColorShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('PhongVertexColorMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongVertexColorShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('NormalMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/NormalShader.xml');

FABRIC.SceneGraph.defineEffectFromFile('PhongTesselationMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongTesselationShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('HairMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/HairShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('HairTextureMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/HairTextureShader.xml');

FABRIC.SceneGraph.defineEffectFromFile('PhongReflectMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PhongReflectShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('GlassMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/GlassShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('WireframeMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/WireframeShader.xml');

FABRIC.SceneGraph.defineEffectFromFile('OutlineShader', 'FABRIC_ROOT/SceneGraph/Shaders/OutlineShader.xml');

FABRIC.SceneGraph.defineEffectFromFile('PointFlatMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/PointFlatShader.xml');
FABRIC.SceneGraph.defineEffectFromFile('FlatGradientMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/FlatGradientShader.xml');

FABRIC.SceneGraph.defineEffectFromFile('VolumeMaterial', 'FABRIC_ROOT/SceneGraph/Shaders/VolumeShader.xml');


FABRIC.SceneGraph.registerNodeType('BloomPostProcessEffect', {
  briefDesc: 'The BloomPostProcessEffect node draws a bloom effect after the viewport has been drawn.',
  detailedDesc: 'The BloomPostProcessEffect node draws a bloom effect after the viewport has been drawn.',
  parentNodeDesc: 'PostProcessEffect',
  factoryFn: function(options, scene) {
    options.fragmentShader = FABRIC.loadResourceURL('FABRIC_ROOT/SceneGraph/Shaders/BloomPixelShader.glsl');

    var bloomPostProcessEffect = scene.constructNode('PostProcessEffect', options);
    return bloomPostProcessEffect;
  }});


FABRIC.SceneGraph.registerNodeType('FilmicTonemapperPostProcessEffect', {
  briefDesc: 'The FilmicTonemapperPostProcessEffect node draws a filmic tone mapping effect after the viewport has been drawn.',
  detailedDesc: 'The FilmicTonemapperPostProcessEffect node draws a filmic tone mapping effect after the viewport has been drawn.',
  parentNodeDesc: 'PostProcessEffect',
  factoryFn: function(options, scene) {
    options.fragmentShader = FABRIC.loadResourceURL('FABRIC_ROOT/SceneGraph/Shaders/FilmicTonemapper.glsl');

    var filmicTonemapperEffect = scene.constructNode('PostProcessEffect', options);
    return filmicTonemapperEffect;
  }});


FABRIC.SceneGraph.registerNodeType('EdgeDetectionPostProcessEffect', {
  briefDesc: 'The EdgeDetectionPostProcessEffect node draws an edge detection filter effect after the viewport has been drawn.',
  detailedDesc: 'The EdgeDetectionPostProcessEffect node draws a edge detection filter effect after the viewport has been drawn.',
  parentNodeDesc: 'PostProcessEffect',
  factoryFn: function(options, scene) {
    options.fragmentShader = FABRIC.loadResourceURL('FABRIC_ROOT/SceneGraph/Shaders/EdgeDetectionPixelShader.glsl');

    options.shaderUniforms = {
      width: { name: 'u_width', owner: 'window', type:'Integer' },
      height: { name: 'u_height', owner: 'window', type:'Integer' },
      colorMix: { name: 'u_colorMix', type:'Scalar' }
    };

    var edgeDetectionEffect = scene.constructNode('PostProcessEffect', options);
    return edgeDetectionEffect;
  }});


FABRIC.SceneGraph.registerNodeType('GaussianBlurPostProcessEffect', {
  briefDesc: 'The GaussianBlurPostProcessEffect node draws a gaussian blur effect after the viewport has been drawn.',
  detailedDesc: 'The GaussianBlurPostProcessEffect node draws a gaussian blur effect after the viewport has been drawn.',
  parentNodeDesc: 'PostProcessEffect',
  factoryFn: function(options, scene) {
    options.fragmentShader = FABRIC.loadResourceURL('FABRIC_ROOT/SceneGraph/Shaders/GaussianBlurFragmentShader.glsl');

    options.shaderUniforms = {
      blurSize: { name: 'u_blurSize', defaultValue: 1.0 / 512.0, type:'Scalar' }
    };

    var edgeDetectionEffect = scene.constructNode('PostProcessEffect', options);
    return edgeDetectionEffect;
  }});

FABRIC.SceneGraph.registerNodeType('ScreenGrab', {
  briefDesc: 'The ScreenGrab node stores the viewport to an Image node.',
  detailedDesc: 'The ScreenGrab node stores the viewport to an Image node by encoding PNG using a ResourceLoadNode. ',
  parentNodeDesc: 'SceneGraphNode',
  factoryFn: function(options, scene) {
    //TO refine: right now this node is grabbing a screenshot constantly!
    //We should include a way to 'mute' and 'unmute' it. The problem
    //is how to know when it is filled with content; an event should be sent. Can
    //we do this without modifying the core?
    var screenGrabNode = scene.constructNode('SceneGraphNode', options),
    screenGrabEventHandler;

    screenGrabEventHandler = screenGrabNode.constructEventHandlerNode('ScreenGrab');
    screenGrabEventHandler.addMember('width', 'Size');
    screenGrabEventHandler.addMember('height', 'Size');
    screenGrabEventHandler.addMember('pixels', 'RGBA[]');
    screenGrabEventHandler.addMember('resource', 'FabricResource');

    screenGrabEventHandler.postDescendBindings.append(scene.constructOperator({
      operatorName: 'grabViewport',
      srcFile: 'FABRIC_ROOT/SceneGraph/KL/grabViewport.kl',
      entryFunctionName: 'grabViewport',
      parameterLayout: [
            'self.width',
            'self.height',
            'self.pixels'
          ]
    }));

    screenGrabEventHandler.postDescendBindings.append(scene.constructOperator({
      operatorName: 'encodeImage',
      srcFile: 'FABRIC_ROOT/SceneGraph/KL/encodeImage.kl',
      entryFunctionName: 'encodeImageLDR',
      parameterLayout: [
            'self.width',
            'self.height',
            'self.pixels',
            'self.resource'
          ]
    }));

    scene.getScenePostRedrawEventHandler().appendChildEventHandler(screenGrabEventHandler);

    screenGrabNode.pub.saveAs = function() {
      try {
          screenGrabEventHandler.putResourceToUserFile('resource', 'Save Screen Grab Image As...', undefined, 'fabricScreenGrab');
      }
      catch (e) { }
    };

    return screenGrabNode;
  }
});

FABRIC.SceneGraph.registerNodeType('VolumeOpacityInstance', {
  briefDesc: '',
  detailedDesc: '',
  parentNodeDesc: 'VolumeMaterial',
  optionsDesc: {
    opacityTextureNode: 'Image3D of UShorts containing a 3D opacity texture',
    gradientTextureNode: 'Optional (else, generated): Image3D of RGBA containing a gradient vector in RGB, plus a gradient weight in A' + 
                         'Gradient is basically a surface normal to be used for shading areas where the opacity changes, ' +
                         'and the gradient weight is the gradient amplitude (length); areas of constant opacity should have ' +
                         'a gradient weight of 0.',
    reducedGradientTexture: 'If true, the gradient texture will be 2X smaller than the opacity one, which is usually ok since it reduces ' +
                          'noise and makes the computations much faster.',
    smoothGradient: 'If true, a smoothing pass will be applied to the computed gradient (only if gradientTextureNode is undefined)',
    cropMin: '3D vector specifying the min cropping bbox coordinate (in the range 0..1 for X, Y, Z)',
    cropMax: '3D vector specifying the max cropping bbox coordinate (in the range 0..1 for X, Y, Z)',
    transformNode: 'Transform applied to the volume geometry.',
    viewportNode: 'Active viewport',
    lightNode: 'Active light',
    resolutionFactor: 'Resolution of the volume render, in the range 0.0 to 1.0, 1.0 being 2 slices per voxel slice',
    brightnessFactor: 'Brightness from 0 to 1',
    transparency: 'Transparency from 0 to 1',
    minOpacity: 'MinOpacity from 0 to 1',
    maxOpacity: 'MaxOpacity from 0 to 1',
    specularFactor: 'Specular amount from 0 to 1',
    backgroundColor: 'Background color',
    invertColor: 'Invert color: inverted if == 1'
  },
  factoryFn: function(options, scene) {

    scene.assignDefaults(options, {
      reducedGradientTexture: true,
      smoothGradient: true,
      resolutionFactor: 1.0,
      brightnessFactor: 0.5,
      transparency: 1.0,
      minOpacity: 0.0,
      maxOpacity: 1.0,
      specularFactor: 0.7,
      backgroundColor: new FABRIC.RT.Color(0,0,0,1),
      invertColor: 0
    });

    options.cameraNode = options.viewportNode.getCameraNode();

    var volumeNodePub = scene.pub.constructNode('VolumeSlices', options);
    var volumeNode = scene.getPrivateInterface(volumeNodePub);
    var opacityTextureDGNode = scene.getPrivateInterface(options.opacityTextureNode).getDGNode();

    volumeNode.getOpacityDGNode = function(){return opacityTextureDGNode;};
    volumeNode.pub.getOpacityNode = function(){return options.opacityTextureNode;};

    //Generate gradient if not available
    if(options.gradientTextureNode === undefined) {

      var sourceOpacityDGNodeForGradient = opacityTextureDGNode;

      if(options.reducedGradientTexture) {
        var generatorNodeOpacity = scene.constructNode('Image3D', {
          name: 'ReducedOpacity',
          format: 'UShort',
          createResourceLoadNode: false,
          createDgNode: true,
          glRepeat: false
        });
        var reducedOpacityDGNode = generatorNodeOpacity.getDGNode();
        reducedOpacityDGNode.setDependency(opacityTextureDGNode, 'opacity');
        reducedOpacityDGNode.bindings.append(scene.constructOperator({
          operatorName: 'reduceOpacityTexture',
          parameterLayout: [
            'opacity.width',
            'opacity.height',
            'opacity.depth',
            'opacity.pixels',
            'self.width',
            'self.height',
            'self.depth',
            'self.pixels'
          ],
          entryFunctionName: 'reduceOpacityTexture',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/generateVolumeSlices.kl'
        }));
        var sourceOpacityDGNodeForGradient = reducedOpacityDGNode;
      }

      //Here, to optimize, we will slice only in the image depth component, so we can still save a lot of common precomputation overhead
      var dgnodeSlicedGradient = volumeNode.constructDGNode('SlicedGradientDGNode');
      dgnodeSlicedGradient.addMember('sliceGradients', 'RGBA[]');
      dgnodeSlicedGradient.setDependency(sourceOpacityDGNodeForGradient, 'opacity');

      dgnodeSlicedGradient.bindings.append(scene.constructOperator({
        operatorName: 'initCount',
        parameterLayout: [
          'opacity.depth',
          'self.newCount'
        ],
        entryFunctionName: 'initCount',
        srcCode: 'operator initCount(io Size depth, io Size newCount){newCount = depth;}'
      }));

      dgnodeSlicedGradient.bindings.append(scene.constructOperator({
        operatorName: 'computeGradients_depthSliced',
        parameterLayout: [
          'opacity.width',
          'opacity.height',
          'opacity.depth',
          'opacity.pixels',
          'self.sliceGradients',
          'self.index'
        ],
        entryFunctionName: 'computeGradients_depthSliced',
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/generateVolumeSlices.kl'
      }));

      if(options.smoothGradient) {
        dgnodeSlicedGradient.addMember('smoothedSliceGradients', 'RGBA[]');
        dgnodeSlicedGradient.bindings.append(scene.constructOperator({
          operatorName: 'smoothGradients_depthSliced',
          parameterLayout: [
            'opacity.width',
            'opacity.height',
            'opacity.depth',
            'self.sliceGradients<>',
            'self.smoothedSliceGradients',
            'self.index'
          ],
          entryFunctionName: 'smoothGradients_depthSliced',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/generateVolumeSlices.kl'
        }));
      }

      var generatorNodeGradientPub = scene.pub.constructNode('Image3D', {
        name: '3DTextureGenerator_Gradient',
        format: 'RGBA',
        createResourceLoadNode: false,
        createDgNode: true,
        glRepeat: false
      });
      var generatorNodeGradient = scene.getPrivateInterface(generatorNodeGradientPub);
      var dgnodeGradient = generatorNodeGradient.getDGNode();
      dgnodeGradient.setDependency(sourceOpacityDGNodeForGradient, 'opacity');
      dgnodeGradient.setDependency(dgnodeSlicedGradient, 'slicedGradient');

      dgnodeGradient.bindings.append(scene.constructOperator({
        operatorName: 'setGradients',
        parameterLayout: [
          'opacity.width',
          'opacity.height',
          'opacity.depth',
          options.smoothGradient ? 'slicedGradient.smoothedSliceGradients<>' : 'slicedGradient.sliceGradients<>',
          'self.width',
          'self.height',
          'self.depth',
          'self.pixels'
        ],
        entryFunctionName: 'setGradients',
        srcCode: 'operator setGradients(io Size inW, io Size inH, io Size inD, io RGBA sliceGradients<>[], io Size W, io Size H, io Size D, io RGBA pixels[]) {\n' +
                                'W = inW; H = inH; D = inD;\n' +
                                'pixels.resize(W*H*D);\n' +
                                'Size dst = 0, i, j;\n' +
                                'for( i = 0; i < sliceGradients.size(); ++i ) {\n' +
                                '  Size nb = sliceGradients[i].size();\n' +
                                '  for( j = 0; j < nb; ++j ) {\n' +
                                '    pixels[dst++] = sliceGradients[i][j];\n' +
                                '  }\n' +
                                '}\n' +
                              '}\n'
      }));

      options.gradientTextureNode = generatorNodeGradientPub;

      volumeNode.getGradientDGNode = function(){return dgnodeGradient;};
      volumeNode.pub.getGradientTextureNode = function(){return generatorNodeGradientPub;};
    }

    var volumeUniformsDGNode = volumeNode.getUniformsDGNode();

    volumeUniformsDGNode.addMember('resolutionFactor', 'Scalar', options.resolutionFactor );
    volumeNode.addMemberInterface(volumeUniformsDGNode, 'resolutionFactor', true);

    volumeUniformsDGNode.setDependency(opacityTextureDGNode, 'opacityImage3D');
    volumeUniformsDGNode.bindings.append(scene.constructOperator({
      operatorName: 'setNbSlicesFrom3DImage',
      parameterLayout: [
        'self.resolutionFactor',
        'opacityImage3D.width',
        'opacityImage3D.height',
        'opacityImage3D.depth',
        'self.nbSlices'
      ],
      entryFunctionName: 'setNbSlicesFrom3DImage',
      srcFile: 'FABRIC_ROOT/SceneGraph/KL/generateVolumeSlices.kl'
    }));
    
    var offscreenNode = scene.constructNode('SceneGraphNode', { name: (options.name + "RT") } );
    var offscreenNodeRedrawEventHandler = offscreenNode.constructEventHandlerNode('Redraw');
    scene.getSceneRedrawTransparentObjectsEventHandler().appendChildEventHandler(offscreenNodeRedrawEventHandler);
    offscreenNodeRedrawEventHandler.addMember('renderTargetToViewShaderProgram', 'Integer');
    offscreenNodeRedrawEventHandler.addMember('renderTarget', 'OGLRenderTarget', FABRIC.RT.oglRenderTarget(0,0,[
      new FABRIC.RT.OGLRenderTargetTextureDesc (
          2,
          new FABRIC.RT.OGLTexture2D (
            FABRIC.SceneGraph.OpenGLConstants.GL_RGBA16,
            FABRIC.SceneGraph.OpenGLConstants.GL_RGBA,
            FABRIC.SceneGraph.OpenGLConstants.GL_FLOAT)
        )
    ]));
    
    offscreenNodeRedrawEventHandler.addMember('backgroundColor', 'Color', options.backgroundColor );
    offscreenNodeRedrawEventHandler.setScope('volumeUniforms', volumeUniformsDGNode);

    offscreenNodeRedrawEventHandler.preDescendBindings.append(
      scene.constructOperator({
          operatorName: 'setBackgroundColor',
          srcCode: 'use OGLRenderTarget; operator setBackgroundColor(io Color color, io OGLRenderTarget renderTarget){ renderTarget.clearColor = color; }',
          entryFunctionName: 'setBackgroundColor',
          parameterLayout: [
            'self.backgroundColor',
            'self.renderTarget'
          ]
        }));

    offscreenNodeRedrawEventHandler.preDescendBindings.append(
      scene.constructOperator({
          operatorName: 'setResolutionFactor',
          srcCode: 'use OGLRenderTarget; operator setResolutionFactor(io Scalar factor, io OGLRenderTarget renderTarget){ renderTarget.resolution = (factor < 0.95 ? factor : 1.0); }',
          entryFunctionName: 'setResolutionFactor',
          parameterLayout: [
            'volumeUniforms.resolutionFactor',
            'self.renderTarget'
          ]
        }));

    offscreenNodeRedrawEventHandler.preDescendBindings.append(
      scene.constructOperator({
          operatorName: 'bindScreenRenderTarget',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/renderTarget.kl',
          entryFunctionName: 'bindScreenRenderTarget',
          parameterLayout: [
            'window.width',
            'window.height',
            'self.renderTarget'
          ]
        }));

    offscreenNodeRedrawEventHandler.postDescendBindings.insert(
      scene.constructOperator({
          operatorName: 'unbindRenderTarget',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/renderTarget.kl',
          entryFunctionName: 'unbindRenderTarget',
          parameterLayout: [
            'self.renderTarget'
          ]
        }), 0);

    offscreenNodeRedrawEventHandler.postDescendBindings.append(
      scene.constructOperator({
          operatorName: 'drawVolumeRenderTargetToView',
          srcFile: 'FABRIC_ROOT/SceneGraph/KL/renderTarget.kl',
          entryFunctionName: 'drawRenderTargetToView_progID',
          parameterLayout: [
            'self.renderTarget',
            'self.renderTargetToViewShaderProgram'
          ]
        }));

    //Create transfer function images
    var transferFunctionImageNode = scene.constructNode('Image', {
      wantHDR: true,
      createDgNode: true,
      createResourceLoadNode: false,
      createLoadTextureEventHandler: true,
      width: 1024,
      height: 2,
      forceRefresh: true,
      initImage: false,
      glRepeat: false
    });
    var transferFunctionImageDGNode = transferFunctionImageNode.getDGNode();
    
    transferFunctionImageDGNode.addMember('minOpacity', 'Scalar', options.minOpacity);
    transferFunctionImageDGNode.addMember('maxOpacity', 'Scalar', options.maxOpacity);
    volumeNode.addMemberInterface(transferFunctionImageDGNode, 'minOpacity', true);
    volumeNode.addMemberInterface(transferFunctionImageDGNode, 'maxOpacity', true);
    
    if(options.opacityFactorsNode && options.opacityColorsNode){
      var opacityFactorsNode = scene.getPrivateInterface(options.opacityFactorsNode);
      transferFunctionImageDGNode.setDependency(opacityFactorsNode.getDGNode(), 'opacityFactors');
      var opacityColorsNode = scene.getPrivateInterface(options.opacityColorsNode);
      transferFunctionImageDGNode.setDependency(opacityColorsNode.getDGNode(), 'opacityColors');
      
      transferFunctionImageDGNode.bindings.append(scene.constructOperator({
        operatorName: 'updateTransferFunctionImage',
        parameterLayout: [
          'self.minOpacity',
          'self.maxOpacity',
          'opacityFactors.value<>',
          'opacityColors.value<>',
          'self.pixels'
        ],
        entryFunctionName: 'updateTransferFunctionImage',
        srcFile: 'FABRIC_ROOT/SceneGraph/KL/generateVolumeSlices.kl'
      }));
    }

    var volumeMaterialNodePub = scene.pub.constructNode('VolumeMaterial', {
        parentEventHandler: offscreenNodeRedrawEventHandler,
        opacityTextureNode: options.opacityTextureNode,
        gradientTextureNode: options.gradientTextureNode,
        transferFunctionTextureNode: transferFunctionImageNode.pub,
        lightNode: options.lightNode
    });

    var volumeMaterialNode = scene.getPrivateInterface(volumeMaterialNodePub);
    var volumeMaterialNodeRedrawEvent = volumeMaterialNode.getRedrawEventHandler();
    volumeMaterialNodeRedrawEvent.setScope('volumeUniforms', volumeUniformsDGNode);

    volumeMaterialNodeRedrawEvent.addMember('specularFactor', 'Scalar', options.specularFactor );
    volumeMaterialNodeRedrawEvent.addMember('brightnessFactor', 'Scalar', options.brightnessFactor );

    volumeNode.addMemberInterface(volumeMaterialNodeRedrawEvent, 'transparency', true);
    volumeNode.addMemberInterface(volumeMaterialNodeRedrawEvent, 'specularFactor', true);
    volumeNode.addMemberInterface(volumeMaterialNodeRedrawEvent, 'brightnessFactor', true);
    volumeNode.addMemberInterface(volumeMaterialNodeRedrawEvent, 'invertColor', true);
    volumeNode.addMemberInterface(offscreenNodeRedrawEventHandler, 'backgroundColor', true);

    volumeNode.pub.setTransparency(options.transparency);
    volumeNode.pub.setInvertColor(options.invertColor);

    volumeMaterialNodeRedrawEvent.preDescendBindings.append(scene.constructOperator({
      operatorName: 'setFactors',
      srcCode: 'operator setFactors(io Integer invertColor, io Scalar specular, io Scalar brightnessFactor, io Scalar transparency, io Size nbSlices, io Scalar alphaFactor, io Scalar scaledSpecular, io Scalar brightness){ \n' +
                    'scaledSpecular = 1.00001 / (1.00001 - specular) - 1.0;\n' +
                    'scaledSpecular *= scaledSpecular;\n' +
                    'brightness = 1.00001 / (1.00001 - (invertColor == 0 ? brightnessFactor : 1.0 - brightnessFactor)) - 1.0;\n' +
                    'Scalar ajustedBrightness = 0.5;//transparency*sqrt(brightness) + (1.0-transparency)*brightness;\n' +
                    'Scalar opacityPerSlice = 1.0 / Scalar(nbSlices);\n' +
                    'Scalar brightnessExp = log( opacityPerSlice ) / log( 0.5 );' + //We modulate by an exponential function else all the interesting values are close to brightness 0.5
                    'Scalar ajustedAlphaPerSlice = pow( ajustedBrightness, brightnessExp);' +
                    'alphaFactor = ajustedAlphaPerSlice / (1.0 - pow(ajustedAlphaPerSlice, Scalar(nbSlices))*0.99999);}\n',
      entryFunctionName: 'setFactors',
      parameterLayout: [
        'self.invertColor',
        'self.specularFactor',
        'self.brightnessFactor',
        'self.transparency',
        'volumeUniforms.nbSlices',
        'self.alphaFactor',
        'self.scaledSpecularFactor',
        'self.brightness'
      ]
    }));

    var instanceNode = scene.constructNode('Instance', {
        transformNode: options.transformNode,
        geometryNode: volumeNodePub,
        materialNode: volumeMaterialNodePub
    });

    return volumeNode;
  }
});

