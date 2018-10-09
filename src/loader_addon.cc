#include "module_wrap.h"
#include "loader.h"

NAN_MODULE_INIT(InitAll) {
  Loader::Init(target);
  ModuleWrap::Init(target);
}
NODE_MODULE(loader, InitAll)
