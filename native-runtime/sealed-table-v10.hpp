#pragma once
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>

struct PatchTableV10 {
  int nativeIndex = -1;
  std::string id;
  std::string shadowState;
  std::vector<std::string> columns;
  std::vector<std::vector<std::string>> rows;
};

static bool PatchValidUtf8V10(const std::string& value) {
  const auto* data=reinterpret_cast<const uint8_t*>(value.data());
  size_t i=0;
  while(i<value.size()){
    const uint8_t first=data[i++];
    if(first<=0x7f)continue;
    int remaining=0;uint32_t code=0,minimum=0;
    if((first&0xe0)==0xc0){remaining=1;code=first&0x1f;minimum=0x80;}
    else if((first&0xf0)==0xe0){remaining=2;code=first&0x0f;minimum=0x800;}
    else if((first&0xf8)==0xf0){remaining=3;code=first&0x07;minimum=0x10000;}
    else return false;
    if(i+(size_t)remaining>value.size())return false;
    for(int n=0;n<remaining;++n){const uint8_t next=data[i++];if((next&0xc0)!=0x80)return false;code=(code<<6)|(next&0x3f);}
    if(code<minimum||code>0x10ffff||(code>=0xd800&&code<=0xdfff))return false;
  }
  return true;
}

class PatchPayloadV10Reader {
public:
  explicit PatchPayloadV10Reader(const std::vector<uint8_t>& source):source_(source){}
  size_t offset()const{return offset_;}
  bool done()const{return offset_==source_.size();}
  uint8_t u8(){need(1);return source_[offset_++];}
  uint32_t u32(){need(4);uint32_t value=(uint32_t)source_[offset_]|((uint32_t)source_[offset_+1]<<8)|((uint32_t)source_[offset_+2]<<16)|((uint32_t)source_[offset_+3]<<24);offset_+=4;return value;}
  int32_t i32(){return(int32_t)u32();}
  std::string text(){const uint32_t length=u32();need(length);std::string value(reinterpret_cast<const char*>(source_.data()+offset_),length);offset_+=length;if(!PatchValidUtf8V10(value))throw 1;return value;}
  void skip(size_t count){need(count);offset_+=count;}
  void skipText(){(void)text();}
  void skipTypedValue(uint8_t type){if(type==1)skip(8);else if(type==2)skipText();else if(type==3)skip(1);else throw 1;}
private:
  void need(size_t count)const{if(offset_>source_.size()||count>source_.size()-offset_)throw 1;}
  const std::vector<uint8_t>& source_;size_t offset_=0;
};

class PatchPayloadV10Writer {
public:
  void u8(uint8_t value){bytes_.push_back(value);}
  void u32(uint32_t value){bytes_.push_back((uint8_t)(value&0xff));bytes_.push_back((uint8_t)((value>>8)&0xff));bytes_.push_back((uint8_t)((value>>16)&0xff));bytes_.push_back((uint8_t)((value>>24)&0xff));}
  void i32(int32_t value){u32((uint32_t)value);}
  void text(const std::string& value){if(value.size()>0xffffffffu||!PatchValidUtf8V10(value))throw 1;u32((uint32_t)value.size());bytes_.insert(bytes_.end(),value.begin(),value.end());}
  void raw(const std::vector<uint8_t>& source,size_t start,size_t end){if(start>end||end>source.size())throw 1;bytes_.insert(bytes_.end(),source.begin()+(std::ptrdiff_t)start,source.begin()+(std::ptrdiff_t)end);}
  std::vector<uint8_t> take(){return std::move(bytes_);}
private:std::vector<uint8_t> bytes_;
};

static void PatchSkipActionV10(PatchPayloadV10Reader& reader){
  const uint8_t kind=reader.u8();
  if(kind==1||kind==2){reader.skipText();return;}
  if(kind==4){reader.skipText();reader.skipText();reader.skipText();return;}
  if(kind==5){reader.skipText();reader.skipText();reader.skipText();reader.skipText();return;}
  if(kind==6||kind==7){reader.skipText();reader.skipText();reader.skipText();return;}
  if(kind!=3)throw 1;
  reader.skipText();const uint8_t stateType=reader.u8();if(stateType<1||stateType>3)throw 1;const uint32_t opCount=reader.u32();if(opCount>10000)throw 1;
  for(uint32_t op=0;op<opCount;++op){const uint8_t opKind=reader.u8(),valueKind=reader.u8();if(opKind<1||opKind>4||valueKind>2)throw 1;if(opKind==4){if(valueKind!=0)throw 1;}else if(valueKind==1)reader.skipTypedValue(stateType);else if(valueKind!=2)throw 1;}
}

static bool PatchScanPayloadV9(const std::vector<uint8_t>& payloadV9,std::vector<PatchTableV10>& tables){
  tables.clear();
  try{
    PatchPayloadV10Reader reader(payloadV9);std::unordered_set<std::string> stateNames,tableIds;
    const uint32_t stateCount=reader.u32();if(stateCount>10000)return false;
    for(uint32_t state=0;state<stateCount;++state){const std::string name=reader.text();const uint8_t type=reader.u8();if(name.empty()||type<1||type>3||!stateNames.insert(name).second)return false;reader.skipTypedValue(type);}
    const uint32_t formCount=reader.u32();if(!formCount||formCount>1024)return false;int nativeIndex=0;
    for(uint32_t form=0;form<formCount;++form){if(reader.text().empty())return false;reader.skipText();const uint32_t width=reader.u32(),height=reader.u32();if(!width||!height||width>10000||height>10000)return false;if(reader.u8()>1)return false;const uint32_t controlCount=reader.u32();if(controlCount>10000)return false;
      for(uint32_t control=0;control<controlCount;++control,++nativeIndex){
        const uint8_t kind=reader.u8();const std::string id=reader.text();reader.skipText();const std::string binding=reader.text();if(kind<1||kind>9)return false;
        const uint32_t optionCount=reader.u32();if(optionCount>10000)return false;for(uint32_t option=0;option<optionCount;++option)reader.skipText();
        reader.i32();reader.i32();const int32_t controlWidth=reader.i32(),controlHeight=reader.i32();if(controlWidth<=0||controlHeight<=0||controlWidth>10000||controlHeight>10000)return false;
        const uint8_t policyKind=reader.u8(),policyValue=reader.u8();if(policyKind==0){if(policyValue!=0)return false;}else if(policyKind==1){if(policyValue<1||policyValue>15)return false;}else if(policyKind==2){if(policyValue<1||policyValue>5)return false;}else return false;reader.i32();reader.i32();
        const uint32_t columnCount=reader.u32();if(columnCount>256)return false;std::vector<std::string> columns;columns.reserve(columnCount);for(uint32_t column=0;column<columnCount;++column)columns.push_back(reader.text());
        const uint32_t rowCount=reader.u32();if(rowCount>10000)return false;std::vector<std::vector<std::string>> rows;if(kind==9)rows.reserve(rowCount);
        for(uint32_t row=0;row<rowCount;++row){std::vector<std::string> cells;if(kind==9)cells.reserve(columnCount);for(uint32_t column=0;column<columnCount;++column){std::string cell=reader.text();if(kind==9)cells.push_back(std::move(cell));}if(kind==9)rows.push_back(std::move(cells));}
        if(kind==9){if(id.empty()||!binding.empty()||optionCount!=0||columnCount==0||rowCount==0||!tableIds.insert(id).second)return false;PatchTableV10 table;table.nativeIndex=nativeIndex;table.id=id;std::string shadow="__patch_table_shadow_"+std::to_string(nativeIndex);while(stateNames.count(shadow))shadow.push_back('_');stateNames.insert(shadow);table.shadowState=std::move(shadow);table.columns=std::move(columns);table.rows=std::move(rows);tables.push_back(std::move(table));}
        else if(columnCount!=0||rowCount!=0)return false;
      }
      const uint32_t menuCount=reader.u32();if(menuCount>1024)return false;for(uint32_t menu=0;menu<menuCount;++menu){reader.skipText();const uint32_t itemCount=reader.u32();if(itemCount>10000)return false;for(uint32_t item=0;item<itemCount;++item){reader.skipText();reader.skipText();}}
    }
    const uint32_t eventCount=reader.u32();if(eventCount>10000)return false;for(uint32_t event=0;event<eventCount;++event){reader.skipText();const uint8_t eventKind=reader.u8(),valueType=reader.u8();if(eventKind<1||eventKind>5||valueType>3)return false;const uint32_t actionCount=reader.u32();if(actionCount>10000)return false;for(uint32_t action=0;action<actionCount;++action)PatchSkipActionV10(reader);}
    return reader.done();
  }catch(...){tables.clear();return false;}
}

static bool PatchConvertPayloadV9ToV8(const std::vector<uint8_t>& payloadV9,std::vector<uint8_t>& payloadV8,std::vector<PatchTableV10>& tables){
  payloadV8.clear();if(!PatchScanPayloadV9(payloadV9,tables))return false;
  try{
    PatchPayloadV10Reader reader(payloadV9);PatchPayloadV10Writer writer;const uint32_t stateCount=reader.u32();if(tables.size()>10000||stateCount>10000-tables.size())return false;writer.u32(stateCount+(uint32_t)tables.size());
    for(uint32_t state=0;state<stateCount;++state){const size_t start=reader.offset();reader.skipText();const uint8_t type=reader.u8();reader.skipTypedValue(type);writer.raw(payloadV9,start,reader.offset());}
    for(const auto& table:tables){writer.text(table.shadowState);writer.u8(2);writer.text("");}
    const uint32_t formCount=reader.u32();writer.u32(formCount);int nativeIndex=0;
    for(uint32_t form=0;form<formCount;++form){writer.text(reader.text());writer.text(reader.text());writer.u32(reader.u32());writer.u32(reader.u32());writer.u8(reader.u8());const uint32_t controlCount=reader.u32();writer.u32(controlCount);
      for(uint32_t control=0;control<controlCount;++control,++nativeIndex){const uint8_t kind=reader.u8();const std::string id=reader.text(),text=reader.text(),binding=reader.text();const uint32_t optionCount=reader.u32();std::vector<std::string> options;options.reserve(optionCount);for(uint32_t option=0;option<optionCount;++option)options.push_back(reader.text());const int32_t x=reader.i32(),y=reader.i32(),width=reader.i32(),height=reader.i32();const uint8_t policyKind=reader.u8(),policyValue=reader.u8();const int32_t parentTabIndex=reader.i32(),pageIndex=reader.i32();const uint32_t columnCount=reader.u32();for(uint32_t column=0;column<columnCount;++column)reader.skipText();const uint32_t rowCount=reader.u32();for(uint32_t row=0;row<rowCount;++row)for(uint32_t column=0;column<columnCount;++column)reader.skipText();const PatchTableV10* table=nullptr;if(kind==9){for(const auto& candidate:tables)if(candidate.nativeIndex==nativeIndex){table=&candidate;break;}if(!table)return false;}writer.u8(table?6:kind);writer.text(id);writer.text(text);writer.text(table?table->shadowState:binding);if(table){writer.u32(2);writer.text("__patch_table_row_1");writer.text("__patch_table_row_2");}else{writer.u32(optionCount);for(const auto& option:options)writer.text(option);}writer.i32(x);writer.i32(y);writer.i32(width);writer.i32(height);writer.u8(policyKind);writer.u8(policyValue);writer.i32(parentTabIndex);writer.i32(pageIndex);}
      const uint32_t menuCount=reader.u32();writer.u32(menuCount);for(uint32_t menu=0;menu<menuCount;++menu){writer.text(reader.text());const uint32_t itemCount=reader.u32();writer.u32(itemCount);for(uint32_t item=0;item<itemCount;++item){writer.text(reader.text());writer.text(reader.text());}}
    }
    const uint32_t eventCount=reader.u32();writer.u32(eventCount);
    for(uint32_t event=0;event<eventCount;++event){const std::string control=reader.text();const uint8_t eventKind=reader.u8(),valueType=reader.u8();const uint32_t actionCount=reader.u32();writer.text(control);writer.u8(eventKind);bool tableEvent=false;for(const auto& table:tables)if(table.id==control){tableEvent=true;break;}if(tableEvent){if(eventKind!=2||valueType!=3)return false;writer.u8(2);}else{if(valueType>2)return false;writer.u8(valueType);}writer.u32(actionCount);for(uint32_t action=0;action<actionCount;++action){const size_t start=reader.offset();PatchSkipActionV10(reader);writer.raw(payloadV9,start,reader.offset());}}
    if(!reader.done())return false;payloadV8=writer.take();return !payloadV8.empty();
  }catch(...){payloadV8.clear();tables.clear();return false;}
}

static const PatchTableV10* PatchFindTableV10(const std::vector<PatchTableV10>& tables,int nativeIndex){for(const auto& table:tables)if(table.nativeIndex==nativeIndex)return &table;return nullptr;}
