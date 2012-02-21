/*
 *  Copyright 2010-2012 Fabric Technologies Inc. All rights reserved.
 */

#ifndef _FABRIC_DG_LOG_COLLECTOR_H
#define _FABRIC_DG_LOG_COLLECTOR_H

#include <Fabric/Core/MT/LogCollector.h>
#include <Fabric/Base/RC/Handle.h>

namespace Fabric
{
  namespace DG
  {
    class Context;
    
    class LogCollector : public MT::LogCollector
    {
    public:
    
      static RC::Handle<LogCollector> Create( Context *context );
    
    protected:
    
      LogCollector( Context *context );
      virtual ~LogCollector();
      
      virtual void logString( char const *data, size_t length );
      
    private:
    
      Context *m_context;
    };
  };
};

#endif //_FABRIC_DG_LOG_COLLECTOR_H
