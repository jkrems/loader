#ifndef SRC_LOADER_H_
#define SRC_LOADER_H_

#include <nan.h>

class Loader {
public:
  static v8::MaybeLocal<v8::Promise> ImportModuleDynamically(
      v8::Local<v8::Context> context,
      v8::Local<v8::ScriptOrModule> referrer,
      v8::Local<v8::String> specifier);

  static NAN_METHOD(SetDynamicImportCallback);

  static void InitImportMeta(v8::Local<v8::Context> context,
                             v8::Local<v8::Module> module,
                             v8::Local<v8::Object> meta);

  static NAN_METHOD(SetInitImportMetaCallback);

  static NAN_MODULE_INIT(Init);

private:
  static Nan::Callback dynamic_import_callback;
  static Nan::Callback import_meta_callback;
};

#endif // SRC_LOADER_H_
