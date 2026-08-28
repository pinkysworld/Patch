#pragma once
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <string>
#include <vector>
#include <set>
#include <cmath>

struct PatchShapeV16 {
  int nativeIndex = -1;
  std::string id;
  uint32_t kind = 0;
  std::string fill;
  std::string stroke;
  std::string strokeWidth;
  std::string cornerRadius;
  std::string opacity;
};

enum PatchShapeKindV16 : uint32_t {
  PATCH_SHAPE_RECTANGLE_V16 = 0,
  PATCH_SHAPE_ROUNDED_V16 = 1,
  PATCH_SHAPE_ELLIPSE_V16 = 2,
  PATCH_SHAPE_LINE_V16 = 3
};

struct PatchColorV16 {
  uint8_t r = 0, g = 0, b = 0, a = 255;
  bool transparent = false;
  bool valid = false;
};

class PatchShapeReaderV16 {
public:
  PatchShapeReaderV16(const uint8_t* data, size_t size): data_(data), size_(size) {}
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

static bool PatchConvertPayloadV15ToV14(const std::vector<uint8_t>& input, std::vector<uint8_t>& payloadV14, std::vector<PatchShapeV16>& shapes) {
  shapes.clear();
  payloadV14.clear();
  try {
    if (input.size() < 8) return false;
    const size_t trailer = input.size() - 8;
    if (std::memcmp(input.data() + trailer, "PSHP", 4) != 0) return false;
    const uint8_t* p = input.data() + trailer + 4;
    uint32_t extLen = (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
    if ((size_t)extLen > trailer) return false;
    const size_t extStart = trailer - (size_t)extLen;
    if (extStart == 0) return false;
    payloadV14.assign(input.begin(), input.begin() + (std::ptrdiff_t)extStart);
    PatchShapeReaderV16 r(input.data() + extStart, (size_t)extLen);
    uint32_t count = r.u32();
    if (count > 1024) return false;
    std::set<int> nativeIndices;
    std::set<std::string> ids;
    for (uint32_t index = 0; index < count; ++index) {
      PatchShapeV16 item;
      item.nativeIndex = (int)r.u32();
      item.id = r.text();
      item.kind = r.u32();
      item.fill = r.text();
      item.stroke = r.text();
      item.strokeWidth = r.text();
      item.cornerRadius = r.text();
      item.opacity = r.text();
      if (item.nativeIndex < 0 || item.id.empty() || !ids.insert(item.id).second || !nativeIndices.insert(item.nativeIndex).second || item.kind > 3) return false;
      shapes.push_back(std::move(item));
    }
    return r.done();
  } catch (...) {
    payloadV14.clear();
    shapes.clear();
    return false;
  }
}

static bool PatchParseFiniteV16(const std::string& text, double min, double max, double& out) {
  if (text.empty()) return false;
  char* end = nullptr;
  out = std::strtod(text.c_str(), &end);
  if (!end || *end != 0 || !std::isfinite(out) || out < min || out > max) return false;
  return true;
}

static int PatchHexNibbleV16(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return 10 + (c - 'a');
  if (c >= 'A' && c <= 'F') return 10 + (c - 'A');
  return -1;
}

static bool PatchParseHexByteV16(const char* p, uint8_t& out) {
  int hi = PatchHexNibbleV16(p[0]), lo = PatchHexNibbleV16(p[1]);
  if (hi < 0 || lo < 0) return false;
  out = (uint8_t)((hi << 4) | lo);
  return true;
}

static bool PatchParseColorV16(const std::string& text, bool allowTransparent, PatchColorV16& out) {
  out = {};
  if (allowTransparent && text == "transparent") {
    out.transparent = true;
    out.valid = true;
    out.a = 0;
    return true;
  }
  if (text.size() != 7 && text.size() != 9) return false;
  if (text[0] != '#') return false;
  if (!PatchParseHexByteV16(text.c_str() + 1, out.r)) return false;
  if (!PatchParseHexByteV16(text.c_str() + 3, out.g)) return false;
  if (!PatchParseHexByteV16(text.c_str() + 5, out.b)) return false;
  out.a = 255;
  if (text.size() == 9 && !PatchParseHexByteV16(text.c_str() + 7, out.a)) return false;
  out.valid = true;
  return true;
}

static bool PatchShapeStyleV16(const PatchShapeV16& item, PatchColorV16& fill, PatchColorV16& stroke, double& strokeWidth, double& cornerRadius, double& opacity) {
  if (!PatchParseColorV16(item.fill, true, fill)) return false;
  if (!PatchParseColorV16(item.stroke, false, stroke)) return false;
  if (!PatchParseFiniteV16(item.strokeWidth, 0, 64, strokeWidth)) return false;
  if (!PatchParseFiniteV16(item.cornerRadius, 0, 4096, cornerRadius)) return false;
  if (!PatchParseFiniteV16(item.opacity, 0, 1, opacity)) return false;
  if (item.kind == PATCH_SHAPE_LINE_V16) fill.transparent = true;
  fill.a = (uint8_t)std::lround(std::min(255.0, (double)fill.a * opacity));
  stroke.a = (uint8_t)std::lround(std::min(255.0, (double)stroke.a * opacity));
  return true;
}

static const PatchShapeV16* PatchShapeForNativeIndexV16(const std::vector<PatchShapeV16>& shapes, int nativeIndex) {
  for (const auto& item : shapes) if (item.nativeIndex == nativeIndex) return &item;
  return nullptr;
}
