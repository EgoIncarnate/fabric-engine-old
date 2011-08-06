#ifndef _FABRIC_CG_FLOAT_ADAPTER_H
#define _FABRIC_CG_FLOAT_ADAPTER_H

#include <Fabric/Core/CG/SimpleAdapter.h>

namespace llvm
{
  class Constant;
};

namespace Fabric
{
  namespace RT
  {
    class FloatDesc;
  }
  namespace CG
  {
    class FloatAdapter : public SimpleAdapter
    {
      friend class Manager;
    
    public:
      
      virtual std::string toString( void const *data ) const;
    
      virtual llvm::Constant *llvmDefaultValue( BasicBlockBuilder &basicBlockBuilder ) const;

      llvm::Constant *llvmConst( double value ) const;
      llvm::Constant *llvmConst( std::string const &valueString ) const;
      
      virtual void llvmPrepareModule( ModuleBuilder &moduleBuilder, bool buildFunctions ) const;
      
    protected:
      
      FloatAdapter( RC::ConstHandle<Manager> const &manager, RC::ConstHandle<RT::FloatDesc> const &floatDesc );
      
      std::string internalFunctionNameForType( std::string const &externalFunctionName ) const;
      std::string externalFunctionNameForType( std::string const &externalFunctionName ) const;
      
    private:
    
      RC::ConstHandle<RT::FloatDesc> m_floatDesc;
      llvm::Type const *m_integerTypeOfSameWidth;
    };
  };
};

#endif //_FABRIC_CG_FLOAT_ADAPTER_H