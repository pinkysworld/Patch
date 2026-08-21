#pragma once
#include <cstdint>
#include <cstring>
#include <cmath>
#include <string>
#include <vector>
#include <set>

struct PatchSliderEventPatchV14 {
  uint32_t eventIndex = 0;
  std::vector<double> sentinels;
};
struct PatchSliderV14 {
  int nativeIndex = -1;
  std::string id;
  double min = 0.0;
  double max = 0.0;
  double step = 1.0;
  std::string binding;
  std::vector<PatchSliderEventPatchV14> events;
};

class PatchSliderReaderV14 {
public:
  PatchSliderReaderV14(const uint8_t* data,size_t size):data_(data),size_(size){}
  uint32_t u32(){need(4);uint32_t v=(uint32_t)data_[off_]|((uint32_t)data_[off_+1]<<8)|((uint32_t)data_[off_+2]<<16)|((uint32_t)data_[off_+3]<<24);off_+=4;return v;}
  double f64(){need(8);double v=0.0;std::memcpy(&v,data_+off_,8);off_+=8;if(!std::isfinite(v))throw 1;return v;}
  std::string text(){uint32_t n=u32();need(n);std::string out(reinterpret_cast<const char*>(data_+off_),n);off_+=n;return out;}
  bool done()const{return off_==size_;}
private:
  void need(size_t n){if(n>size_-off_)throw 1;}
  const uint8_t* data_=nullptr;size_t size_=0,off_=0;
};

static bool PatchConvertPayloadV13ToV12(const std::vector<uint8_t>& input,std::vector<uint8_t>& payloadV12,std::vector<PatchSliderV14>& sliders){
  sliders.clear();payloadV12.clear();
  try{
    if(input.size()<8)return false;
    const size_t trailer=input.size()-8;
    if(std::memcmp(input.data()+trailer,"PSL1",4)!=0)return false;
    const uint8_t* p=input.data()+trailer+4;
    uint32_t extLen=(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);
    if((size_t)extLen>trailer)return false;
    const size_t extStart=trailer-(size_t)extLen;
    if(extStart==0)return false;
    payloadV12.assign(input.begin(),input.begin()+(std::ptrdiff_t)extStart);
    PatchSliderReaderV14 r(input.data()+extStart,(size_t)extLen);
    uint32_t count=r.u32();if(count>1024)return false;
    std::set<int> nativeIndices;std::set<std::string> ids;std::set<double> allSentinels;
    for(uint32_t index=0;index<count;++index){
      PatchSliderV14 slider;slider.nativeIndex=(int)r.u32();slider.id=r.text();slider.min=r.f64();slider.max=r.f64();slider.step=r.f64();slider.binding=r.text();
      if(slider.nativeIndex<0||slider.id.empty()||!ids.insert(slider.id).second||!nativeIndices.insert(slider.nativeIndex).second||!(slider.min<slider.max)||!(slider.step>0.0))return false;
      uint32_t eventCount=r.u32();if(eventCount>10000)return false;std::set<uint32_t> eventIndices;
      for(uint32_t e=0;e<eventCount;++e){PatchSliderEventPatchV14 patch;patch.eventIndex=r.u32();if(!eventIndices.insert(patch.eventIndex).second)return false;uint32_t sentinelCount=r.u32();if(sentinelCount>10000)return false;for(uint32_t s=0;s<sentinelCount;++s){double sentinel=r.f64();if(!allSentinels.insert(sentinel).second)return false;patch.sentinels.push_back(sentinel);}slider.events.push_back(std::move(patch));}
      sliders.push_back(std::move(slider));
    }
    return r.done();
  }catch(...){payloadV12.clear();sliders.clear();return false;}
}

static const PatchSliderV14* PatchSliderForNativeIndexV14(const std::vector<PatchSliderV14>& sliders,int nativeIndex){for(const auto& slider:sliders)if(slider.nativeIndex==nativeIndex)return &slider;return nullptr;}
static const PatchSliderV14* PatchSliderForIdV14(const std::vector<PatchSliderV14>& sliders,const std::string& id){for(const auto& slider:sliders)if(slider.id==id)return &slider;return nullptr;}
