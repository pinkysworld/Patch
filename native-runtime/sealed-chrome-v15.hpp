#pragma once
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>
#include <set>

struct PatchChromeEventPatchV15 {
  uint32_t eventIndex = 0;
  std::string event;
};

struct PatchChromeV15 {
  int nativeIndex = -1;
  std::string id;
  uint32_t kind = 0;
  uint32_t interval = 0;
  std::string text;
  std::string source;
  std::string binding;
  uint32_t childCount = 0;
  std::vector<PatchChromeEventPatchV15> events;
};

enum PatchChromeKindV15 : uint32_t {
  PATCH_CHROME_PANEL_V15 = 0,
  PATCH_CHROME_TIMER_V15 = 1,
  PATCH_CHROME_PICTURE_V15 = 2,
  PATCH_CHROME_STATUS_V15 = 3
};

class PatchChromeReaderV15 {
public:
  PatchChromeReaderV15(const uint8_t* data, size_t size): data_(data), size_(size) {}
  uint32_t u32() {
    need(4);
    uint32_t v = (uint32_t)data_[off_] | ((uint32_t)data_[off_ + 1] << 8) | ((uint32_t)data_[off_ + 2] << 16) | ((uint32_t)data_[off_ + 3] << 24);
    off_ += 4;
    return v;
  }
  std::string text() {
    uint32_t n = u32();
    need(n);
    std::string out(reinterpret_cast<const char*>(data_ + off_), n);
    off_ += n;
    return out;
  }
  bool done() const { return off_ == size_; }
private:
  void need(size_t n) { if (n > size_ - off_) throw 1; }
  const uint8_t* data_ = nullptr;
  size_t size_ = 0, off_ = 0;
};

static bool PatchConvertPayloadV14ToV13(const std::vector<uint8_t>& input, std::vector<uint8_t>& payloadV13, std::vector<PatchChromeV15>& chrome) {
  chrome.clear();
  payloadV13.clear();
  try {
    if (input.size() < 8) return false;
    const size_t trailer = input.size() - 8;
    if (std::memcmp(input.data() + trailer, "PCHC", 4) != 0) return false;
    const uint8_t* p = input.data() + trailer + 4;
    uint32_t extLen = (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
    if ((size_t)extLen > trailer) return false;
    const size_t extStart = trailer - (size_t)extLen;
    if (extStart == 0) return false;
    payloadV13.assign(input.begin(), input.begin() + (std::ptrdiff_t)extStart);
    PatchChromeReaderV15 r(input.data() + extStart, (size_t)extLen);
    uint32_t count = r.u32();
    if (count > 1024) return false;
    std::set<int> nativeIndices;
    std::set<std::string> ids;
    for (uint32_t index = 0; index < count; ++index) {
      PatchChromeV15 item;
      item.nativeIndex = (int)r.u32();
      item.id = r.text();
      item.kind = r.u32();
      item.interval = r.u32();
      item.text = r.text();
      item.source = r.text();
      item.binding = r.text();
      item.childCount = r.u32();
      if (item.nativeIndex < 0 || item.id.empty() || !ids.insert(item.id).second || !nativeIndices.insert(item.nativeIndex).second || item.kind > 3) return false;
      if (item.kind == PATCH_CHROME_TIMER_V15) {
        if (item.interval < 1 || item.interval > 3600000) return false;
      } else if (item.interval != 0) return false;
      if (item.kind == PATCH_CHROME_PANEL_V15) {
        if (item.childCount > 1024) return false;
      } else if (item.childCount != 0) return false;
      uint32_t eventCount = r.u32();
      if (eventCount > 10000) return false;
      std::set<uint32_t> eventIndices;
      for (uint32_t e = 0; e < eventCount; ++e) {
        PatchChromeEventPatchV15 patch;
        patch.eventIndex = r.u32();
        patch.event = r.text();
        if (!eventIndices.insert(patch.eventIndex).second || patch.event.empty()) return false;
        item.events.push_back(std::move(patch));
      }
      chrome.push_back(std::move(item));
    }
    return r.done();
  } catch (...) {
    payloadV13.clear();
    chrome.clear();
    return false;
  }
}

static const PatchChromeV15* PatchChromeForNativeIndexV15(const std::vector<PatchChromeV15>& chrome, int nativeIndex) {
  for (const auto& item : chrome) if (item.nativeIndex == nativeIndex) return &item;
  return nullptr;
}

static const PatchChromeV15* PatchChromeForIdV15(const std::vector<PatchChromeV15>& chrome, const std::string& id) {
  for (const auto& item : chrome) if (item.id == id) return &item;
  return nullptr;
}

// Runtime v1.6 compiles v1.5 as a private compatibility layer before restoring
// Shape controls. These aliases are opt-in and leave ordinary v1.5 builds unchanged.
#ifdef PATCH_WIN32_RUNTIME_V16_RESTORE_ENTRY
#define wWinMain PATCH_WIN32_RUNTIME_V16_RESTORE_ENTRY
#endif
#ifdef PATCH_RUNTIME_V16_RESTORE_MAIN
#define main PATCH_RUNTIME_V16_RESTORE_MAIN
#endif
