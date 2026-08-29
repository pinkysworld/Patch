#pragma once
#include "picture-data-v15.hpp"
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>
#include <set>

struct PatchImageListItemV19 {
  std::string name;
  std::string resourceId;
  std::string source;
};

struct PatchImageListV19 {
  std::string id;
  uint32_t width = 16;
  uint32_t height = 16;
  std::vector<PatchImageListItemV19> items;
};

struct PatchButtonImageV19 {
  int nativeIndex = -1;
  std::string id;
  std::string imageListId;
  std::string imageItem;
  std::string source;
  uint32_t width = 16;
  uint32_t height = 16;
};

class PatchImageListReaderV19 {
public:
  PatchImageListReaderV19(const uint8_t* data, size_t size): data_(data), size_(size) {}
  uint32_t u32() {
    need(4);
    uint32_t v = (uint32_t)data_[off_] | ((uint32_t)data_[off_ + 1] << 8) | ((uint32_t)data_[off_ + 2] << 16) | ((uint32_t)data_[off_ + 3] << 24);
    off_ += 4;
    return v;
  }
  std::string text() {
    uint32_t n = u32();
    need((size_t)n);
    std::string out(reinterpret_cast<const char*>(data_ + off_), (size_t)n);
    off_ += (size_t)n;
    return out;
  }
  bool done() const { return off_ == size_; }
private:
  const uint8_t* data_;
  size_t size_;
  size_t off_ = 0;
  void need(size_t n) {
    if (off_ > size_ || n > size_ - off_) throw 1;
  }
};

static const PatchImageListV19* PatchFindImageListV19(const std::vector<PatchImageListV19>& lists, const std::string& id) {
  for (const auto& list : lists) if (list.id == id) return &list;
  return nullptr;
}

static const PatchImageListItemV19* PatchFindImageListItemV19(const PatchImageListV19& list, const std::string& name) {
  for (const auto& item : list.items) if (item.name == name) return &item;
  return nullptr;
}

static bool PatchConvertPayloadV18ToV17(const std::vector<uint8_t>& input, std::vector<uint8_t>& payloadV17, std::vector<PatchImageListV19>& lists, std::vector<PatchButtonImageV19>& buttons) {
  payloadV17.clear();
  lists.clear();
  buttons.clear();
  if (input.size() < 8) return false;
  try {
    const size_t trailer = input.size() - 8;
    if (std::memcmp(input.data() + trailer, "PILT", 4) != 0) return false;
    const uint8_t* p = input.data() + trailer + 4;
    uint32_t extLen = (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
    if ((size_t)extLen > trailer) return false;
    const size_t extStart = trailer - (size_t)extLen;
    if (extStart == 0) return false;
    payloadV17.assign(input.begin(), input.begin() + (std::ptrdiff_t)extStart);
    PatchImageListReaderV19 r(input.data() + extStart, (size_t)extLen);
    uint32_t listCount = r.u32();
    if (listCount > 256) return false;
    std::set<std::string> ids;
    for (uint32_t index = 0; index < listCount; ++index) {
      PatchImageListV19 list;
      list.id = r.text();
      list.width = r.u32();
      list.height = r.u32();
      uint32_t itemCount = r.u32();
      if (list.id.empty() || !ids.insert(list.id).second || itemCount > 256 || list.width < 1 || list.width > 512 || list.height < 1 || list.height > 512) return false;
      std::set<std::string> names;
      for (uint32_t itemIndex = 0; itemIndex < itemCount; ++itemIndex) {
        PatchImageListItemV19 item;
        item.name = r.text();
        item.resourceId = r.text();
        item.source = r.text();
        if (item.name.empty() || !names.insert(item.name).second || item.resourceId.empty() || item.source.empty()) return false;
        list.items.push_back(std::move(item));
      }
      lists.push_back(std::move(list));
    }
    uint32_t buttonCount = r.u32();
    if (buttonCount > 1024) return false;
    std::set<int> nativeIndices;
    std::set<std::string> buttonIds;
    for (uint32_t index = 0; index < buttonCount; ++index) {
      PatchButtonImageV19 button;
      const uint32_t nativeIndex = r.u32();
      if (nativeIndex > 0x7fffffffu) return false;
      button.nativeIndex = (int)nativeIndex;
      button.id = r.text();
      button.imageListId = r.text();
      button.imageItem = r.text();
      button.source = r.text();
      button.width = r.u32();
      button.height = r.u32();
      if (button.id.empty() || !buttonIds.insert(button.id).second || !nativeIndices.insert(button.nativeIndex).second) return false;
      if (button.imageListId.empty() || button.imageItem.empty() || button.source.empty()) return false;
      const PatchImageListV19* list = PatchFindImageListV19(lists, button.imageListId);
      if (!list) return false;
      const PatchImageListItemV19* item = PatchFindImageListItemV19(*list, button.imageItem);
      if (!item || item->source != button.source) return false;
      if (button.width != list->width || button.height != list->height) return false;
      buttons.push_back(std::move(button));
    }
    return r.done();
  } catch (...) {
    payloadV17.clear();
    lists.clear();
    buttons.clear();
    return false;
  }
}
