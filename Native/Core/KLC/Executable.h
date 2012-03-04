/*
 *  Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
 */
 
#ifndef _FABRIC_KL_EXECUTABLE_H
#define _FABRIC_KL_EXECUTABLE_H

#include <Fabric/Core/GC/Object.h>
#include <Fabric/Core/CG/Diagnostics.h>
#include <Fabric/Core/CG/CompileOptions.h>
#include <Fabric/Core/CG/Manager.h>
#include <Fabric/Core/AST/GlobalList.h>
#include <Fabric/Core/AST/Operator.h>
#include <Fabric/Core/Util/TLS.h>
#include <Fabric/Base/JSON/Decoder.h>

#include <llvm/ADT/OwningPtr.h>
#include <llvm/Function.h>
#include <llvm/ExecutionEngine/JIT.h>

namespace llvm
{
  class ExecutionEngine;
  class Module;
};

namespace Fabric
{
  namespace CG
  {
    class Context;
  };
  
  namespace KLC
  {
    class ArrayGeneratorOperator;
    class MapOperator;
    class ReduceOperator;
    class ValueMapOperator;
    class ValueTransformOperator;
    class ArrayTransformOperator;
    
    class Executable : public GC::Object
    {
      FABRIC_GC_OBJECT_CLASS_DECL()
      
    public:
    
      static RC::Handle<Executable> Create(
        GC::Container *gcContainer,
        RC::Handle<CG::Manager> const &cgManager,
        RC::ConstHandle<AST::GlobalList> const &ast,
        CG::CompileOptions const &compileOptions,
        CG::Diagnostics const &diagnostics
        );
      
      RC::ConstHandle<AST::GlobalList> getAST() const;
      CG::Diagnostics const &getDiagnostics() const;
      RC::Handle<CG::Manager> getCGManager() const;
      
      template<class T> RC::Handle<T> resolveOperator( std::string const &operatorName ) const
      {
        void (*functionPtr)( ... ) = 0;
        RC::ConstHandle<AST::Operator> astOperator;
        
        if ( !m_diagnostics.containsError() )
        {
          CurrentExecutableSetter executableSetter( this );
          llvm::Function *llvmFunction = m_llvmExecutionEngine->FindFunctionNamed( operatorName.c_str() );
          if ( llvmFunction )
          {
            functionPtr = (void (*)(...))( m_llvmExecutionEngine->getPointerToFunction( llvmFunction ) );
            
            std::vector< RC::ConstHandle<AST::Function> > functions;
            m_ast->collectFunctions( functions );
            
            for ( std::vector< RC::ConstHandle<AST::Function> >::const_iterator it=functions.begin(); it!=functions.end(); ++it )
            {
              RC::ConstHandle<AST::Function> const &function = *it;
              
              std::string const *friendlyName = function->getFriendlyName( m_cgManager );
              if ( friendlyName && *friendlyName == operatorName )
              {
                if( !function->isOperator() )
                  throw Exception( _(operatorName) + " is not an operator" );
                astOperator = RC::ConstHandle<AST::Operator>::StaticCast( function );
              }
            }
          }
            
          if ( !functionPtr )
            throw Exception( "operator " + _(operatorName) + " not found" );
        }
        
        return T::Create(
          this,
          astOperator,
          functionPtr
          );
      }
        
      virtual void jsonExec(
        JSON::Entity const &cmd,
        JSON::Entity const &arg,
        JSON::ArrayEncoder &resultArrayEncoder
        );

    protected:
    
      class CurrentExecutableSetter
      {
      public:
      
        CurrentExecutableSetter( Executable const *executable )
          : m_oldExecutable( s_currentExecutable )
        {
          s_currentExecutable = executable;
        }
        
        ~CurrentExecutableSetter()
        {
          s_currentExecutable = m_oldExecutable;
        }
        
      private:
      
        Executable const *m_oldExecutable;
      };
    
      Executable(
        FABRIC_GC_OBJECT_CLASS_PARAM,
        GC::Container *gcContainer,
        RC::Handle<CG::Manager> const &cgManager,
        RC::ConstHandle<AST::GlobalList> const &ast,
        CG::CompileOptions const &compileOptions,
        CG::Diagnostics const &diagnostics
        );
    
    private:
    
      void jsonExecGetAST(
        JSON::Entity const &arg,
        JSON::ArrayEncoder &resultArrayEncoder
        );
    
      void jsonExecGetDiagnostics(
        JSON::Entity const &arg,
        JSON::ArrayEncoder &resultArrayEncoder
        );
    
      template<class T> void jsonExecResolveOperator(
        JSON::Entity const &arg,
        JSON::ArrayEncoder &resultArrayEncoder
        )
      {
        std::string id_;
        std::string operatorName;

        arg.requireObject();
        JSON::ObjectDecoder objectDecoder( arg );
        JSON::Entity keyString, valueEntity;
        while ( objectDecoder.getNext( keyString, valueEntity ) )
        {
          if ( keyString.stringIs( "id", 2 ) )
          {
            valueEntity.requireString();
            id_ = valueEntity.stringToStdString();
          }
          else if ( keyString.stringIs( "operatorName", 12 ) )
          {
            valueEntity.requireString();
            operatorName = valueEntity.stringToStdString();
          }
        }
        
        resolveOperator<T>( operatorName )->reg( m_gcContainer, id_ );
      }
    
      void *lazyFunctionCreator( std::string const &functionName ) const;
      static void *LazyFunctionCreator( std::string const &functionName );

      static void Report( char const *data, size_t length );

      GC::Container *m_gcContainer;
      RC::Handle<CG::Manager> m_cgManager;
      RC::ConstHandle<AST::GlobalList> m_ast;
      CG::Diagnostics m_diagnostics;
      
      RC::Handle<CG::Context> m_cgContext;
      llvm::OwningPtr<llvm::ExecutionEngine> m_llvmExecutionEngine;

      static Util::TLSVar<Executable const *> s_currentExecutable;
    };
  }
}

#endif //_FABRIC_KL_EXECUTABLE_H