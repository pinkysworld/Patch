#pragma once
#include "picture-data-v15.hpp"
#include <cctype>
#include <cstdint>
#include <cstring>
#include <set>
#include <string>
#include <vector>

struct PatchWindowIconAssetV110 {
  std::string resourceId;
  std::string mediaType;
  uint32_t size = 0;
  std::string sha256;
  std::string dataUri;
};

struct PatchWindowIconConsumerV110 {
  uint32_t formIndex = 0;
  std::string formId;
  uint32_t assetIndex = 0;
  bool application = false;
};

class PatchWindowIconReaderV110 {
public:
  PatchWindowIconReaderV110(const uint8_t* data, size_t size): data_(data), size_(size) {}
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

static bool PatchWindowIconNameV110(const std::string& value) {
  if (value.empty()) return true;
  unsigned char first = (unsigned char)value.front();
  if (!(std::isalpha(first) || value.front() == '_')) return false;
  for (size_t index = 1; index < value.size(); ++index) {
    unsigned char ch = (unsigned char)value[index];
    if (!(std::isalnum(ch) || value[index] == '_')) return false;
  }
  return true;
}

static bool PatchWindowIconResourceIdV110(const std::string& value) {
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

static bool PatchWindowIconSha256V110(const std::string& value) {
  if (value.size() != 64) return false;
  for (char ch : value) if (!((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'))) return false;
  return true;
}

static bool PatchConvertPayloadV19ToV18(
  const std::vector<uint8_t>& input,
  std::vector<uint8_t>& payloadV18,
  std::vector<PatchWindowIconAssetV110>& assets,
  std::vector<PatchWindowIconConsumerV110>& consumers
) {
  payloadV18.clear();
  assets.clear();
  consumers.clear();
  try {
    if (input.size() < 8) return false;
    const size_t trailer = input.size() - 8;
    if (std::memcmp(input.data() + trailer, "WICO", 4) != 0) return false;
    const uint8_t* lengthBytes = input.data() + trailer + 4;
    uint32_t extensionLength = (uint32_t)lengthBytes[0] |
      ((uint32_t)lengthBytes[1] << 8) |
      ((uint32_t)lengthBytes[2] << 16) |
      ((uint32_t)lengthBytes[3] << 24);
    if ((size_t)extensionLength > trailer || extensionLength > 8u * 1024u * 1024u) return false;
    const size_t extensionStart = trailer - (size_t)extensionLength;
    if (extensionStart == 0) return false;
    payloadV18.assign(input.begin(), input.begin() + (std::ptrdiff_t)extensionStart);

    PatchWindowIconReaderV110 reader(input.data() + extensionStart, extensionLength);
    uint32_t assetCount = reader.u32();
    if (assetCount > 256) return false;
    std::set<std::string> resourceIds;
    for (uint32_t index = 0; index < assetCount; ++index) {
      PatchWindowIconAssetV110 asset;
      asset.resourceId = reader.text();
      asset.mediaType = reader.text();
      asset.size = reader.u32();
      asset.sha256 = reader.text();
      asset.dataUri = reader.text();
      if (!PatchWindowIconResourceIdV110(asset.resourceId) || !resourceIds.insert(asset.resourceId).second) return false;
      if (asset.mediaType != "image/png" && asset.mediaType != "image/jpeg") return false;
      if (!PatchWindowIconSha256V110(asset.sha256)) return false;
      PatchPictureDataV15 decoded;
      if (!PatchDecodePictureDataUriV15(asset.dataUri, decoded) || decoded.mediaType != asset.mediaType || decoded.bytes.size() != asset.size) return false;
      assets.push_back(std::move(asset));
    }

    uint32_t consumerCount = reader.u32();
    if (consumerCount > 1024) return false;
    std::set<uint32_t> formIndices;
    uint32_t previousFormIndex = 0;
    bool hasPrevious = false;
    uint32_t applicationCount = 0;
    for (uint32_t index = 0; index < consumerCount; ++index) {
      PatchWindowIconConsumerV110 consumer;
      consumer.formIndex = reader.u32();
      consumer.formId = reader.text();
      consumer.assetIndex = reader.u32();
      uint32_t application = reader.u32();
      if (!PatchWindowIconNameV110(consumer.formId) || consumer.assetIndex >= assets.size() || application > 1) return false;
      if (!formIndices.insert(consumer.formIndex).second) return false;
      if (hasPrevious && consumer.formIndex <= previousFormIndex) return false;
      consumer.application = application == 1;
      if ((index == 0) != consumer.application) return false;
      if (consumer.application) ++applicationCount;
      previousFormIndex = consumer.formIndex;
      hasPrevious = true;
      consumers.push_back(std::move(consumer));
    }
    if (consumerCount && applicationCount != 1) return false;
    if (!reader.done()) return false;
    return !payloadV18.empty();
  } catch (...) {
    payloadV18.clear();
    assets.clear();
    consumers.clear();
    return false;
  }
}

static const PatchWindowIconConsumerV110* PatchWindowIconForFormV110(
  const std::vector<PatchWindowIconConsumerV110>& consumers,
  uint32_t formIndex
) {
  for (const auto& consumer : consumers) if (consumer.formIndex == formIndex) return &consumer;
  return nullptr;
}

static const PatchWindowIconConsumerV110* PatchApplicationIconV110(
  const std::vector<PatchWindowIconConsumerV110>& consumers
) {
  for (const auto& consumer : consumers) if (consumer.application) return &consumer;
  return nullptr;
}
