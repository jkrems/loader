#include <nan.h>

using v8::MaybeLocal;
using v8::Promise;
using v8::Local;
using v8::Value;
using v8::Context;
using v8::ScriptOrModule;
using v8::String;
using v8::Isolate;
using v8::EscapableHandleScope;

class Loader {
public:
  static MaybeLocal<Promise> ImportModuleDynamically(
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

  static NAN_METHOD(SetDynamicImportCallback) {
    Isolate* iso = info.GetIsolate();

    Local<Value> callback = info[0];
    dynamic_import_callback.Reset(callback.As<v8::Function>());
    iso->SetHostImportModuleDynamicallyCallback(Loader::ImportModuleDynamically);
  }

private:
  static Nan::Callback dynamic_import_callback;
};

Nan::Callback Loader::dynamic_import_callback;

NAN_MODULE_INIT(InitAll) {
  Nan::Export(target, "SetDynamicImportCallback", Loader::SetDynamicImportCallback);
}
NODE_MODULE(loader, InitAll)
