#include "module_wrap.h"
#include <assert.h>

using v8::Local;
using v8::Module;
using v8::Object;
using v8::String;
using v8::Context;
using v8::Isolate;
using v8::Integer;
using v8::ScriptOrigin;
using v8::TryCatch;
using v8::ScriptCompiler;
using v8::MaybeLocal;
using v8::Value;

std::unordered_multimap<int, ModuleWrap*> ModuleWrap::module_map;

NAN_MODULE_INIT(ModuleWrap::Init) {
  using Nan::New;
  using Nan::Set;
  using Nan::SetPrototypeMethod;
  using v8::FunctionTemplate;

  Local<String> class_name = New("ModuleWrap").ToLocalChecked();
  Local<FunctionTemplate> tpl = New<FunctionTemplate>(ModuleWrap::New);
  tpl->SetClassName(class_name);

  tpl->InstanceTemplate()->SetInternalFieldCount(1);
  tpl->InstanceTemplate()
     ->SetAccessorProperty(New("status").ToLocalChecked(),
                           New<FunctionTemplate>(ModuleWrap::GetStatus));
  tpl->InstanceTemplate()
     ->SetAccessorProperty(New("namespace").ToLocalChecked(),
                           New<FunctionTemplate>(ModuleWrap::GetNamespace));
  tpl->InstanceTemplate()
     ->SetAccessorProperty(New("requests").ToLocalChecked(),
                           New<FunctionTemplate>(ModuleWrap::GetRequests));
  tpl->InstanceTemplate()
     ->SetAccessorProperty(New("exception").ToLocalChecked(),
                           New<FunctionTemplate>(ModuleWrap::GetException));

  SetPrototypeMethod(tpl, "compile", ModuleWrap::Compile);
  SetPrototypeMethod(tpl, "instantiate", ModuleWrap::Instantiate);
  SetPrototypeMethod(tpl, "evaluate", ModuleWrap::Evaluate);
  SetPrototypeMethod(tpl, "resolveRequest", ModuleWrap::ResolveRequest);
  SetPrototypeMethod(tpl, "isResolved", ModuleWrap::IsResolved);

  Local<v8::Function> module_ctor = tpl->GetFunction();
  Set(module_ctor, New("kUncompiled").ToLocalChecked(), Nan::Null());
#define ExportModuleStatusConstant(STATUS) \
  Set(module_ctor, New(#STATUS).ToLocalChecked(), New(Module::STATUS))
  ExportModuleStatusConstant(kUninstantiated);
  ExportModuleStatusConstant(kInstantiating);
  ExportModuleStatusConstant(kInstantiated);
  ExportModuleStatusConstant(kEvaluating);
  ExportModuleStatusConstant(kEvaluated);
  ExportModuleStatusConstant(kErrored);
#undef ExportModuleStatusConstant
  Set(target, class_name, module_ctor);
}

ModuleWrap* ModuleWrap::GetFromModule(Local<Module> module) {
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

NAN_METHOD(ModuleWrap::New) {
  assert(info.IsConstructCall());
  Local<Object> that = info.This();

  if(!info[0]->IsString()) {
    Nan::ThrowTypeError("Expected first argument (url) to be a string");
    return;
  }
  Local<String> url = info[0].As<String>();
  Nan::Set(that, Nan::New("url").ToLocalChecked(), url);

  ModuleWrap* obj = new ModuleWrap();
  obj->Wrap(that);
  obj->url_.Reset(info.GetIsolate(), url);
  obj->context_.Reset(info.GetIsolate(), info.Holder()->CreationContext());

  info.GetReturnValue().Set(that);
}

NAN_METHOD(ModuleWrap::Compile) {
  ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

  if(!info[0]->IsString()) {
    Nan::ThrowTypeError("Expected first argument (source) to be a string");
    return;
  }
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
      assert(try_catch.HasCaught());
      assert(!try_catch.Message().IsEmpty());
      assert(!try_catch.Exception().IsEmpty());
      // AppendExceptionLine(env, try_catch.Exception(), try_catch.Message(),
      //                     ErrorHandlingMode::MODULE_ERROR);
      obj->early_exception_.Reset(isolate, try_catch.Exception());
      try_catch.ReThrow();
      return;
    }
  }

  obj->module_.Reset(isolate, module);
  obj->context_.Reset(isolate, context);
  module_map.emplace(module->GetIdentityHash(), obj);

  info.GetReturnValue().Set(info.Holder());
}

MaybeLocal<Module> ModuleWrap::ResolveCallback(Local<Context> context,
                                               Local<String> specifier,
                                               Local<Module> referrer) {
  ModuleWrap* obj = GetFromModule(referrer);
  Nan::Utf8String specifier_utf8(specifier);
  std::string specifier_std(*specifier_utf8, specifier_utf8.length());

  Local<Object> resolve_object =
      obj->resolve_cache_[specifier_std].Get(context->GetIsolate());
  ModuleWrap* module = ObjectWrap::Unwrap<ModuleWrap>(resolve_object);
  // TODO: CHECK that module has been compiled at the very least
  return module->module_.Get(context->GetIsolate());
}

NAN_METHOD(ModuleWrap::Instantiate) {
  ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());
  Isolate* isolate = info.GetIsolate();

  Local<Module> module = Nan::New(obj->module_);
  Local<Context> context = Nan::New(obj->context_);

  TryCatch try_catch(isolate);

  v8::Maybe<bool> ok = module->InstantiateModule(context, ResolveCallback);
  if (!ok.FromMaybe(false)) {
    assert(try_catch.HasCaught());
    assert(!try_catch.Message().IsEmpty());
    assert(!try_catch.Exception().IsEmpty());
    // AppendExceptionLine(env, try_catch.Exception(), try_catch.Message(),
    //                     ErrorHandlingMode::MODULE_ERROR);
    try_catch.ReThrow();
    return;
  }

  info.GetReturnValue().Set(true);
}

NAN_METHOD(ModuleWrap::Evaluate) {
  ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

  Local<Module> module = Nan::New(obj->module_);
  Local<Context> context = Nan::New(obj->context_);

  TryCatch try_catch(info.GetIsolate());

  MaybeLocal<Value> result;
  result = module->Evaluate(context);

  if (try_catch.HasCaught()) {
    try_catch.ReThrow();
    return;
  }

  info.GetReturnValue().Set(result.ToLocalChecked());
}

NAN_METHOD(ModuleWrap::GetNamespace) {
  ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

  Local<Module> module = Nan::New(obj->module_);
  Local<Value> result = module->GetModuleNamespace();
  info.GetReturnValue().Set(result);
}

NAN_METHOD(ModuleWrap::GetException) {
  ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

  if (obj->module_.IsEmpty()) {
    Local<Value> early_exception = Nan::New(obj->early_exception_);
    if (early_exception.IsEmpty()) {
      return;
    }
    info.GetReturnValue().Set(early_exception);
    return;
  }

  Local<Module> module = Nan::New(obj->module_);
  if (module->GetStatus() != Module::kErrored) {
    return;
  }
  Local<Value> exception = module->GetException();
  info.GetReturnValue().Set(exception);
}

NAN_METHOD(ModuleWrap::GetRequests) {
  ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());
  Local<Module> module = Nan::New(obj->module_);

  int len = module->GetModuleRequestsLength();
  Local<v8::Array> requests = Nan::New<v8::Array>(len);

  for (int i = 0; i < len; ++i) {
    requests->Set(i, module->GetModuleRequest(i));
  }

  info.GetReturnValue().Set(requests);
}

NAN_METHOD(ModuleWrap::ResolveRequest) {
  ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

  assert(info[0]->IsString());
  Local<String> specifier = info[0].As<String>();
  Nan::Utf8String specifier_utf8(specifier);
  std::string specifier_std(*specifier_utf8, specifier_utf8.length());

  assert(info[1]->IsObject());
  Local<Object> resolved = info[1].As<Object>();

  obj->resolve_cache_[specifier_std].Reset(info.GetIsolate(), resolved);
}

NAN_METHOD(ModuleWrap::IsResolved) {
  ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

  assert(info[0]->IsString());
  Local<String> specifier = info[0].As<String>();
  Nan::Utf8String specifier_utf8(specifier);
  std::string specifier_std(*specifier_utf8, specifier_utf8.length());

  info.GetReturnValue().Set(Nan::New<v8::Boolean>(!obj->resolve_cache_[specifier_std].IsEmpty()));
}

NAN_METHOD(ModuleWrap::GetStatus) {
  ModuleWrap* obj = ObjectWrap::Unwrap<ModuleWrap>(info.Holder());

  Local<Module> module = Nan::New(obj->module_);
  if (module.IsEmpty()) {
    if (obj->early_exception_.IsEmpty()) {
      info.GetReturnValue().SetNull();
    } else {
      info.GetReturnValue().Set(Module::kErrored);
    }
    return;
  }

  info.GetReturnValue().Set(module->GetStatus());
}
