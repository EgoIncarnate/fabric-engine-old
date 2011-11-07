
var constructCurveEditor = function(domRootID, animationLibraryNode, options){
  
  var keyColor = FABRIC.rgb(.0, .0, .0);
  
  options = options ? options : {};
  options.timeStripe = options.timeStripe!=undefined ? options.timeStripe : true;
  options.draggable = options.draggable!=undefined ? options.draggable : true;
  options.zoomable = options.zoomable!=undefined ? options.zoomable : true;
  options.timeRange = options.timeRange!=undefined ? options.timeRange : new FABRIC.Vec2(0, 100);
  trackSetId =  options.trackSetId!=undefined ? options.trackSetId : 0;
  
  var valueRange = options.valueRange!=undefined ? options.valueRange : new FABRIC.Vec2(0, 1);
  var clampValues = options.clampValues!=undefined ? options.clampValues : false;
  
  var rootDomNode = document.getElementById(domRootID);
  var windowWidth = rootDomNode.clientWidth;
  var windowHeight = rootDomNode.clientHeight;
  var isBezier = animationLibraryNode.isTypeOf('BezierKeyAnimationLibrary');
  
  var svgRoot = FABRIC.createSVGRootElem(domRootID);
  if(options.volumerenderdemohack){
    svgRoot.attr('style', "position:relative; top:-"+windowHeight+"px;z-index:0");
  }
  

  var graphBGRect = svgRoot.createRect().size(windowWidth, windowHeight).addClass('EventCatcher');
  var graphCenterGroup = svgRoot.createGroup().id('graphCenterGroup').translate(0, windowHeight * 0.5);
  var curvesHolderGroup = graphCenterGroup.createGroup().id('curvesHolderGroup')
  var keysHolderGroup = graphCenterGroup.createGroup().id('keysHolderGroup');
  svgRoot.svgRoot = svgRoot;
  svgRoot.state = 'Normal';
  
  
  
  var containmentRect;
  if(clampValues){
    containmentRect = graphCenterGroup.createRect().size(windowWidth, windowHeight).translate(0, windowHeight * -0.5);;
    containmentRect.attr('fill', 'none');
    containmentRect.attr('stroke', "black");
    containmentRect.attr('stroke-width', 2);
  }
  ///////////////
  tracksData = animationLibraryNode.getTrackSet(trackSetId);
  var trackCount = tracksData.tracks.length;
  var timeRange = new FABRIC.Vec2(0, 0);
  var yRange = new FABRIC.Vec2(0, 0);
  curvesData = [];
  var trackCurves = [];
  trackDisplayNode = scene.constructNode('TrackDisplay', {
      animationLibraryNode: animationLibraryNode,
      trackSetId: trackSetId
    });
  
  for (var i = 0; i < trackCount; i++) {
    var trackData = tracksData.tracks[i];
    $('#keyframeTracks').append('<div style="margin-top:10px;">' + trackData.name + '</div>');
    trackCurves[i] = curvesHolderGroup.createPath().addClass('CurvePath').stroke(trackData.color);
  }
  

  if(clampValues){
    yRange = valueRange;
  }

  var screenXfo = {
    tr: new FABRIC.Vec2(0, 0),
    sc: new FABRIC.Vec2(1, 1),
    fitToScreen:function(){
      for (var i = 0; i < trackCount; i++) {
        var keys = tracksData.tracks[i].keys;
        if(keys.length <= 1){
          continue;
        }
        if (timeRange.x > keys[0].time) {
          timeRange.x = keys[0].time;
        }
        if (timeRange.y < keys[keys.length - 1].time) {
          timeRange.y = keys[keys.length - 1].time;
        }
      }
      var getCurveYRange = function(curveData) {
        if(clampValues){
          yRange = valueRange;
          return;
        }
        for (var i = 1; i < curveData.length; i++) {
          if (yRange.x > curveData[i]) {
            yRange.x = curveData[i];
          }
          if (yRange.y < curveData[i]) {
            yRange.y = curveData[i];
          }
        }
      }
      trackDisplayNode.setTimeRange(timeRange);
      curvesData = trackDisplayNode.getCurveData();
      for (var i = 0; i < trackCount; i++) {
        if(i==0){
          yRange = new FABRIC.Vec2(curvesData.values[i][0], curvesData.values[i][0]);
        }
        getCurveYRange(curvesData.values[i]);
      }
      
      if(clampValues){
        this.sc = new FABRIC.Vec2(windowWidth/(timeRange.y - timeRange.x), -(windowHeight) / (yRange.y - yRange.x));
      }else{
        this.sc = new FABRIC.Vec2(windowWidth/(timeRange.y - timeRange.x), -(windowHeight - 40) / (yRange.y - yRange.x));
      }
      this.tr = new FABRIC.Vec2(-timeRange.x, (yRange.y + yRange.x) * -0.5);
    },
    update: function(){
      this.sc.x = windowWidth / (timeRange.y - timeRange.x);
    },
    toScreenSpace: function(val, local){
      if(local){
        return val.multiply(this.sc);
      }else{
        return val.add(this.tr).multiply(this.sc);
      }
    },
    toGraphSpace: function(val, local){
      if(local){
        return val.multiply(this.sc.inverse());
      }else{
        return val.multiply(this.sc.inverse()).subtract(this.tr);
      }
    }
  }
  screenXfo.fitToScreen();
  
  var drawTrackCurves = function(){
    var drawTrackCurve = function(trackIndex) {
      var setPathCurveValues = function(curveData) {
        var val = screenXfo.toScreenSpace(new FABRIC.Vec2(0, curveData[0]))
        var path = ['M', val.x, val.y, 'L', 100, 100, 300, 200];
        for (var i = 0; i < curveData.length; i++) {
          var t = ((i/curveData.length)*(timeRange.y - timeRange.x))+timeRange.x;
          val = screenXfo.toScreenSpace(new FABRIC.Vec2(t, curveData[i]));
          path[(i * 2) + 4] = val.x;
          path[(i * 2) + 5] = val.y;
        }
        trackCurves[trackIndex].attr('d', path.join(' '));
      }
      setPathCurveValues(curvesData.values[trackIndex]);
  
      var updateCurve = function() {
        curvesData = trackDisplayNode.getCurveData();
        setPathCurveValues(curvesData.values[trackIndex]);
      }
  
      var drawKey = function(keyIndex, keyData) {
        
        if(isBezier ? ((keyData.time + keyData.intangent.x) < timeRange.y &&
           (keyData.time + keyData.outtangent.x) >= timeRange.x) :
           keyData.time <= timeRange.y && keyData.time >= timeRange.x ){
          ///////////////////////////////////////////////
          // Key
          var keySsVal = screenXfo.toScreenSpace(new FABRIC.Vec2(keyData.time, keyData.value));
          // When keyframes are manipulated, we can maintain the tangent lengths
          // by storing the relative lengths, and gradients. Then, during manipulation
          // we maintain these relative lengths and gradients. This simplifies the
          // keyframes, by moving the complexity into the manipulation system.
          var prevKey = trackData.keys[keyIndex-1],
              nextKey = trackData.keys[keyIndex+1],
              tangentNormalizedValues = [];
          var keyGroupNode = keysHolderGroup.createGroup().translate(keySsVal)
            .draggable({ mouseButton: 0, containment:containmentRect })
            .addOnDragBeginCallback(
              function(evt){
                var deltat, i=0;
                if(keyIndex > 0){
                  deltat = keyData.time - prevKey.time;
                  if(isBezier) {
                    tangentNormalizedValues[i++] = prevKey.outtangent.x / deltat;
                    tangentNormalizedValues[i++] = prevKey.outtangent.y / prevKey.outtangent.x;
                    tangentNormalizedValues[i++] = keyData.intangent.x / deltat;
                    tangentNormalizedValues[i++] = keyData.intangent.y / keyData.intangent.x;
                  }
                }
                if(keyIndex < trackData.keys.length-1){;
                  deltat = nextKey.time - keyData.time;
                  if(isBezier) {
                    tangentNormalizedValues[i++] = keyData.outtangent.x / deltat;
                    tangentNormalizedValues[i++] = keyData.outtangent.y / keyData.outtangent.x;
                    tangentNormalizedValues[i++] = nextKey.intangent.x / deltat;
                    tangentNormalizedValues[i++] = nextKey.intangent.y / nextKey.intangent.x;
                  }
                }
            })
            .addOnDragCallback(
              function(evt) {
                var keyGsVal = screenXfo.toGraphSpace(evt.localPos);
                keyData.time = keyGsVal.x;
                keyData.value = keyGsVal.y;
                var deltat, i=0;
                if(keyIndex > 0){
                  deltat = keyData.time - prevKey.time;
                  if(isBezier) {
                    prevKey.outtangent.x = deltat * tangentNormalizedValues[i++];
                    prevKey.outtangent.y = prevKey.outtangent.x * tangentNormalizedValues[i++];
                    keyData.intangent.x = deltat * tangentNormalizedValues[i++];
                    keyData.intangent.y = keyData.intangent.x * tangentNormalizedValues[i++];
                    prevKey.setOutTan(prevKey.outtangent, true);
                    keyData.setInTan(keyData.intangent);
                  }
                }
                if(keyIndex < trackData.keys.length-1){
                  deltat = nextKey.time - keyData.time;
                  if(isBezier) {
                    keyData.outtangent.x = deltat * tangentNormalizedValues[i++];
                    keyData.outtangent.y = keyData.outtangent.x * tangentNormalizedValues[i++];
                    nextKey.intangent.x = deltat * tangentNormalizedValues[i++];
                    nextKey.intangent.y = nextKey.intangent.x * tangentNormalizedValues[i++];
                    keyData.setOutTan(keyData.outtangent);
                    nextKey.setInTan(nextKey.intangent, true);
                  }
                }
                tracksData.tracks[trackIndex].keys[keyIndex] = keyData;
                animationLibraryNode.setTrackSet(tracksData, trackSetId);
              //  animationLibraryNode.setKeyData(trackIndex, keyIndex, keyData);
                updateCurve();
                scene.redrawAllViewports();
              });
          var keyNode = keyGroupNode.createRect().translate(-4, -4).size(8, 8).stroke(keyColor);
          
          if(isBezier) {
            ///////////////////////////////////////////////
            // In Tangent
            if(keyData.time > timeRange.x){
              var inTanSsVal = screenXfo.toScreenSpace(keyData.intangent, true);
              var inTanLineNode = keyGroupNode.createPath().addClass('KeyframeHandle');
              inTanLineNode.attr('d', 'M 0 0 L ' + inTanSsVal.x + ' ' + inTanSsVal.y);
              var inTanNode = keyGroupNode.createRect()
                                                  .translate(inTanSsVal.x - 3, inTanSsVal.y - 3)
                                                  .size(6, 6).stroke(keyColor);
              inTanNode.draggable({ mouseButton: 0 })
                .addOnDragBeginCallback(
                  function(evt){
                  })
                .addOnDragCallback(
                  function(evt) {
                    keyData.intangent = screenXfo.toGraphSpace(evt.localPos, true);
                    // Clamp the handle lengths > 0 && < deltat
                    if(!evt.altKey && keyIndex > 0){
                      var deltat = prevKey.time - keyData.time;
                      keyData.intangent.x = keyData.intangent.x < deltat ? deltat : keyData.intangent.x;
                    }
                    keyData.intangent.x = keyData.intangent.x > -0.1 ? -0.1 : keyData.intangent.x;
                    
                    if(!evt.altKey && keyIndex < trackData.keys.length-1){
                      keyData.outtangent.y = (keyData.intangent.y / keyData.intangent.x) * keyData.outtangent.x;
                      keyData.setOutTan(keyData.outtangent);
                    }
                    keyData.setInTan(keyData.intangent);
                    tracksData.tracks[trackIndex].keys[keyIndex] = keyData;
                    animationLibraryNode.setTrackSet(tracksData, trackSetId);
                  //  animationLibraryNode.setKeyData(trackIndex, keyIndex, keyData);
                    updateCurve();
                    scene.redrawAllViewports();
                  });
            }
            keyData.setInTan = function(intangent, setKeyData){
              if(inTanNode){
                var inTanSsVal = screenXfo.toScreenSpace(intangent, true);
                inTanNode.translate(inTanSsVal.x - 3, inTanSsVal.y - 3)
                inTanLineNode.attr('d', 'M 0 0 L ' + inTanSsVal.x + ' ' + inTanSsVal.y);
              }
              if(setKeyData){
                keyData.intangent = intangent;
                tracksData.tracks[trackIndex].keys[keyIndex] = keyData;
                animationLibraryNode.setTrackSet(tracksData, trackSetId);
              //  animationLibraryNode.setKeyData(trackIndex, keyIndex, keyData);
              }
            }
            ///////////////////////////////////////////////
            // Out Tangent
            if(keyData.time < timeRange.y){
              var outTanSsVal = screenXfo.toScreenSpace(keyData.outtangent, true);
              var outTanLineNode = keyGroupNode.createPath().addClass('KeyframeHandle');
              outTanLineNode.attr('d', 'M 0 0 L ' + outTanSsVal.x + ' ' + outTanSsVal.y);
              var outTanNode = keyGroupNode.createRect()
                                                   .translate(outTanSsVal.x - 3, outTanSsVal.y - 3)
                                                   .size(6, 6).stroke(keyColor);
      
              outTanNode.draggable({ mouseButton: 0 })
                .addOnDragBeginCallback(
                  function(evt){
                  })
                .addOnDragCallback(
                  function(evt) {
                    keyData.outtangent = screenXfo.toGraphSpace(evt.localPos, true);
                    // Clamp the handle lengths > 0 && < deltat
                   if(keyIndex < trackData.keys.length-1){
                      var deltat = nextKey.time - keyData.time;
                      keyData.outtangent.x = keyData.outtangent.x > deltat ? deltat : keyData.outtangent.x;
                    }
                    keyData.outtangent.x = keyData.outtangent.x < 0.1 ? 0.1 : keyData.outtangent.x;
                    
                    if(!evt.altKey && keyIndex < trackData.keys.length-1){
                      keyData.intangent.y = (keyData.outtangent.y / keyData.outtangent.x) * keyData.intangent.x;
                      keyData.setInTan(keyData.intangent);
                    }
                    keyData.setOutTan(keyData.outtangent);
                    
                    tracksData.tracks[trackIndex].keys[keyIndex] = keyData;
                    animationLibraryNode.setTrackSet(tracksData, trackSetId);
                  //  animationLibraryNode.setKeyData(trackIndex, keyIndex, keyData);
                    updateCurve();
                    scene.redrawAllViewports();
                  });
            }
            keyData.setOutTan = function(outtangent, setKeyData){
              if(outTanNode){
                var outTanSsVal = screenXfo.toScreenSpace(outtangent, true);
                outTanNode.translate(outTanSsVal.x - 3, outTanSsVal.y - 3)
                outTanLineNode.attr('d', 'M 0 0 L ' + outTanSsVal.x + ' ' + outTanSsVal.y);
              }
              if(setKeyData){
                keyData.outtangent = outtangent;
                
                tracksData.tracks[trackIndex].keys[keyIndex] = keyData;
                animationLibraryNode.setTrackSet(tracksData, trackSetId);
              //  animationLibraryNode.setKeyData(trackIndex, keyIndex, keyData);
              }
            }
          }
        }
      }
      if (window.drawKeys !== false) {
        var trackData = tracksData.tracks[trackIndex];
        for (var i = 0; i < trackData.keys.length; i++) {
          drawKey(i, trackData.keys[i]);
        }
      }
    }
    
    for (var i = 0; i < trackCount; i++) {
      drawTrackCurve(i);
    }
  }
  
  drawTrackCurves();
  
  if(options.timeStripe){
    var timeStripeGroupNode = graphCenterGroup.createGroup()
        .translate((scene.animation.getTime() + screenXfo.tr.x)  * screenXfo.sc.x, windowHeight * -0.5)
        .draggable({ mouseButton: 0, axis: 'X' })
        .addOnDragCallback(
          function(evt) {
            scene.animation.setTime((evt.localPos.x / screenXfo.sc.x) - screenXfo.tr.x);
          });
  
    timeStripeGroupNode.createRect().size(10, windowHeight).addClass('EventCatcher');
    var timeStripe = timeStripeGroupNode.createPath().addClass('TimeStripePath')
        .attr('d', 'M 5 0 L 5 ' + windowHeight);
  
    window.updateGraphTimeStripe = function() {
      timeStripeGroupNode.translate((scene.animation.getTime() + screenXfo.tr.x)  * screenXfo.sc.x, windowHeight * -0.5);
    }
  }
  
  var updateTimeRange = function(){
    trackDisplayNode.setTimeRange(timeRange);
    curvesData = trackDisplayNode.getCurveData();
    
    if(options.timeStripe){
      updateGraphTimeStripe();
    }
    keysHolderGroup.removeAllChildren();
    drawTrackCurves();
  }
  
  var fitCurveEditorToWindow = function(){
    var newWindowWidth = $('#viewer').width();
    var newWindowHeight = $('#viewer').height();
    
    timeRange.y += ( newWindowWidth - windowWidth ) / screenXfo.sc.x;
    windowWidth = newWindowWidth;
    windowHeight = newWindowHeight;
    graphCenterGroup.translate(0, windowHeight * 0.5);
    graphBGRect.size(windowWidth, windowHeight);
    timeStripe.attr('d', 'M 5 0 L 5 ' + windowHeight);
    
    updateTimeRange();
  }
  
  if(options.draggable){
    var dragStartTimeRange;
    var dragStartOffset;
    graphBGRect.draggable( {mouseButton:0, delegateTranslateObj:false, highlight:false } )
      .addOnDragBeginCallback(
        function(evt){
          dragStartTimeRange = timeRange.clone();
          dragStartOffset = screenXfo.tr.clone();
      })
      .addOnDragCallback(
        function(evt){
          timeRange.x = dragStartTimeRange.x - (evt.dragVec.x / screenXfo.sc.x);
          timeRange.y = dragStartTimeRange.y - (evt.dragVec.x / screenXfo.sc.x);
          screenXfo.tr = dragStartOffset.add(evt.dragVec.multiply(screenXfo.sc.inverse()));
          updateTimeRange();
        });
  }
  
  if(options.zoomable){
    var mouseWheelZoomFn = function(evt) {
      var zoomDist = evt.wheelDelta * 0.1;
      timeRange.x += zoomDist / screenXfo.sc.x;
      timeRange.y -= zoomDist / screenXfo.sc.x;
      yRange.x -= zoomDist / screenXfo.sc.y;
      yRange.y += zoomDist / screenXfo.sc.y;
      screenXfo.sc.x = windowWidth/(timeRange.y - timeRange.x);
      screenXfo.sc.y = -(windowHeight - 40) / (yRange.y - yRange.x)
      screenXfo.tr.x = -timeRange.x;
    // screenXfo.tr.y = (yRange.y + yRange.x) * -0.5;  
      updateTimeRange();
    }
    
    rootDomNode.addEventListener('mouseover', function(){
      document.addEventListener('mousewheel', mouseWheelZoomFn, false);
    });
    
    rootDomNode.addEventListener('mouseout', function(){
      document.removeEventListener('mousewheel', mouseWheelZoomFn, false);
    });
  }
  return {
    resize: function(){
      fitCurveEditorToWindow();
    }
  }
};
