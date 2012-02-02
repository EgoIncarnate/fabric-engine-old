import fabric
fabricClient = fabric.createClient()

node = fabricClient.DependencyGraph.createNode("foo")
node.addMember( "foo", "Integer", 17 )
print( node.getData( "foo" ) )
node.setData( "foo", 42 )
print( node.getData( "foo" ) )

fabricClient.close()
