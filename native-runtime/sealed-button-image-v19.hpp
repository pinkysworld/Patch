#pragma once
#include "picture-data-v15.hpp"
#include <cctype>
#include <cstdint>
#include <cstring>
#include <set>
#include <string>
#include <vector>

// Runtime v1.10 compiles the proven v1.9 Button-image runtime as its private
// compatibility layer. Normal v1.9 builds do not define these hooks and keep
// their public entry points unchanged.
#ifdef PATCH_WIN32_RUNTIME_V110_RESTORE_ENTRY
#define wWinMain PATCH_WIN32_RUNTIME_V110_RESTORE_ENTRY
#endif
#ifdef PATCH_RUNTIME_V110_RESTORE_MAIN
#define main PATCH_RUNTIME_V110_RESTORE_MAIN
#endif

struct PatchButtonImageAssetV19 {
  std::string resourceId;
  std::string mediaType;
  uint32_t size = 0;
  std::string sha256;
  std::string dataUri;
};

struct PatchButtonImageConsumerV19 {
  int nativeIndex = -1;
  std::string controlId;
  std::string imageListId;
  std::string imageItem;
  uint32_t assetIndex = 0;
  uint32_t logicalWidth = 0;
  uint32_t logicalHeight = 0;
};

class PatchButtonImageReaderV19 {
public:
  PatchButtonImageReaderV19(const uint8_t* data, size_t size): data_(data), size_(size) {}
  uint32_t u32() {
    need(4);
    uint32_t value = (uint32_t)data_[offset_] |
      ((uint32_t)data_[offset_ + 1] << 8) |
      ((uint32_t)data_[offset_ + 2] << 16) |
      ((uint32_t)data_[offset_ + 3] << 24);
    offset_ += 4;
    return value;
  }
  std::string text() {
    uint32_t length = u32();
    need(length);
    std::string value(reinterpret_cast<const char*>(data_ + offset_), length);
    offset_ += length;
    return value;
  }
  bool done() const { return offset_ == size_; }
private:
  void need(size_t count) { if (count > size_ - offset_) throw 1; }
  const uint8_t* data_ = nullptr;
  size_t size_ = 0;
  size_t offset_ = 0;
};

static bool PatchButtonNameV19(const std::string& value) {
  if (value.empty()) return false;
  unsigned char first = (unsigned char)value.front();
  if (!(std::isalpha(first) || value.front() == '_')) return false;
  for (size_t index = 1; index < value.size(); ++index) {
    unsigned char ch = (unsigned char)value[index];
    if (!(std::isalnum(ch) || value[index] == '_')) return false;
  }
  return true;
}

static bool PatchButtonResourceIdV19(const std::string& value) {
  if (value.empty() || !std::isalpha((unsigned char)value.front())) return false;
  bool afterSeparator = false;
  for (size_t index = 1; index < value.size(); ++index) {
    unsigned char ch = (unsigned char)value[index];
    if (std::isalnum(ch)) { afterSeparator = false; continue; }
    if ((value[index] == '.' || value[index] == '_' || value[index] == '-') && !afterSeparator && index + 1 < value.size()) {
      afterSeparator = true;
      continue;
    }
    return false;
  }
  return !afterSeparator;
}

static bool PatchButtonSha256V19(const std::string& value) {
  if (value.size() != 64) return false;
  for (char ch : value) if (!((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'))) return false;
  return true;
}

static bool PatchConvertPayloadV18ToV17(
  const std::vector<uint8_t>& input,
  std::vector<uint8_t>& payloadV17,
  std::vector<PatchButtonImageAssetV19>& assets,
  std::vector<PatchButtonImageConsumerV19>& consumers
) {
  payloadV17.clear();
  assets.clear();
  consumers.clear();
  try {
    if (input.size() < 8) return false;
    const size_t trailer = input.size() - 8;
    if (std::memcmp(input.data() + trailer, "BIMG", 4) != 0) return false;
    const uint8_t* lengthBytes = input.data() + trailer + 4;
    uint32_t extensionLength = (uint32_t)lengthBytes[0] |
      ((uint32_t)lengthBytes[1] << 8) |
      ((uint32_t)lengthBytes[2] << 16) |
      ((uint32_t)lengthBytes[3] << 24);
    if ((size_t)extensionLength > trailer || extensionLength > 8u * 1024u * 1024u) return false;
    const size_t extensionStart = trailer - (size_t)extensionLength;
    if (extensionStart == 0) return false;
    payloadV17.assign(input.begin(), input.begin() + (std::ptrdiff_t)extensionStart);

    PatchButtonImageReaderV19 reader(input.data() + extensionStart, extensionLength);
    uint32_t assetCount = reader.u32();
    if (assetCount > 1024) return false;
    std::set<std::string> resourceIds;
    for (uint32_t index = 0; index < assetCount; ++index) {
      PatchButtonImageAssetV19 asset;
      asset.resourceId = reader.text();
      asset.mediaType = reader.text();
      asset.size = reader.u32();
      asset.sha256 = reader.text();
      asset.dataUri = reader.text();
      if (!PatchButtonResourceIdV19(asset.resourceId) || !resourceIds.insert(asset.resourceId).second) return false;
      if (asset.mediaType != "image/png" && asset.mediaType != "image/jpeg") return false;
      if (!PatchButtonSha256V19(asset.sha256)) return false;
      PatchPictureDataV15 decoded;
      if (!PatchDecodePictureDataUriV15(asset.dataUri, decoded) || decoded.mediaType != asset.mediaType || decoded.bytes.size() != asset.size) return false;
      assets.push_back(std::move(asset));
    }

    uint32_t consumerCount = reader.u32();
    if (consumerCount > 4096) return false;
    std::set<int> nativeIndices;
    std::set<std::string> controlIds;
    for (uint32_t index = 0; index < consumerCount; ++index) {
      PatchButtonImageConsumerV19 consumer;
      consumer.nativeIndex = (int)reader.u32();
      consumer.controlId = reader.text();
      consumer.imageListId = reader.text();
      consumer.imageItem = reader.text();
      consumer.assetIndex = reader.u32();
      consumer.logicalWidth = reader.u32();
      consumer.logicalHeight = reader.u32();
      if (consumer.nativeIndex < 0 || !PatchButtonNameV19(consumer.controlId) || !PatchButtonNameV19(consumer.imageListId) || !PatchButtonNameV19(consumer.imageItem)) return false;
      if (!nativeIndices.insert(consumer.nativeIndex).second || !controlIds.insert(consumer.controlId).second) return false;
      if (consumer.assetIndex >= assets.size()) return false;
      if (!consumer.logicalWidth || !consumer.logicalHeight || consumer.logicalWidth > 512 || consumer.logicalHeight > 512) return false;
      consumers.push_back(std::move(consumer));
    }
    if (!reader.done()) return false;
    return !payloadV17.empty();
  } catch (...) {
    payloadV17.clear();
    assets.clear();
    consumers.clear();
    return false;
  }
}

static const PatchButtonImageConsumerV19* PatchButtonImageForNativeIndexV19(
  const std::vector<PatchButtonImageConsumerV19>& consumers,
  int nativeIndex
) {
  for (const auto& consumer : consumers) if (consumer.nativeIndex == nativeIndex) return &consumer;
  return nullptr;
}
