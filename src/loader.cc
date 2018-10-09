#include "loader.h"
#include "module_wrap.h"

using v8::Local;
using v8::Context;
using v8::ScriptOrModule;
using v8::String;
using v8::Isolate;
using v8::Value;
using v8::MaybeLocal;
using v8::Promise;
using v8::Module;
using v8::Object;

Nan::Callback Loader::dynamic_import_callback;
Nan::Callback Loader::import_meta_callback;

NAN_MODULE_INIT(Loader::Init) {
  Nan::Export(target, "setDynamicImportCallback", Loader::SetDynamicImportCallback);
  Nan::Export(target, "setInitImportMetaCallback", Loader::SetInitImportMetaCallback);
}

MaybeLocal<Promise> Loader::ImportModuleDynamically(
    Local<Context> context,
    Local<ScriptOrModule> referrer,
    Local<String> specifier) {
  Isolate* iso = context->GetIsolate();
  v8::EscapableHandleScope handle_scope(iso);

  auto options = referrer->GetHostDefinedOptions();

  Local<Value> args[] = {
    // TODO(jkrems): Provide context or even a richer Module referrer
    specifier.As<Value>(),
    referrer->GetResourceName(),
    Nan::New<v8::Boolean>(options->Length() > 0)
  };
  Local<Value> result = Nan::Call(dynamic_import_callback, 3, args).ToLocalChecked();
  return result.As<Promise>();
}

NAN_METHOD(Loader::SetDynamicImportCallback) {
  Isolate* iso = info.GetIsolate();

  Local<Value> callback = info[0];
  dynamic_import_callback.Reset(callback.As<v8::Function>());
  iso->SetHostImportModuleDynamicallyCallback(Loader::ImportModuleDynamically);
}

void Loader::InitImportMeta(Local<Context> context,
                            Local<Module> module,
                            Local<Object> meta) {
  Isolate* iso = context->GetIsolate();
  v8::EscapableHandleScope handle_scope(iso);

  ModuleWrap* obj = ModuleWrap::GetFromModule(module);
  Local<Value> args[] = {
    // TODO(jkrems): Provide context or even a richer Module referrer
    obj->handle(),
    meta
  };
  Nan::Call(import_meta_callback, 2, args).ToLocalChecked();
}

NAN_METHOD(Loader::SetInitImportMetaCallback) {
  Isolate* iso = info.GetIsolate();

  Local<Value> callback = info[0];
  import_meta_callback.Reset(callback.As<v8::Function>());
  iso->SetHostInitializeImportMetaObjectCallback(Loader::InitImportMeta);
}
