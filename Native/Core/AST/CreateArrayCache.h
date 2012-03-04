/*
 *  Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
 */

#ifndef _FABRIC_AST_CREATE_ARRAY_CACHE_H
#define _FABRIC_AST_CREATE_ARRAY_CACHE_H

#include <Fabric/Core/AST/Expr.h>

namespace Fabric
{
  namespace AST
  {
    class CreateArrayCache : public Expr
    {
      FABRIC_AST_NODE_DECL( CreateArrayCache );

    public:
    
      static RC::ConstHandle<CreateArrayCache> Create(
        CG::Location const &location,
        RC::ConstHandle<Expr> const &input
        );
      
      virtual void registerTypes( RC::Handle<CG::Manager> const &cgManager, CG::Diagnostics &diagnostics ) const;
      
      virtual RC::ConstHandle<CG::Adapter> getType( CG::BasicBlockBuilder &basicBlockBuilder ) const;
      virtual CG::ExprValue buildExprValue( CG::BasicBlockBuilder &basicBlockBuilder, CG::Usage usage, std::string const &lValueErrorDesc ) const;
        
    protected:
    
      CreateArrayCache(
        CG::Location const &location,
        RC::ConstHandle<Expr> const &input
        );
      
      virtual void appendJSONMembers( JSON::ObjectEncoder const &jsonObjectEncoder, bool includeLocation ) const;
      
    private:
    
      RC::ConstHandle<Expr> m_input;
    };
  };
};

#endif //_FABRIC_AST_CREATE_ARRAY_CACHE_H