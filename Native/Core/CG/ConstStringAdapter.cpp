/*
 *  Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
 */
 
#include "ConstStringAdapter.h"
#include "BooleanAdapter.h"
#include "IntegerAdapter.h"
#include "SizeAdapter.h"
#include "StringAdapter.h"
#include "OpaqueAdapter.h"
#include "Manager.h"
#include "ModuleBuilder.h"
#include "FunctionBuilder.h"
#include "BasicBlockBuilder.h"
#include "OverloadNames.h"

#include <Fabric/Core/RT/ConstStringDesc.h>

#include <llvm/Module.h>
#include <llvm/Function.h>

namespace Fabric
{
  namespace CG
  {
    ConstStringAdapter::ConstStringAdapter( RC::ConstHandle<Manager> const &manager, RC::ConstHandle<RT::ConstStringDesc> const &constStringDesc )
      : Adapter( manager, constStringDesc, FL_PASS_BY_REFERENCE )
      , m_constStringDesc( constStringDesc )
    {
      std::vector<llvm::Type const *> memberLLVMTypes;
      memberLLVMTypes.push_back( llvm::Type::getInt8PtrTy( getLLVMContext() ) );
      memberLLVMTypes.push_back( llvmSizeType() );
      setLLVMType( llvm::StructType::get( manager->getLLVMContext(), memberLLVMTypes, true ) );
    }
    
    void ConstStringAdapter::llvmCompileToModule( ModuleBuilder &moduleBuilder ) const
    {
      if ( moduleBuilder.haveCompiledToModule( getCodeName() ) )
        return;
      
      RC::ConstHandle<BooleanAdapter> booleanAdapter = getManager()->getBooleanAdapter();
      booleanAdapter->llvmCompileToModule( moduleBuilder );
      RC::ConstHandle<StringAdapter> stringAdapter = getManager()->getStringAdapter();
      stringAdapter->llvmCompileToModule( moduleBuilder );
      
      moduleBuilder->addTypeName( getCodeName(), llvmRawType() );
      
      static const bool buildFunctions = true;

      {
        // [pzion 20110202] Cast string to boolean
        std::string name = constructOverloadName( booleanAdapter, this );
        std::vector< FunctionParam > params;
        params.push_back( FunctionParam( "booleanLValue", booleanAdapter, USAGE_LVALUE ) );
        params.push_back( FunctionParam( "constStringRValue", this, USAGE_RVALUE ) );
        FunctionBuilder functionBuilder( moduleBuilder, name, ExprType(), params );
        if ( buildFunctions )
        {
          llvm::Value *booleanLValue = functionBuilder[0];
          llvm::Value *constStringRValue = functionBuilder[1];
          BasicBlockBuilder basicBlockBuilder( functionBuilder );
          basicBlockBuilder->SetInsertPoint( functionBuilder.createBasicBlock( "entry" ) );
          llvm::Value *lengthLValue = basicBlockBuilder->CreateStructGEP( constStringRValue, 1 );
          llvm::Value *lengthRValue = basicBlockBuilder->CreateLoad( lengthLValue );
          llvm::Value *booleanRValue = basicBlockBuilder->CreateICmpNE( lengthRValue, llvm::ConstantInt::get( llvmSizeType(), 0, false ) );
          booleanAdapter->llvmDefaultAssign( basicBlockBuilder, booleanLValue, booleanRValue );
          basicBlockBuilder->CreateRetVoid();
        }
      }
      
      {
        std::string name = constructOverloadName( stringAdapter, this );
        std::vector<FunctionParam> params;
        params.push_back( FunctionParam( "stringLValue", stringAdapter, USAGE_LVALUE ) );
        params.push_back( FunctionParam( "constStringRValue", this, USAGE_RVALUE ) );
        FunctionBuilder functionBuilder( moduleBuilder, name, ExprType(), params );
        if ( buildFunctions )
        {
          llvm::Value *stringLValue = functionBuilder[0];
          llvm::Value *constStringRValue = functionBuilder[1];
          BasicBlockBuilder basicBlockBuilder( functionBuilder );
          basicBlockBuilder->SetInsertPoint( functionBuilder.createBasicBlock( "entry" ) );
          llvm::Value *constStringLValue = llvmRValueToLValue( basicBlockBuilder, constStringRValue );
          llvm::Value *stringRValue = stringAdapter->llvmCallCast( basicBlockBuilder, this, constStringLValue );
          stringAdapter->llvmAssign( basicBlockBuilder, stringLValue, stringRValue );
          basicBlockBuilder->CreateRetVoid();
        }
      }
    }
    
    llvm::Constant *ConstStringAdapter::llvmDefaultValue( BasicBlockBuilder &basicBlockBuilder ) const
    {
      std::vector<llvm::Constant *> elementDefaultRValues;
      elementDefaultRValues.push_back( llvm::ConstantPointerNull::get( llvm::Type::getInt8PtrTy( getLLVMContext() ) ) );
      elementDefaultRValues.push_back( basicBlockBuilder.getManager()->getSizeAdapter()->llvmConst( 0 ) );
      return llvm::ConstantStruct::get( (llvm::StructType const *)llvmRawType(), elementDefaultRValues );
    }
      
    llvm::Value *ConstStringAdapter::llvmConst( CG::BasicBlockBuilder &basicBlockBuilder, char const *data, size_t length ) const
    {
      llvm::Type const *charType = llvm::Type::getInt8Ty( getLLVMContext() );
      std::vector<llvm::Constant *> chars;
      for ( size_t i=0; i<length; ++i )
        chars.push_back( llvm::ConstantInt::get( charType, data[i] ) );
      llvm::Constant *dataConstant = llvm::ConstantArray::get( llvm::ArrayType::get( charType, length ), chars );

      llvm::Value *dataGlobal = new llvm::GlobalVariable(
        *basicBlockBuilder.getModuleBuilder(),
        dataConstant->getType(),
        true,
        llvm::GlobalValue::InternalLinkage,
        dataConstant,
        ""
        );

      llvm::Constant *llvmData = llvm::cast<llvm::Constant>( basicBlockBuilder->CreateConstGEP2_32( dataGlobal, 0, 0 ) );
      llvm::Constant *llvmLength = llvm::ConstantInt::get( llvmSizeType(), length, false );
      
      std::vector<llvm::Constant *> elementDefaultRValues;
      elementDefaultRValues.push_back( llvmData );
      elementDefaultRValues.push_back( llvmLength );
      llvm::Constant *llvmStruct = llvm::ConstantStruct::get( (llvm::StructType const *)llvmRawType(), elementDefaultRValues );

      return new llvm::GlobalVariable(
        *basicBlockBuilder.getModuleBuilder(),
        llvmStruct->getType(),
        true,
        llvm::GlobalValue::InternalLinkage,
        llvmStruct,
        ""
        );
    }
    
    std::string ConstStringAdapter::toString( void const *data ) const
    {
      return m_constStringDesc->toString( data );
    }

    void ConstStringAdapter::llvmInit( CG::BasicBlockBuilder &basicBlockBuilder, llvm::Value *value ) const
    {
    }

    void ConstStringAdapter::llvmRetain( BasicBlockBuilder &basicBlockBuilder, llvm::Value *rValue ) const
    {
    }

    void ConstStringAdapter::llvmDefaultAssign( BasicBlockBuilder &basicBlockBuilder, llvm::Value *dstLValue, llvm::Value *srcRValue ) const
    {
      basicBlockBuilder->CreateStore( srcRValue, dstLValue );
    }
    
    void ConstStringAdapter::llvmRelease( BasicBlockBuilder &basicBlockBuilder, llvm::Value *rValue ) const
    {
    }
    
    void *ConstStringAdapter::llvmResolveExternalFunction( std::string const &functionName ) const
    {
      return 0;
    }
  };
};
