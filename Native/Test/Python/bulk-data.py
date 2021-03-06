#
#  Copyright 2010-2012 Fabric Engine Inc. All rights reserved.
#

import fabric
fabricClient = fabric.createClient()

node = fabricClient.DependencyGraph.createNode("foo")
node.addMember( "foo", "Integer", 17 )
node.addMember( "bar", "String", "red" )
node.addMember( "baz", "Scalar[]", [3.141] )
print(fabric.stringify(node.getBulkData()))
print(fabric.stringify(node.getSliceBulkData(0)))
node.setBulkData({'foo':[42],'bar':["fred"],'baz':[[4.5,3.6]]})
print(fabric.stringify(node.getBulkData()))
print(fabric.stringify(node.getSliceBulkData(0)))
node.resize(2)
print(fabric.stringify(node.getBulkData()))
print(fabric.stringify(node.getSliceBulkData(0)))
print(fabric.stringify(node.getSliceBulkData(1)))
print(fabric.stringify(node.getSlicesBulkData([1,0,1])))
node.setSliceBulkData(1, {'foo':18,'bar':"hello",'baz':[]})
print(fabric.stringify(node.getBulkData()))
print(fabric.stringify(node.getSliceBulkData(0)))
print(fabric.stringify(node.getSliceBulkData(1)))
print(fabric.stringify(node.getSlicesBulkData([1,0,1])))

fabricClient.close()
