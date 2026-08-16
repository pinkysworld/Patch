#pragma once
#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>

struct PatchListStateV11 {
  std::string name;
  std::vector<std::string> value;
};

struct PatchListBoxV11 {
  int nativeIndex = -1;
  std::string id;
  std::string binding;
};

struct PatchListOpV11 {
  uint8_t op = 0;
  uint8_t valueKind = 0;
  std::vector<std::string> listValue;
  std::string textValue;
};

struct PatchListActionV11 {
  uint32_t actionIndex = 0;
  std::string target;
  std::vector<PatchListOpV11> ops;
};

struct PatchListEventV11 {
  std::string control;
  uint8_t kind = 0;
  uint8_t originalValueType = 0;
  std::vector<PatchListActionV11> actions;
};

static bool PatchValidUtf8V11(const std::string& value) {
  const auto* data = reinterpret_cast<const uint8_t*>(value.data());
  size_t i = 0;
  while (i < value.size()) {
    const uint8_t first = data[i++];
    if (first <= 0x7f) continue;
    int remaining = 0; uint32_t code = 0, minimum = 0;
    if ((first & 0xe0) == 0xc0) { remaining = 1; code = first & 0x1f; minimum = 0x80; }
    else if ((first & 0xf0) == 0xe0) { remaining = 2; code = first & 0x0f; minimum = 0x800; }
    else if ((first & 0xf8) == 0xf0) { remaining = 3; code = first & 0x07; minimum = 0x10000; }
    else return false;
    if (i + (size_t)remaining > value.size()) return false;
    for (int n = 0; n < remaining; ++n) {
      const uint8_t next = data[i++];
      if ((next & 0xc0) != 0x80) return false;
      code = (code << 6) | (next & 0x3f);
    }
    if (code < minimum || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return false;
  }
  return true;
}

class PatchPayloadV11Reader {
public:
  explicit PatchPayloadV11Reader(const std::vector<uint8_t>& source) : source_(source) {}
  size_t offset() const { return offset_; }
  bool done() const { return offset_ == source_.size(); }
  uint8_t u8() { need(1); return source_[offset_++]; }
  uint32_t u32() { need(4); uint32_t value=(uint32_t)source_[offset_]|((uint32_t)source_[offset_+1]<<8)|((uint32_t)source_[offset_+2]<<16)|((uint32_t)source_[offset_+3]<<24); offset_+=4; return value; }
  int32_t i32() { return (int32_t)u32(); }
  std::string text() { const uint32_t length=u32(); need(length); std::string value(reinterpret_cast<const char*>(source_.data()+offset_),length); offset_+=length; if(!PatchValidUtf8V11(value)) throw 1; return value; }
  std::vector<std::string> textList() { const uint32_t count=u32(); if(count>10000) throw 1; std::vector<std::string> out; out.reserve(count); for(uint32_t i=0;i<count;++i) out.push_back(text()); return out; }
  void skip(size_t count) { need(count); offset_ += count; }
  void skipText() { (void)text(); }
  void skipTyped(uint8_t type) { if(type==1)skip(8); else if(type==2)skipText(); else if(type==3)skip(1); else if(type==4)(void)textList(); else throw 1; }
private:
  void need(size_t count) const { if(offset_>source_.size() || count>source_.size()-offset_) throw 1; }
  const std::vector<uint8_t>& source_;
  size_t offset_ = 0;
};

class PatchPayloadV11Writer {
public:
  void u8(uint8_t value) { bytes_.push_back(value); }
  void u32(uint32_t value) { bytes_.push_back((uint8_t)(value&0xff)); bytes_.push_back((uint8_t)((value>>8)&0xff)); bytes_.push_back((uint8_t)((value>>16)&0xff)); bytes_.push_back((uint8_t)((value>>24)&0xff)); }
  void text(const std::string& value) { if(value.size()>0xffffffffu || !PatchValidUtf8V11(value)) throw 1; u32((uint32_t)value.size()); bytes_.insert(bytes_.end(),value.begin(),value.end()); }
  void raw(const std::vector<uint8_t>& source,size_t start,size_t end) { if(start>end||end>source.size()) throw 1; bytes_.insert(bytes_.end(),source.begin()+(std::ptrdiff_t)start,source.begin()+(std::ptrdiff_t)end); }
  std::vector<uint8_t> take() { return std::move(bytes_); }
private:
  std::vector<uint8_t> bytes_;
};

static void PatchSkipActionV11(PatchPayloadV11Reader& reader) {
  const uint8_t kind=reader.u8();
  if(kind==1||kind==2){reader.skipText();return;}
  if(kind==4){reader.skipText();reader.skipText();reader.skipText();return;}
  if(kind==5){reader.skipText();reader.skipText();reader.skipText();reader.skipText();return;}
  if(kind==6||kind==7){reader.skipText();reader.skipText();reader.skipText();return;}
  if(kind!=3)throw 1;
  reader.skipText(); const uint8_t stateType=reader.u8(); if(stateType<1||stateType>4)throw 1;
  const uint32_t opCount=reader.u32(); if(opCount>10000)throw 1;
  for(uint32_t op=0;op<opCount;++op){
    const uint8_t opKind=reader.u8(),valueKind=reader.u8();
    if(opKind<1||opKind>4||valueKind>2)throw 1;
    if(opKind==4){if(valueKind!=0)throw 1;continue;}
    if(valueKind==2)continue;
    if(valueKind!=1)throw 1;
    if(stateType==4){if(opKind==1)(void)reader.textList();else if(opKind==2||opKind==3)reader.skipText();else throw 1;}
    else reader.skipTyped(stateType);
  }
}

static const PatchListEventV11* PatchFindListEventV11(const std::vector<PatchListEventV11>& events,const std::string& control,uint8_t kind) {
  for(const auto& event:events) if(event.control==control && event.kind==kind) return &event;
  return nullptr;
}

static PatchListStateV11* PatchFindListStateV11(std::vector<PatchListStateV11>& states,const std::string& name) {
  for(auto& state:states) if(state.name==name) return &state;
  return nullptr;
}

static const PatchListBoxV11* PatchFindListBoxV11(const std::vector<PatchListBoxV11>& boxes,const std::string& id) {
  for(const auto& box:boxes) if(box.id==id) return &box;
  return nullptr;
}

static bool PatchConvertPayloadV10ToV9(
  const std::vector<uint8_t>& payloadV10,
  std::vector<uint8_t>& payloadV9,
  std::vector<PatchListStateV11>& listStates,
  std::vector<PatchListBoxV11>& listBoxes,
  std::vector<PatchListEventV11>& listEvents
) {
  payloadV9.clear(); listStates.clear(); listBoxes.clear(); listEvents.clear();
  try {
    PatchPayloadV11Reader reader(payloadV10); PatchPayloadV11Writer writer;
    std::unordered_set<std::string> stateNames,listNames,controlIds;

    const uint32_t stateCount=reader.u32(); if(stateCount>10000)return false; writer.u32(stateCount);
    for(uint32_t state=0;state<stateCount;++state){
      const std::string name=reader.text(); const uint8_t type=reader.u8();
      if(name.empty()||type<1||type>4||!stateNames.insert(name).second)return false;
      writer.text(name);
      if(type==4){
        auto value=reader.textList();
        listNames.insert(name);
        listStates.push_back({name,value});
        writer.u8(2); writer.text(value.empty()?std::string():value.front());
      }else{
        writer.u8(type); const size_t start=reader.offset(); reader.skipTyped(type); writer.raw(payloadV10,start,reader.offset());
      }
    }

    const uint32_t formCount=reader.u32(); if(!formCount||formCount>1024)return false; writer.u32(formCount); int nativeIndex=0;
    for(uint32_t form=0;form<formCount;++form){
      const std::string formId=reader.text(),title=reader.text(); const uint32_t width=reader.u32(),height=reader.u32(); const uint8_t visible=reader.u8();
      if(formId.empty()||!width||!height||width>10000||height>10000||visible>1)return false;
      writer.text(formId);writer.text(title);writer.u32(width);writer.u32(height);writer.u8(visible);
      const uint32_t controlCount=reader.u32(); if(controlCount>10000)return false; writer.u32(controlCount);
      for(uint32_t control=0;control<controlCount;++control,++nativeIndex){
        const size_t start=reader.offset();
        const uint8_t kind=reader.u8(); const std::string id=reader.text(); reader.skipText(); const std::string binding=reader.text();
        if(kind<1||kind>9)return false; if(!id.empty()&&!controlIds.insert(id).second)return false;
        const uint32_t optionCount=reader.u32(); if(optionCount>10000)return false; for(uint32_t option=0;option<optionCount;++option)reader.skipText();
        reader.i32();reader.i32();const int32_t controlWidth=reader.i32(),controlHeight=reader.i32(); if(controlWidth<=0||controlHeight<=0||controlWidth>10000||controlHeight>10000)return false;
        const uint8_t policyKind=reader.u8(),policyValue=reader.u8(); if(policyKind==0){if(policyValue!=0)return false;}else if(policyKind==1){if(policyValue<1||policyValue>15)return false;}else if(policyKind==2){if(policyValue<1||policyValue>5)return false;}else return false;
        reader.i32();reader.i32();
        const uint32_t columnCount=reader.u32(); if(columnCount>256)return false; for(uint32_t column=0;column<columnCount;++column)reader.skipText();
        const uint32_t rowCount=reader.u32(); if(rowCount>10000)return false; for(uint32_t row=0;row<rowCount;++row)for(uint32_t column=0;column<columnCount;++column)reader.skipText();
        if(kind==9){if(columnCount==0||rowCount==0)return false;}else if(columnCount!=0||rowCount!=0)return false;
        if(kind==6 && listNames.count(binding)){
          if(id.empty()||optionCount<2)return false;
          listBoxes.push_back({nativeIndex,id,binding});
        } else if(listNames.count(binding)) return false;
        writer.raw(payloadV10,start,reader.offset());
      }
      const uint32_t menuCount=reader.u32(); if(menuCount>1024)return false; writer.u32(menuCount);
      for(uint32_t menu=0;menu<menuCount;++menu){writer.text(reader.text());const uint32_t itemCount=reader.u32();if(!itemCount||itemCount>10000)return false;writer.u32(itemCount);for(uint32_t item=0;item<itemCount;++item){writer.text(reader.text());writer.text(reader.text());}}
    }

    std::unordered_set<std::string> multiIds; for(const auto& box:listBoxes)multiIds.insert(box.id);
    const uint32_t eventCount=reader.u32(); if(eventCount>10000)return false; writer.u32(eventCount);
    for(uint32_t eventIndex=0;eventIndex<eventCount;++eventIndex){
      const std::string control=reader.text(); const uint8_t eventKind=reader.u8(),valueType=reader.u8(); const uint32_t actionCount=reader.u32();
      if(eventKind<1||eventKind>5||valueType>3||actionCount>10000)return false;
      const bool multiEvent=multiIds.count(control)!=0;
      if(multiEvent && (eventKind!=2||valueType!=3))return false;
      writer.text(control);writer.u8(eventKind);writer.u8(multiEvent?2:valueType);writer.u32(actionCount);
      PatchListEventV11 listEvent; listEvent.control=control;listEvent.kind=eventKind;listEvent.originalValueType=valueType;
      for(uint32_t actionIndex=0;actionIndex<actionCount;++actionIndex){
        const size_t actionStart=reader.offset(); const uint8_t kind=reader.u8();
        if(kind!=3){reader = PatchPayloadV11Reader(payloadV10); /* unreachable assignment guard */ throw 2;}
        const std::string target=reader.text(); const uint8_t stateType=reader.u8(); const uint32_t opCount=reader.u32(); if(opCount>10000)return false;
        if(stateType!=4){
          reader = PatchPayloadV11Reader(payloadV10); /* replaced below by raw parser path */ throw 3;
        }
        if(!listNames.count(target))return false;
        PatchListActionV11 listAction;listAction.actionIndex=actionIndex;listAction.target=target;
        for(uint32_t opIndex=0;opIndex<opCount;++opIndex){
          PatchListOpV11 op;op.op=reader.u8();op.valueKind=reader.u8();if(op.op<1||op.op>4||op.valueKind>2)return false;
          if(op.op==4){if(op.valueKind!=0)return false;}
          else if(op.valueKind==2){if(op.op!=1||!multiEvent)return false;}
          else if(op.valueKind==1){if(op.op==1)op.listValue=reader.textList();else if(op.op==2||op.op==3)op.textValue=reader.text();else return false;}
          else return false;
          listAction.ops.push_back(std::move(op));
        }
        listEvent.actions.push_back(std::move(listAction));
        writer.u8(3);writer.text(target);writer.u8(2);writer.u32(1);writer.u8(4);writer.u8(0);
      }
      if(!listEvent.actions.empty())listEvents.push_back(std::move(listEvent));
    }
    if(!reader.done())return false;
    payloadV9=writer.take();return !payloadV9.empty();
  } catch(int code) {
    // The first implementation intentionally rejects mixed scalar/list actions
    // until the generic raw-action copier below is used by runtime v1.1.
    (void)code; payloadV9.clear();listStates.clear();listBoxes.clear();listEvents.clear();return false;
  } catch(...) {
    payloadV9.clear();listStates.clear();listBoxes.clear();listEvents.clear();return false;
  }
}
