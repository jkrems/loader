#include <nan.h>
#include <unordered_map>

using v8::MaybeLocal;
using v8::Promise;
using v8::Local;
using v8::Value;
using v8::Context;
using v8::ScriptOrModule;
using v8::String;
using v8::Isolate;
using v8::EscapableHandleScope;
using v8::Module;
using v8::Persistent;
using v8::Object;
using v8::Integer;
using v8::TryCatch;
using v8::ScriptOrigin;
using v8::ScriptCompiler;

class ModuleWrap : public Nan::ObjectWrap {
public:
  static ModuleWrap* GetFromModule(Local<Module> module) {
    ModuleWrap* ret = nullptr;
    auto range = module_map.equal_range(module->GetIdentityHash());
    for (auto it = range.first; it != range.second; ++it) {
      if (it->second->module_ == module) {
        ret = it->second;
        break;
      }
    }
    return ret;
  }

  static NAN_METHOD(New) {
    // CHECK(info.IsConstructCall());
    Local<Object> that = info.This();

    // CHECK(info[0]->IsString());
    Local<String> url = info[0].As<String>();

    ModuleWrap* obj = new ModuleWrap();
    obj->Wrap(that);
    obj->url_.Reset(info.GetIsolate(), url);
    // obj->context_.Reset(isolate, info.context);

    // env->module_map.emplace(module->GetIdentityHash(), obj);

    info.GetReturnValue().Set(that);
  }

  static NAN_METHOD(Compile) {
    ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

    // CHECK(info[0]->IsString());
    Local<String> source_text = info[0].As<String>();

    Local<Context> context = info.Holder()->CreationContext();
    Isolate* isolate = context->GetIsolate();
    Local<Integer> line_offset = Integer::New(isolate, 0);
    Local<Integer> column_offset = Integer::New(isolate, 0);

    TryCatch try_catch(isolate);
    Local<Module> module;

    // compile
    {
      ScriptOrigin origin(Nan::New(obj->url_),
                          line_offset,                          // line offset
                          column_offset,                        // column offset
                          False(isolate),                       // is cross origin
                          Local<Integer>(),                     // script id
                          Local<Value>(),                       // source map URL
                          False(isolate),                       // is opaque (?)
                          False(isolate),                       // is WASM
                          True(isolate));                       // is ES6 module
      Context::Scope context_scope(context);
      ScriptCompiler::Source source(source_text, origin);
      if (!ScriptCompiler::CompileModule(isolate, &source).ToLocal(&module)) {
        // CHECK(try_catch.HasCaught());
        // CHECK(!try_catch.Message().IsEmpty());
        // CHECK(!try_catch.Exception().IsEmpty());
        // AppendExceptionLine(env, try_catch.Exception(), try_catch.Message(),
        //                     ErrorHandlingMode::MODULE_ERROR);
        try_catch.ReThrow();
        return;
      }
    }

    obj->module_.Reset(isolate, module);
    obj->context_.Reset(isolate, context);
    module_map.emplace(module->GetIdentityHash(), obj);

    info.GetReturnValue().Set(info.Holder());
  }

  static MaybeLocal<Module> ResolveCallback(Local<Context> context,
                                               Local<String> specifier,
                                               Local<Module> referrer) {
    return MaybeLocal<Module>();
  }

  static NAN_METHOD(Evaluate) {
    ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

    Local<Module> module = Nan::New(obj->module_);
    Local<Context> context = Nan::New(obj->context_);

    TryCatch try_catch(info.GetIsolate());

    // TODO: move into separate functions
    v8::Maybe<bool> ok = module->InstantiateModule(context, ResolveCallback);
    if (!ok.FromMaybe(false)) {
      // CHECK(try_catch.HasCaught());
      // CHECK(!try_catch.Message().IsEmpty());
      // CHECK(!try_catch.Exception().IsEmpty());
      // AppendExceptionLine(env, try_catch.Exception(), try_catch.Message(),
      //                     ErrorHandlingMode::MODULE_ERROR);
      try_catch.ReThrow();
      return;
    }

    MaybeLocal<Value> result;
    result = module->Evaluate(context);

    if (try_catch.HasCaught()) {
      try_catch.ReThrow();
      return;
    }

    info.GetReturnValue().Set(result.ToLocalChecked());
  }

  static NAN_METHOD(GetNamespace) {
    ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

    Local<Module> module = Nan::New(obj->module_);
    Local<Value> result = module->GetModuleNamespace();
    info.GetReturnValue().Set(result);
  }

private:
  static std::unordered_multimap<int, ModuleWrap*> module_map;

  Persistent<v8::Module> module_;
  Persistent<v8::String> url_;
  // bool linked_ = false;
  // std::unordered_map<std::string, Persistent<v8::Promise>> resolve_cache_;
  Persistent<v8::Context> context_;
};
std::unordered_multimap<int, ModuleWrap*> ModuleWrap::module_map;

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
  using v8::FunctionTemplate;

  Nan::Export(target, "SetDynamicImportCallback", Loader::SetDynamicImportCallback);

  Local<String> class_name = Nan::New("ModuleWrap").ToLocalChecked();
  Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>(ModuleWrap::New);
  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->SetClassName(class_name);
  Nan::SetPrototypeMethod(tpl, "compile", ModuleWrap::Compile);
  Nan::SetPrototypeMethod(tpl, "evaluate", ModuleWrap::Evaluate);
  Nan::SetPrototypeMethod(tpl, "getNamespace", ModuleWrap::GetNamespace);
  Nan::Set(target, class_name, tpl->GetFunction());
}
NODE_MODULE(loader, InitAll)
