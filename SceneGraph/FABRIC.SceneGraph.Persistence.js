
//
// Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
//

//////////////////////////////////////////////////////////////////////////////
// The SceneSaver is a tool for writing out all the data for a collection
// of nodes that the developer wishes to save.
// Note: it is the responsibility of the developer to determine which nodes
// need to be persisted and which ones done't.
// For example, a scene graph might always construct a Viewport or Grid object
// which shouldn't be persisted.
//
// Example usage
//   var sceneSaver = FABRIC.SceneGraph.constructSceneSaver(scene);
//  for(i in savableNodes){
//    sceneSaver.addNode(savableNodes[i]);
//  }
//  // Now put the data somewhere. Maybe in a database or file.
//  FABRIC.FS.write(sceneSaver.save());

/**
 * Constructor for a SceneSaver object.
 * @param {object} scene The scene to save.
 * @return {object} The created SceneSaver object.
 */
FABRIC.SceneGraph.registerManagerType('SceneSaver', {
  briefDesc: 'The SceneSaver manages the persistence of objects.',
  detailedDesc: '.',
  parentManagerDesc: '',
  optionsDesc: {
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
      });
  
    var savedNodes = [];
    var savedData = [];
    var currentIndex = 0;
    var isNodeBeingSaved = function(node) {
      return (savedNodes.indexOf(node) !== -1);
    };
    var sceneSaver = {
      addNode: function(node) {
        if (!node || !node.isTypeOf || !node.isTypeOf('SceneGraphNode')) {
          throw 'SceneSaver can only save SceneGraphNodes';
        }
        if(!isNodeBeingSaved(node)){
          var constructionOptions = {};
          var nodeData = {};
          var nodePrivate = scene.getPrivateInterface(node);
          nodePrivate.writeData(sceneSaver, constructionOptions, nodeData);
          savedData.push({
            options: constructionOptions,
            data: nodeData
          });
          savedNodes.push(node);
        };
        return node;
      },
      pub:{
        addNode: function(node) {
          return sceneSaver.addNode(node);
        },
        wrapQuotes: function(val) {
          return '\"' + ((typeof val === 'string') ? val : val.toString()) + '\"';
        },
        save: function(writer) {
          var str = '[';
          for (var i = 0; i < savedNodes.length; i++) {
            if (i > 0) {
              str += ',';
            }
            str += '\n  {';
            str += '\n    \"name\":' + this.wrapQuotes(savedNodes[i].getName());
            str += ',\n    \"type\":' + this.wrapQuotes(savedNodes[i].getType());
            str += ',\n\    "options\":' + JSON.stringify(savedData[i].options);
            str += ',\n\    "data\":' + JSON.stringify(savedData[i].data);
            str += '\n  }';
          }
          str += '\n]';
          writer.write(str);
          return true;
        }
      }
    };
    return sceneSaver;
  }});


//////////////////////////////////////////////////////////////////////////////
// The SceneLoader is a tool for loading a collection of nodes and
// re-binding dependencies.
//
// Example usage
//   var sceneLoader = FABRIC.SceneGraph.constructSceneLoader(scene, FABRIC.loadResourceURL(file));
//  var loadedNodes = sceneLoader.load();

/**
 * Constructor for a SceneLoader object.
 * @param {object} scene The scene to load into.
 * @param {object} reader The reader object to read from.
 * @return {object} The created SceneLoader object.
 */
FABRIC.SceneGraph.registerManagerType('SceneLoader', {
  briefDesc: 'The SceneLoader manages the loading of persisted objects.',
  detailedDesc: '.',
  parentManagerDesc: '',
  optionsDesc: {
  },
  factoryFn: function(options, scene) {
    scene.assignDefaults(options, {
      preLoadScene: true
    });
    
    var dataObj;
    var preLoadedNodes = {};
  
    var constructedNodeMap = {};
    var nodeNameRemapping = {};
    
    if(options.preLoadScene){
      var sceneNodes = scene.getSceneGraphNodes();
      for(var name in sceneNodes){
        preLoadedNodes[name] = sceneNodes[name].pub;
      }
    };
      
    var sceneLoader = {
      preLoadNode: function(node) {
        preLoadedNodes[node.getName()] = node;
      },
      getNode: function(nodeName) {
        nodeName = nodeNameRemapping[ nodeName ]
        if (constructedNodeMap[nodeName]) {
          return constructedNodeMap[nodeName];
        }else {
          return scene.getSceneGraphNode(nodeName);
        }
      },
      pub: {
        load: function(storage) {
          dataObj = JSON.parse(storage.read());
          
          for (var i = 0; i < dataObj.length; i++) {
            var nodeData = dataObj[i];
            var node = preLoadedNodes[nodeData.name];
            if (!node) {
              node = scene.pub.constructNode(nodeData.type, nodeData.options);
            }
            // in case a name collision occured, store a name remapping table.
            nodeNameRemapping[ nodeData.name ] = node.getName();
            var nodePrivate = scene.getPrivateInterface(node);
            nodePrivate.readData(sceneLoader, nodeData.data);
            constructedNodeMap[node.getName()] = node;
          }
          return constructedNodeMap;
        }
      }
    };
    return sceneLoader;
  }});

/**
 * Constructor to create a logWriter object.
 * @constructor
 */
FABRIC.SceneGraph.LogWriter = function() {
  var str = "";
  this.write = function(instr) {
    str = instr;
  }
  this.log = function(instr) {
    console.log(str);
  }
};


/**
 * Constructor to create a logWriter object.
 * @constructor
 */
FABRIC.SceneGraph.LogWriter = function() {
  var str = "";
  this.write = function(instr) {
    str = instr;
  }
  this.log = function(instr) {
    console.log(str);
  }
};

FABRIC.SceneGraph.LocalStorage = function(name) {
  this.write = function(instr) {
    localStorage.setItem(name, instr);
  }
  this.read = function(){
    return localStorage.getItem(name);
  }
  this.log = function() {
    console.log(localStorage.getItem(name));
  }
};

/**
 * Constructor to create a FileWriter object.
 * @constructor
 * @param {string} filepath The path to the file to write to.
 */
FABRIC.SceneGraph.FileWriter = function(scene, title, suggestedFileName) {
  
  var path = scene.IO.queryUserFileAndFolderHandle(scene.IO.forOpenWithWriteAccess, title, "json", suggestedFileName);
  var str = "";
  this.write = function(instr) {
    str = instr;
    scene.IO.putTextFile(str, path);
  }
  this.read = function(){
    return localStorage.getItem(name);
  }
  this.log = function(instr) {
    console.log(str);
  }

};

/**
 * Constructor to create a FileReader object.
 * @constructor
 * @param {string} filepath The path to the file to read from.
 */
FABRIC.SceneGraph.FileReader = function(scene, title, suggestedFileName) {

  var path = scene.IO.queryUserFileAndFolderHandle(scene.IO.forOpen, title, "json", suggestedFileName);

  this.read = function() {
    return JSON.parse(scene.IO.getTextFile(path));
  }
};


/**
 * Constructor to create a FileReader object.
 * @constructor
 * @param {string} filepath The path to the file to read from.
 */
FABRIC.SceneGraph.URLReader = function(url) {
  this.read = function() {
    return FABRIC.loadResourceURL(url);
  }
};



