/*
 *  Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
 */

#ifndef _FABRIC_AST_CONST_DECL_H
#define _FABRIC_AST_CONST_DECL_H

#include <Fabric/Core/AST/Node.h>

namespace Fabric
{
  namespace CG
  {
    class Adapter;
    class Location;
    class Manager;
    class ModuleBuilder;
    class Scope;
  };
  
  namespace AST
  {
    class ConstDecl : public Node
    {
      FABRIC_AST_NODE_DECL( ConstDecl );

    public:

      static RC::ConstHandle<ConstDecl> Create(
        CG::Location const &location,
        std::string const &name,
        std::string const &type,
        std::string const &value
        );
      
      void llvmPrepareModule( CG::ModuleBuilder &moduleBuilder, CG::Diagnostics &diagnostics, bool buildFunctions ) const;
      
      virtual void llvmCompileToScope( CG::Scope &scope, RC::ConstHandle<CG::Manager> const &manager ) const;
     
    protected:
    
      ConstDecl(
        CG::Location const &location,
        std::string const &name,
        std::string const &type,
        std::string const &value
        );
      
      virtual void appendJSONMembers( Util::JSONObjectGenerator const &jsonObjectGenerator ) const;

    private:
    
      std::string m_name;
      std::string m_type;
      std::string m_value;
    };
  };
};

#endif //_FABRIC_AST_CONST_DECL_H
