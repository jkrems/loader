#ifndef SRC_MODULE_WRAP_H_
#define SRC_MODULE_WRAP_H_

#include <nan.h>
#include <unordered_map>

class ModuleWrap : public Nan::ObjectWrap {
public:
  static ModuleWrap* GetFromModule(v8::Local<v8::Module> module);

  static NAN_METHOD(New);

  static NAN_METHOD(Compile);

  static v8::MaybeLocal<v8::Module> ResolveCallback(
      v8::Local<v8::Context> context,
      v8::Local<v8::String> specifier,
      v8::Local<v8::Module> referrer);

  static NAN_METHOD(Instantiate);

  static NAN_METHOD(Evaluate);

  static NAN_METHOD(GetNamespace);

  static NAN_METHOD(GetException);

  static NAN_METHOD(GetRequests);

  static NAN_METHOD(ResolveRequest);

  static NAN_METHOD(IsResolved);

  static NAN_METHOD(GetStatus);

  static NAN_MODULE_INIT(Init);

private:
  static std::unordered_multimap<int, ModuleWrap*> module_map;

  v8::Persistent<v8::Module> module_;
  v8::Persistent<v8::String> url_;
  // bool linked_ = false;
  std::unordered_map<std::string, v8::Persistent<v8::Object>> resolve_cache_;
  v8::Persistent<v8::Context> context_;
};

#endif // SRC_MODULE_WRAP_H_
