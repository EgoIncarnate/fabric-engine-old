/*
 *  Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
 */
 
#ifndef _FABRIC_GC_OBJECT_H
#define _FABRIC_GC_OBJECT_H

#include <Fabric/Base/RC/Object.h>
#include <Fabric/Base/RC/Handle.h>

#include <vector>
#include <string>

namespace Fabric
{
  namespace Util
  {
    class JSONArrayGenerator;
  };
  
  namespace JSON
  {
    class Value;
  };
  
  namespace GC
  {
    class Container;
    
    struct Class
    {
      Class const *parentClass;
    };

#define FABRIC_GC_OBJECT_CLASS_DECL() \
    public: \
      static Fabric::GC::Class const *s_class; \
    private:
      
#define FABRIC_GC_OBJECT_CLASS_IMPL(class_,parentClass) \
    Fabric::GC::Class const *class_::s_class = { parentClass::s_class };
    
#define FABRIC_GC_OBJECT_CLASS_PARAM Fabric::GC::Class const *__gc_object_class
#define FABRIC_GC_OBJECT_CLASS_ARG __gc_object_class
#define FABRIC_GC_OBJECT_MY_CLASS s_class

    class Object : public RC::Object
    {
      friend class Container;
      
    protected:
    
      FABRIC_GC_OBJECT_CLASS_DECL()
      
    public:

      Object( FABRIC_GC_OBJECT_CLASS_PARAM );
      ~Object();
      
      Class const *getClass() const
      {
        return m_class;
      }
      
      void reg( Container *container, std::string const &id_ );

      virtual void jsonRoute(
        std::vector<std::string> const &dst,
        size_t dstOffset,
        std::string const &cmd,
        RC::ConstHandle<JSON::Value> const &arg,
        Util::JSONArrayGenerator &resultJAG
        );
        
      virtual void jsonExec(
        std::string const &cmd,
        RC::ConstHandle<JSON::Value> const &arg,
        Util::JSONArrayGenerator &resultJAG
        );
        
    protected:
    
      void dispose();
      
    private:
    
      Fabric::GC::Class const *m_class;
      Container *m_container;
      std::string m_id;
    };

    template<class T> RC::Handle<T> DynCast( RC::Handle<Object> const &object )
    {
      RC::Handle<T> result = 0;
      if ( object )
      {
        Class const *targetClass = T::s_class;
        Class const *objectClass = object->m_class;
        while ( objectClass )
        {
          if ( objectClass == targetClass )
          {
            result = RC::Handle<T>::StaticCast( object );
            break;
          }
          objectClass = objectClass->parentClass;
        }
      }
      return result;
    }
  
    template<class T> bool IsA( RC::Handle<Object> const &object )
    {
      return !!DynCast<T>( object );
    }

    template<class T> RC::Handle<T> Cast( RC::Handle<Object> const &object )
    {
      RC::Handle<T> result = DynCast<T>( object );
      FABRIC_ASSERT( result );
      return result;
    }
  }
}

#endif //_FABRIC_GC_OBJECT_H
