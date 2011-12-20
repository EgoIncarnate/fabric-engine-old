/*
 *  Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
 */
 
#include <Fabric/Core/KLC/Executable.h>
#include <Fabric/Core/KLC/ArrayGeneratorOperator.h>
#include <Fabric/Core/KLC/MapOperator.h>
#include <Fabric/Core/KLC/ReduceOperator.h>
#include <Fabric/Core/KLC/ValueMapOperator.h>
#include <Fabric/Core/DG/IRCache.h>
#include <Fabric/Core/Plug/Manager.h>
#include <Fabric/Core/KL/Externals.h>
#include <Fabric/Core/KL/Parser.hpp>
#include <Fabric/Core/KL/StringSource.h>
#include <Fabric/Core/KL/Scanner.h>
#include <Fabric/Core/CG/Diagnostics.h>
#include <Fabric/Core/CG/ModuleBuilder.h>
#include <Fabric/Core/AST/UseInfo.h>
#include <Fabric/Core/RT/Manager.h>
#include <Fabric/Core/MT/LogCollector.h>
#include <Fabric/Base/JSON/String.h>

#include <llvm/Module.h>
#include <llvm/Function.h>
#include <llvm/Target/TargetData.h>
#include <llvm/Target/TargetSelect.h>
#include <llvm/Target/TargetOptions.h>
#include <llvm/ExecutionEngine/JIT.h>
#include <llvm/Assembly/Parser.h>
#include <llvm/Support/SourceMgr.h>
#include <llvm/Analysis/Verifier.h>
#include <llvm/Transforms/Scalar.h>
#include <llvm/Transforms/IPO.h>
#include <llvm/Support/raw_ostream.h>
#include <llvm/PassManager.h>
#include <llvm/Support/StandardPasses.h>

namespace Fabric
{
  namespace KLC
  {
    FABRIC_GC_OBJECT_CLASS_IMPL( Executable, GC::Object )
      
    Util::TLSVar<Executable const *> Executable::s_currentExecutable;
    
    RC::Handle<Executable> Executable::Create(
      GC::Container *gcContainer,
      RC::Handle<CG::Manager> const &cgManager,
      RC::ConstHandle<AST::GlobalList> const &ast,
      CG::CompileOptions const &compileOptions,
      CG::Diagnostics const &diagnostics
      )
    {
      return new Executable(
        FABRIC_GC_OBJECT_MY_CLASS,
        gcContainer,
        cgManager,
        ast,
        compileOptions,
        diagnostics
        );
    }
    
    Executable::Executable(
      FABRIC_GC_OBJECT_CLASS_PARAM,
      GC::Container *gcContainer,
      RC::Handle<CG::Manager> const &cgManager,
      RC::ConstHandle<AST::GlobalList> const &originalAST,
      CG::CompileOptions const &compileOptions,
      CG::Diagnostics const &originalDiagnostics
      )
      : GC::Object( FABRIC_GC_OBJECT_CLASS_ARG )
      , m_gcContainer( gcContainer )
      , m_cgManager( cgManager )
      , m_ast( originalAST )
      , m_diagnostics( originalDiagnostics )
    {
      llvm::InitializeNativeTarget();
      LLVMLinkInJIT();
      
      RC::ConstHandle<RT::Manager> rtManager = cgManager->getRTManager();
      
      AST::UseNameToLocationMap uses;
      m_ast->collectUses( uses );

      std::set<std::string> includedUses;
      while ( !uses.empty() )
      {
        AST::UseNameToLocationMap::iterator it = uses.begin();
        std::string const &name = it->first;
        if ( includedUses.find( name ) == includedUses.end() )
        {
          RC::ConstHandle<AST::GlobalList> useAST = Plug::Manager::Instance()->maybeGetASTForExt( name );
          if ( !useAST )
          {
            RC::ConstHandle<RC::Object> typeAST;
            if ( rtManager->maybeGetASTForType( name, typeAST ) )
              useAST = typeAST? RC::ConstHandle<AST::GlobalList>::StaticCast( typeAST ): AST::GlobalList::Create();
          }
            
          if ( useAST )
          {
            useAST->collectUses( uses );
            m_ast = AST::GlobalList::Create( useAST, m_ast );
            includedUses.insert( name );
          }
          else m_diagnostics.addError( it->second, "no registered type or plugin named " + _(it->first) );
        }
        uses.erase( it );
      }

      if ( !m_diagnostics.containsError() )
      {
        static const bool optimize = true;
      
        m_cgContext = CG::Context::Create();
        llvm::OwningPtr<llvm::Module> module( new llvm::Module( "Fabric", m_cgContext->getLLVMContext() ) );
        CG::ModuleBuilder moduleBuilder( cgManager, m_cgContext, module.get(), &compileOptions );
#if defined(FABRIC_MODULE_OPENCL)
        OCL::llvmPrepareModule( moduleBuilder, rtManager );
#endif

        llvm::NoFramePointerElim = true;
        llvm::JITExceptionHandling = true;
        
        RC::Handle<DG::IRCache> irCache =  DG::IRCache::Instance( &compileOptions ); 
        std::string irCacheKeyForAST = irCache->keyForAST( m_ast );
        std::string ir = irCache->get( irCacheKeyForAST );
        if ( ir.length() > 0 )
        {
          llvm::SMDiagnostic error;
          llvm::ParseAssemblyString( ir.c_str(), module.get(), error, m_cgContext->getLLVMContext() );
          
          m_ast->registerTypes( cgManager, m_diagnostics );
          FABRIC_ASSERT( !m_diagnostics.containsError() );

          FABRIC_ASSERT( !llvm::verifyModule( *module, llvm::PrintMessageAction ) );
        }
        else
        {
          m_ast->registerTypes( cgManager, m_diagnostics );
          if ( !m_diagnostics.containsError() )
          {
            m_ast->llvmCompileToModule( moduleBuilder, m_diagnostics, false );
          }
          if ( !m_diagnostics.containsError() )
          {
            m_ast->llvmCompileToModule( moduleBuilder, m_diagnostics, true );
          }
          if ( !m_diagnostics.containsError() )
          {
          /*
#if defined(FABRIC_BUILD_DEBUG)
            std::string byteCode;
            llvm::raw_string_ostream byteCodeStream( byteCode );
            module->print( byteCodeStream, 0 );
            byteCodeStream.flush();
#endif
          */
          
            llvm::OwningPtr<llvm::PassManager> passManager( new llvm::PassManager );
            if ( optimize )
            {
              llvm::createStandardAliasAnalysisPasses( passManager.get() );
              llvm::createStandardFunctionPasses( passManager.get(), 3 );
              llvm::createStandardModulePasses( passManager.get(), 3, false, true, true, true, false, llvm::createFunctionInliningPass() );
              llvm::createStandardLTOPasses( passManager.get(), true, true, false );
            }
#if defined(FABRIC_BUILD_DEBUG)
            passManager->add( llvm::createVerifierPass() );
#endif
            passManager->run( *module );
         
            if ( optimize )
            {
              std::string ir;
              llvm::raw_string_ostream irStream( ir );
              module->print( irStream, 0 );
              irStream.flush();
              irCache->put( irCacheKeyForAST, ir );
            }
          }
        }
        
        llvm::Module *llvmModule = module.take();

        std::string errStr;
        m_llvmExecutionEngine.reset(
          llvm::EngineBuilder(llvmModule)
            .setErrorStr(&errStr)
            .setEngineKind(llvm::EngineKind::JIT)
            .create()
          );
        if ( !m_llvmExecutionEngine )
          throw Exception( "Failed to construct ExecutionEngine: " + errStr );

        m_llvmExecutionEngine->InstallLazyFunctionCreator( &LazyFunctionCreator );
        
        // Make sure we don't search loaded libraries for missing symbols. 
        // Only symbols *we* provide should be available as calling functions.
        m_llvmExecutionEngine->DisableSymbolSearching();
        cgManager->llvmAddGlobalMappingsToExecutionEngine( m_llvmExecutionEngine.get(), *llvmModule );
      }
    }

    void Executable::Report( char const *data, size_t length )
    {
      MT::tlsLogCollector.get()->add( data, length );
    }
    
    void *Executable::lazyFunctionCreator( std::string const &functionName ) const
    {
      void *result = 0;
      
      if ( functionName == "report" )
        result = (void *)&Executable::Report;
        
      if ( !result )
        result = KL::LookupExternalSymbol( functionName );
        
      if ( !result )
        result = Plug::Manager::Instance()->llvmResolveExternalFunction( functionName );
        
#if defined(FABRIC_MODULE_OPENCL)
      if ( !result )
        result = OCL::llvmResolveExternalFunction( functionName );
#endif

      if ( !result )
        result = m_cgManager->llvmResolveExternalFunction( functionName );
      
      // We should *always* return a valid symbol. Otherwise something's
      // wrong in the KL compiler/support.
      if( !result )
        throw Exception( "LLVM lookup failed for symbol: " + functionName );

      return result;
    }
    
    void *Executable::LazyFunctionCreator( std::string const &functionName )
    {
      Executable const *currentExecutable = s_currentExecutable;
      FABRIC_ASSERT( currentExecutable );
      return currentExecutable->lazyFunctionCreator( functionName );
    }
    
    RC::Handle<MapOperator> Executable::resolveMapOperator( std::string const &mapOperatorName ) const
    {
      void (*functionPtr)( ... ) = 0;
      RC::ConstHandle<AST::Operator> astOperator;
      
      if ( !m_diagnostics.containsError() )
      {
        CurrentExecutableSetter executableSetter( this );
        llvm::Function *llvmFunction = m_llvmExecutionEngine->FindFunctionNamed( mapOperatorName.c_str() );
        if ( llvmFunction )
        {
          functionPtr = (void (*)(...))( m_llvmExecutionEngine->getPointerToFunction( llvmFunction ) );
          
          std::vector< RC::ConstHandle<AST::Function> > functions;
          m_ast->collectFunctions( functions );
          
          for ( std::vector< RC::ConstHandle<AST::Function> >::const_iterator it=functions.begin(); it!=functions.end(); ++it )
          {
            RC::ConstHandle<AST::Function> const &function = *it;
            
            std::string const *friendlyName = function->getFriendlyName( m_cgManager );
            if ( friendlyName && *friendlyName == mapOperatorName )
            {
              if( !function->isOperator() )
                throw Exception( _(mapOperatorName) + " is not an operator" );
              astOperator = RC::ConstHandle<AST::Operator>::StaticCast( function );
            }
          }
        }
          
        if ( !functionPtr )
          throw Exception( "map operator " + _(mapOperatorName) + " not found" );
      }
      
      return MapOperator::Create(
        this,
        astOperator,
        functionPtr
        );
    }
    
    RC::Handle<ReduceOperator> Executable::resolveReduceOperator( std::string const &reduceOperatorName ) const
    {
      void (*functionPtr)( ... ) = 0;
      RC::ConstHandle<AST::Operator> astOperator;
      
      if ( !m_diagnostics.containsError() )
      {
        CurrentExecutableSetter executableSetter( this );
        llvm::Function *llvmFunction = m_llvmExecutionEngine->FindFunctionNamed( reduceOperatorName.c_str() );
        if ( llvmFunction )
        {
          functionPtr = (void (*)(...))( m_llvmExecutionEngine->getPointerToFunction( llvmFunction ) );
          
          std::vector< RC::ConstHandle<AST::Function> > functions;
          m_ast->collectFunctions( functions );
          
          for ( std::vector< RC::ConstHandle<AST::Function> >::const_iterator it=functions.begin(); it!=functions.end(); ++it )
          {
            RC::ConstHandle<AST::Function> const &function = *it;
            
            std::string const *friendlyName = function->getFriendlyName( m_cgManager );
            if ( friendlyName && *friendlyName == reduceOperatorName )
            {
              if( !function->isOperator() )
                throw Exception( _(reduceOperatorName) + " is not an operator" );
              astOperator = RC::ConstHandle<AST::Operator>::StaticCast( function );
            }
          }
        }
          
        if ( !functionPtr )
          throw Exception( "reduce operator " + _(reduceOperatorName) + " not found" );
      }
      
      return ReduceOperator::Create(
        this,
        astOperator,
        functionPtr
        );
    }
    
    RC::Handle<ArrayGeneratorOperator> Executable::resolveArrayGeneratorOperator( std::string const &arrayGeneratorOperatorName ) const
    {
      void (*functionPtr)( ... ) = 0;
      RC::ConstHandle<AST::Operator> astOperator;
      
      if ( !m_diagnostics.containsError() )
      {
        CurrentExecutableSetter executableSetter( this );
        llvm::Function *llvmFunction = m_llvmExecutionEngine->FindFunctionNamed( arrayGeneratorOperatorName.c_str() );
        if ( llvmFunction )
        {
          functionPtr = (void (*)(...))( m_llvmExecutionEngine->getPointerToFunction( llvmFunction ) );
          
          std::vector< RC::ConstHandle<AST::Function> > functions;
          m_ast->collectFunctions( functions );
          
          for ( std::vector< RC::ConstHandle<AST::Function> >::const_iterator it=functions.begin(); it!=functions.end(); ++it )
          {
            RC::ConstHandle<AST::Function> const &function = *it;
            
            std::string const *friendlyName = function->getFriendlyName( m_cgManager );
            if ( friendlyName && *friendlyName == arrayGeneratorOperatorName )
            {
              if( !function->isOperator() )
                throw Exception( _(arrayGeneratorOperatorName) + " is not an operator" );
              astOperator = RC::ConstHandle<AST::Operator>::StaticCast( function );
            }
          }
        }
          
        if ( !functionPtr )
          throw Exception( "array generator operator " + _(arrayGeneratorOperatorName) + " not found" );
      }
      
      return ArrayGeneratorOperator::Create(
        this,
        astOperator,
        functionPtr
        );
    }
    
    RC::Handle<ValueMapOperator> Executable::resolveValueMapOperator( std::string const &operatorName ) const
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
          throw Exception( "array generator operator " + _(operatorName) + " not found" );
      }
      
      return ValueMapOperator::Create(
        this,
        astOperator,
        functionPtr
        );
    }

    RC::ConstHandle<AST::GlobalList> Executable::getAST() const
    {
      return m_ast;
    }
  
    CG::Diagnostics const &Executable::getDiagnostics() const
    {
      return m_diagnostics;
    }
        
    RC::Handle<CG::Manager> Executable::getCGManager() const
    {
      return m_cgManager;
    }
    
    void Executable::jsonExec(
      std::string const &cmd,
      RC::ConstHandle<JSON::Value> const &arg,
      Util::JSONArrayGenerator &resultJAG
      )
    {
      if ( cmd == "getAST" )
        jsonExecGetAST( arg, resultJAG );
      else if ( cmd == "getDiagnostics" )
        jsonExecGetDiagnostics( arg, resultJAG );
      else if ( cmd == "resolveMapOperator" )
        jsonExecResolveMapOperator( arg, resultJAG );
      else if ( cmd == "resolveReduceOperator" )
        jsonExecResolveReduceOperator( arg, resultJAG );
      else if ( cmd == "resolveArrayGeneratorOperator" )
        jsonExecResolveArrayGeneratorOperator( arg, resultJAG );
      else if ( cmd == "resolveValueMapOperator" )
        jsonExecResolveValueMapOperator( arg, resultJAG );
      else GC::Object::jsonExec( cmd, arg, resultJAG );
    }
    
    void Executable::jsonExecGetDiagnostics(
      RC::ConstHandle<JSON::Value> const &arg,
      Util::JSONArrayGenerator &resultJAG
      )
    {
      Util::JSONGenerator jg = resultJAG.makeElement();
      getDiagnostics().generateJSON( jg );
    }
    
    void Executable::jsonExecGetAST(
      RC::ConstHandle<JSON::Value> const &arg,
      Util::JSONArrayGenerator &resultJAG
      )
    {
      Util::JSONGenerator jg = resultJAG.makeElement();
      getAST()->generateJSON( true, jg );
    }
    
    void Executable::jsonExecResolveMapOperator(
      RC::ConstHandle<JSON::Value> const &arg,
      Util::JSONArrayGenerator &resultJAG
      )
    {
      RC::ConstHandle<JSON::Object> argObject = arg->toObject();
      
      std::string id_;
      try
      {
        id_ = argObject->get( "id" )->toString()->value();
      }
      catch ( Exception e )
      {
        throw "id: " + e;
      }
      
      std::string mapOperatorName;
      try
      {
        mapOperatorName = argObject->get( "mapOperatorName" )->toString()->value();
      }
      catch ( Exception e )
      {
        throw "mapOperatorName: " + e;
      }
      
      RC::Handle<MapOperator> mapOperator = resolveMapOperator( mapOperatorName );
      mapOperator->reg( m_gcContainer, id_ );
    }
    
    void Executable::jsonExecResolveReduceOperator(
      RC::ConstHandle<JSON::Value> const &arg,
      Util::JSONArrayGenerator &resultJAG
      )
    {
      RC::ConstHandle<JSON::Object> argObject = arg->toObject();
      
      std::string id_;
      try
      {
        id_ = argObject->get( "id" )->toString()->value();
      }
      catch ( Exception e )
      {
        throw "id: " + e;
      }
      
      std::string reduceOperatorName;
      try
      {
        reduceOperatorName = argObject->get( "reduceOperatorName" )->toString()->value();
      }
      catch ( Exception e )
      {
        throw "reduceOperatorName: " + e;
      }
      
      RC::Handle<ReduceOperator> reduceOperator = resolveReduceOperator( reduceOperatorName );
      reduceOperator->reg( m_gcContainer, id_ );
    }
    
    void Executable::jsonExecResolveArrayGeneratorOperator(
      RC::ConstHandle<JSON::Value> const &arg,
      Util::JSONArrayGenerator &resultJAG
      )
    {
      RC::ConstHandle<JSON::Object> argObject = arg->toObject();
      
      std::string id_;
      try
      {
        id_ = argObject->get( "id" )->toString()->value();
      }
      catch ( Exception e )
      {
        throw "id: " + e;
      }
      
      std::string arrayGeneratorOperatorName;
      try
      {
        arrayGeneratorOperatorName = argObject->get( "arrayGeneratorOperatorName" )->toString()->value();
      }
      catch ( Exception e )
      {
        throw "arrayGeneratorOperatorName: " + e;
      }
      
      RC::Handle<ArrayGeneratorOperator> arrayGeneratorOperator = resolveArrayGeneratorOperator( arrayGeneratorOperatorName );
      arrayGeneratorOperator->reg( m_gcContainer, id_ );
    }
    
    void Executable::jsonExecResolveValueMapOperator(
      RC::ConstHandle<JSON::Value> const &arg,
      Util::JSONArrayGenerator &resultJAG
      )
    {
      RC::ConstHandle<JSON::Object> argObject = arg->toObject();
      
      std::string id_;
      try
      {
        id_ = argObject->get( "id" )->toString()->value();
      }
      catch ( Exception e )
      {
        throw "id: " + e;
      }
      
      std::string operatorName;
      try
      {
        operatorName = argObject->get( "operatorName" )->toString()->value();
      }
      catch ( Exception e )
      {
        throw "operatorName: " + e;
      }
      
      resolveValueMapOperator( operatorName )->reg( m_gcContainer, id_ );
    }
  }
}
