#include <nan.h>

NAN_METHOD(SetDynamicImportCallback) {
  printf("Set dynamic import callback called\n");
}

NAN_MODULE_INIT(InitAll) {
  NAN_EXPORT(target, SetDynamicImportCallback);
}
NODE_MODULE(loader, InitAll)
