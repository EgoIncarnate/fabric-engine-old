/*
 *  Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
 */
 
#include "ModuleBuilder.h"
#include "Manager.h"
#include "Error.h"
#include "Location.h"

namespace Fabric
{
  namespace CG
  {
    ModuleBuilder::ModuleBuilder( RC::Handle<Manager> const &manager, llvm::Module *module )
      : m_manager( manager )
      , m_module( module )
    {
    }
    
    RC::Handle<Manager> ModuleBuilder::getManager()
    {
      return m_manager;
    }
    
    RC::ConstHandle<Adapter> ModuleBuilder::maybeGetAdapter( std::string const &userName ) const
    {
      return m_manager->maybeGetAdapter( userName );
    }
    
    RC::ConstHandle<Adapter> ModuleBuilder::getAdapter( std::string const &userName, CG::Location const &location )
    {
      RC::ConstHandle<Adapter> result = maybeGetAdapter( userName );
      if ( !result )
        throw CG::Error( location, _(userName) + ": type not registered" );
      return result;
    }
    
    llvm::LLVMContext &ModuleBuilder::getLLVMContext()
    {
      return m_manager->getLLVMContext();
    }
    
    ModuleBuilder::operator llvm::Module *()
    {
      return m_module;
    }
    
    llvm::Module *ModuleBuilder::operator ->()
    {
      return m_module;
    }
      
    ModuleScope &ModuleBuilder::getScope()
    {
      return m_moduleScope;
    }
    
    bool ModuleBuilder::contains( std::string const &codeName, bool buildFunctions )
    {
      bool insertResult = m_contained.insert( std::pair<std::string, bool>( codeName, buildFunctions ) ).second;
      return !insertResult;
    }

    void ModuleBuilder::addFunction( std::string const &entryName, RC::ConstHandle<FunctionSymbol> const &functionSymbol, std::string const *friendlyName )
    {
      FABRIC_ASSERT( entryName.length() > 0 );
      
      std::pair< Functions::iterator, bool > insertResult = m_functions.insert( Functions::value_type( entryName, functionSymbol ) );
      if ( !insertResult.second )
      {
        RC::ConstHandle<FunctionSymbol> const &existingFunctionSymbol = insertResult.first->second;
        if ( existingFunctionSymbol->getLLVMFunction() != functionSymbol->getLLVMFunction() )
          throw Exception( "function with entry name " + _(entryName) + " already exists" );
      }
      
      if ( friendlyName )
        m_moduleScope.put( *friendlyName, functionSymbol );
    }
    
    RC::ConstHandle<FunctionSymbol> ModuleBuilder::maybeGetFunction( std::string const &entryName ) const
    {
      RC::ConstHandle<FunctionSymbol> result;
      Functions::const_iterator it = m_functions.find( entryName );
      if ( it != m_functions.end() )
        result = it->second;
      return result;
    }
  };
};
