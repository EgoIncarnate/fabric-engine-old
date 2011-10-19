FC = createFabricClient();
F = FC.wrapFabricClient(FC);

operator = F.DG.createOperator("op");
operator.setEntryFunctionName("entry");
operator.setSourceCode("\
operator entry( io Size foo ) {\n\
  report 'foo = ' + foo;\n\
}\n\
");
if (operator.getDiagnostics().length > 0 )
  printDeep(operator.getDiagnostics());

binding = F.DependencyGraph.createBinding();
binding.setOperator(operator);
binding.setParameterLayout(['self.bar','self.foo']);

node = F.DG.createNode("node");
node.addMember('bar', 'Size');
node.setData('bar', 0, 42);
node.bindings.append(binding);
if (node.getErrors().length > 0)
  printDeep(node.getErrors());
node.evaluate();

F.flush();
FC.dispose();