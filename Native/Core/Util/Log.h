/*
 *  Copyright 2010-2011 Fabric Technologies Inc. All rights reserved.
 */

#ifndef _FABRIC_UTIL_LOG_H
#define _FABRIC_UTIL_LOG_H

#include <Fabric/Base/Config.h>

# include <stdio.h>
# include <string.h>
# include <stdarg.h>

#if defined(FABRIC_POSIX)

# include <unistd.h>
# include <errno.h>

inline void FABRIC_WRITE_CSTR( char const *data, size_t length )
{
  for (;;)
  {
    int result = write( 2, data, length );
    if ( result != EINTR )
      break;
  }
}

#elif defined(FABRIC_OS_WINDOWS)

void FABRIC_WRITE_CSTR( char const *data, size_t length );

#endif

inline void FABRIC_LOG_CSTR( char const *data )
{
  char buf[65536];
  int length = snprintf(buf, 65536, "[FABRIC] %s\n", data);
  FABRIC_WRITE_CSTR( buf, length );
}

inline void FABRIC_LOG( char const *format, ... )
{
  char buf[65536];
  va_list args;
  va_start( args, format );
  int length = vsnprintf( buf, 65536, format, args );
  va_end( args );
  if ( length > 0 )
    FABRIC_LOG_CSTR( buf );
}

inline void FABRIC_LOG( std::string const &string )
{
  FABRIC_LOG_CSTR( string.c_str() );
}

#endif //_FABRIC_UTIL_LOG_H
