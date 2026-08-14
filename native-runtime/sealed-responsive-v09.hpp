#pragma once
#include <cstdint>
#include <cstring>
#include <vector>

struct PatchLayoutPolicyV09 {
  uint8_t kind = 0;
  uint8_t value = 0;
};

class PatchPayloadV8Cursor {
public:
  PatchPayloadV8Cursor(const std::vector<uint8_t>& source, std::vector<uint8_t>& legacy)
      : source_(source), legacy_(legacy) {}

  uint8_t copyU8() {
    need(1);
    uint8_t value = source_[offset_++];
    legacy_.push_back(value);
    return value;
  }

  uint32_t copyU32() {
    need(4);
    uint32_t value = readU32(offset_);
    copyBytes(4);
    return value;
  }

  uint8_t takeU8() {
    need(1);
    return source_[offset_++];
  }

  void copyText() {
    uint32_t length = copyU32();
    copyBytes(length);
  }

  void copyTypedValue(uint8_t type) {
    if (type == 1) copyBytes(8);
    else if (type == 2) copyText();
    else if (type == 3) copyU8();
    else throw 1;
  }

  void copyRemaining() {
    if (offset_ < source_.size()) {
      legacy_.insert(legacy_.end(), source_.begin() + static_cast<std::ptrdiff_t>(offset_), source_.end());
      offset_ = source_.size();
    }
  }

  bool done() const { return offset_ == source_.size(); }

private:
  uint32_t readU32(size_t at) const {
    return static_cast<uint32_t>(source_[at]) |
      (static_cast<uint32_t>(source_[at + 1]) << 8) |
      (static_cast<uint32_t>(source_[at + 2]) << 16) |
      (static_cast<uint32_t>(source_[at + 3]) << 24);
  }

  void copyBytes(size_t count) {
    need(count);
    legacy_.insert(legacy_.end(), source_.begin() + static_cast<std::ptrdiff_t>(offset_), source_.begin() + static_cast<std::ptrdiff_t>(offset_ + count));
    offset_ += count;
  }

  void need(size_t count) const {
    if (offset_ > source_.size() || count > source_.size() - offset_) throw 1;
  }

  const std::vector<uint8_t>& source_;
  std::vector<uint8_t>& legacy_;
  size_t offset_ = 0;
};

static bool PatchValidLayoutPolicyV09(const PatchLayoutPolicyV09& policy) {
  if (policy.kind == 0) return policy.value == 0;
  if (policy.kind == 1) return policy.value >= 1 && policy.value <= 15;
  if (policy.kind == 2) return policy.value >= 1 && policy.value <= 5;
  return false;
}

static bool PatchConvertPayloadV8ToV7(
    const std::vector<uint8_t>& payloadV8,
    std::vector<uint8_t>& payloadV7,
    std::vector<PatchLayoutPolicyV09>& policies) {
  payloadV7.clear();
  policies.clear();
  try {
    PatchPayloadV8Cursor cursor(payloadV8, payloadV7);
    const uint32_t stateCount = cursor.copyU32();
    if (stateCount > 10000) return false;
    for (uint32_t i = 0; i < stateCount; ++i) {
      cursor.copyText();
      const uint8_t type = cursor.copyU8();
      cursor.copyTypedValue(type);
    }

    const uint32_t formCount = cursor.copyU32();
    if (!formCount || formCount > 1024) return false;
    for (uint32_t form = 0; form < formCount; ++form) {
      cursor.copyText();
      cursor.copyText();
      cursor.copyU32();
      cursor.copyU32();
      cursor.copyU8();
      const uint32_t controlCount = cursor.copyU32();
      if (controlCount > 10000) return false;
      for (uint32_t control = 0; control < controlCount; ++control) {
        cursor.copyU8();
        cursor.copyText();
        cursor.copyText();
        cursor.copyText();
        const uint32_t optionCount = cursor.copyU32();
        if (optionCount > 10000) return false;
        for (uint32_t option = 0; option < optionCount; ++option) cursor.copyText();
        cursor.copyU32();
        cursor.copyU32();
        cursor.copyU32();
        cursor.copyU32();
        PatchLayoutPolicyV09 policy{cursor.takeU8(), cursor.takeU8()};
        if (!PatchValidLayoutPolicyV09(policy)) return false;
        policies.push_back(policy);
        cursor.copyU32();
        cursor.copyU32();
      }

      const uint32_t menuCount = cursor.copyU32();
      if (menuCount > 1024) return false;
      for (uint32_t menu = 0; menu < menuCount; ++menu) {
        cursor.copyText();
        const uint32_t itemCount = cursor.copyU32();
        if (itemCount > 10000) return false;
        for (uint32_t item = 0; item < itemCount; ++item) {
          cursor.copyText();
          cursor.copyText();
        }
      }
    }

    cursor.copyRemaining();
    return cursor.done() && !payloadV7.empty();
  } catch (...) {
    payloadV7.clear();
    policies.clear();
    return false;
  }
}

static bool PatchPolicyResponsiveV09(const PatchLayoutPolicyV09& policy) {
  return policy.kind == 1 || policy.kind == 2;
}

static void PatchApplyLayoutPolicyV09(
    const PatchLayoutPolicyV09& policy,
    int baseFormWidth,
    int baseFormHeight,
    int formWidth,
    int formHeight,
    int& x,
    int& y,
    int& width,
    int& height) {
  if (!PatchPolicyResponsiveV09(policy)) return;
  const int dw = formWidth - baseFormWidth;
  const int dh = formHeight - baseFormHeight;
  if (policy.kind == 2) {
    if (policy.value == 5) { x = 0; y = 0; width = formWidth; height = formHeight; }
    else if (policy.value == 3) { x = 0; y = 0; width = formWidth; }
    else if (policy.value == 4) { x = 0; y = formHeight - height; width = formWidth; }
    else if (policy.value == 1) { x = 0; y = 0; height = formHeight; }
    else if (policy.value == 2) { x = formWidth - width; y = 0; height = formHeight; }
  } else {
    const bool left = (policy.value & 1) != 0;
    const bool right = (policy.value & 2) != 0;
    const bool top = (policy.value & 4) != 0;
    const bool bottom = (policy.value & 8) != 0;
    if (left && right) width += dw;
    else if (!left && right) x += dw;
    if (top && bottom) height += dh;
    else if (!top && bottom) y += dh;
  }
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (width < 16) width = 16;
  if (height < 16) height = 16;
}
