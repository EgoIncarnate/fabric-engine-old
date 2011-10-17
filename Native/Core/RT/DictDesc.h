/*
 *  Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
 */
 
#ifndef _FABRIC_RT_DICT_DESC_H
#define _FABRIC_RT_DICT_DESC_H

#include <Fabric/Core/RT/Desc.h>

namespace Fabric
{
  namespace RT
  {
    class ComparableDesc;
    class DictImpl;
    
    class DictDesc : public Desc
    {
      friend class Manager;
      
    public:
    
      RC::ConstHandle<RT::DictImpl> getImpl() const;
      
      void const *getImmutable( void const *data, void const *keyData ) const;
      void *getMutable( void *data, void const *keyData ) const;
      size_t getSize( void const *data ) const;
      
      RC::ConstHandle<ComparableDesc> getKeyDesc() const;
      RC::ConstHandle<Desc> getValueDesc() const;
      
      std::string descData( void const *data, size_t limit = SIZE_MAX ) const;
      
      virtual RC::Handle<JSON::Object> jsonDesc() const;
      
    protected:
    
      DictDesc(
        std::string const &name,
        RC::ConstHandle<DictImpl> const &dictImpl,
        RC::ConstHandle<ComparableDesc> const &keyDesc,
        RC::ConstHandle<Desc> const &valueDesc
        );
      
    private:
    
      RC::ConstHandle<DictImpl> m_dictImpl;
      RC::ConstHandle<ComparableDesc> m_keyDesc;
      RC::ConstHandle<Desc> m_valueDesc;
   };
  };
};

#endif //_FABRIC_RT_DICT_DESC_H
