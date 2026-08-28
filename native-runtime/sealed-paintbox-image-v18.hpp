#pragma once
#include "picture-data-v15.hpp"
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <string>
#include <vector>
#include <set>
#include <map>
#include <cmath>
#include <sstream>

enum PatchPaintNodeKindV18 : uint32_t {
  PATCH_PAINT_DRAW_V18 = 0,
  PATCH_PAINT_IF_V18 = 1,
  PATCH_PAINT_REPEAT_V18 = 2
};

enum PatchPaintOpV18 : uint32_t {
  PATCH_PAINT_CLEAR_V18 = 0,
  PATCH_PAINT_LINE_V18 = 1,
  PATCH_PAINT_RECTANGLE_V18 = 2,
  PATCH_PAINT_ELLIPSE_V18 = 3,
  PATCH_PAINT_TEXT_V18 = 4,
  PATCH_PAINT_IMAGE_V18 = 5
};

struct PatchPaintNodeV18 {
  uint32_t kind = 0;
  uint32_t operation = 0;
  std::string expr;
  std::string color;
  std::string fill;
  std::string stroke;
  std::string textExpr;
  std::string source;
  std::string x, y, width, height, x1, y1, x2, y2, strokeWidth, fontSize;
  std::vector<PatchPaintNodeV18> thenBody;
  std::vector<PatchPaintNodeV18> elseBody;
  std::vector<PatchPaintNodeV18> body;
};

struct PatchPaintBoxV18 {
  int nativeIndex = -1;
  std::string id;
  std::string width;
  std::string height;
  std::vector<PatchPaintNodeV18> program;
};

class PatchPaintReaderV18 {
public:
  PatchPaintReaderV18(const uint8_t* data, size_t size): data_(data), size_(size) {}
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
  PatchPaintNodeV18 readNode(int& remaining) {
    if (--remaining < 0) throw 1;
    PatchPaintNodeV18 node;
    node.kind = u32();
    if (node.kind == PATCH_PAINT_DRAW_V18) {
      node.operation = u32();
      if (node.operation == PATCH_PAINT_CLEAR_V18) {
        node.color = text();
      } else if (node.operation == PATCH_PAINT_LINE_V18) {
        node.x1 = text(); node.y1 = text(); node.x2 = text(); node.y2 = text();
        node.stroke = text(); node.strokeWidth = text();
      } else if (node.operation == PATCH_PAINT_RECTANGLE_V18 || node.operation == PATCH_PAINT_ELLIPSE_V18) {
        node.x = text(); node.y = text(); node.width = text(); node.height = text();
        node.fill = text(); node.stroke = text(); node.strokeWidth = text();
      } else if (node.operation == PATCH_PAINT_TEXT_V18) {
        node.textExpr = text(); node.x = text(); node.y = text(); node.color = text(); node.fontSize = text();
      } else if (node.operation == PATCH_PAINT_IMAGE_V18) {
        node.source = text(); node.x = text(); node.y = text(); node.width = text(); node.height = text();
      } else throw 1;
      return node;
    }
    if (node.kind == PATCH_PAINT_IF_V18) {
      node.expr = text();
      node.thenBody = readProgram(remaining);
      node.elseBody = readProgram(remaining);
      return node;
    }
    if (node.kind == PATCH_PAINT_REPEAT_V18) {
      node.expr = text();
      node.body = readProgram(remaining);
      return node;
    }
    throw 1;
  }
  std::vector<PatchPaintNodeV18> readProgram(int& remaining) {
    uint32_t count = u32();
    std::vector<PatchPaintNodeV18> nodes;
    nodes.reserve(count);
    for (uint32_t index = 0; index < count; ++index) nodes.push_back(readNode(remaining));
    return nodes;
  }
private:
  void need(size_t n) { if (n > size_ - off_) throw 1; }
  const uint8_t* data_ = nullptr;
  size_t size_ = 0, off_ = 0;
};

static bool PatchConvertPayloadV17ToV16(const std::vector<uint8_t>& input, std::vector<uint8_t>& payloadV16, std::vector<PatchPaintBoxV18>& overlays) {
  overlays.clear();
  payloadV16.clear();
  try {
    if (input.size() < 8) return false;
    const size_t trailer = input.size() - 8;
    if (std::memcmp(input.data() + trailer, "PIMG", 4) != 0) return false;
    const uint8_t* p = input.data() + trailer + 4;
    uint32_t extLen = (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
    if ((size_t)extLen > trailer) return false;
    const size_t extStart = trailer - (size_t)extLen;
    if (extStart == 0) return false;
    payloadV16.assign(input.begin(), input.begin() + (std::ptrdiff_t)extStart);
    PatchPaintReaderV18 r(input.data() + extStart, (size_t)extLen);
    uint32_t count = r.u32();
    if (count > 1024) return false;
    std::set<int> nativeIndices;
    std::set<std::string> ids;
    int remaining = 4096;
    for (uint32_t index = 0; index < count; ++index) {
      PatchPaintBoxV18 item;
      item.nativeIndex = (int)r.u32();
      item.id = r.text();
      item.width = r.text();
      item.height = r.text();
      item.program = r.readProgram(remaining);
      if (item.nativeIndex < 0 || item.id.empty() || !ids.insert(item.id).second || !nativeIndices.insert(item.nativeIndex).second) return false;
      overlays.push_back(std::move(item));
    }
    return r.done();
  } catch (...) {
    payloadV16.clear();
    overlays.clear();
    return false;
  }
}

static const PatchPaintBoxV18* PatchPaintBoxForNativeIndexV18(const std::vector<PatchPaintBoxV18>& overlays, int nativeIndex) {
  for (const auto& item : overlays) if (item.nativeIndex == nativeIndex) return &item;
  return nullptr;
}

template <typename Draw>
static void PatchPaintRunProgramV18(const std::vector<PatchPaintNodeV18>& nodes, int loopCount, Draw&& draw) {
  for (const auto& node : nodes) {
    if (node.kind == PATCH_PAINT_IF_V18) {
      bool cond = false;
      if (!PatchPaintEvalBoolV17(node.expr, loopCount, cond)) continue;
      PatchPaintRunProgramV18(cond ? node.thenBody : node.elseBody, loopCount, draw);
      continue;
    }
    if (node.kind == PATCH_PAINT_REPEAT_V18) {
      int n = 0;
      if (!PatchPaintEvalRepeatV17(node.expr, loopCount, n) || n <= 0) continue;
      for (int index = 1; index <= n; ++index) PatchPaintRunProgramV18(node.body, index, draw);
      continue;
    }
    if (node.kind == PATCH_PAINT_DRAW_V18) draw(node, loopCount);
  }
}
