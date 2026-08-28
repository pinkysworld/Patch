#pragma once
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <cctype>
#include <string>
#include <vector>
#include <set>
#include <cmath>
#include <sstream>

enum PatchPaintNodeKindV17 : uint32_t {
  PATCH_PAINT_DRAW_V17 = 0,
  PATCH_PAINT_IF_V17 = 1,
  PATCH_PAINT_REPEAT_V17 = 2
};

enum PatchPaintOpV17 : uint32_t {
  PATCH_PAINT_CLEAR_V17 = 0,
  PATCH_PAINT_LINE_V17 = 1,
  PATCH_PAINT_RECTANGLE_V17 = 2,
  PATCH_PAINT_ELLIPSE_V17 = 3,
  PATCH_PAINT_TEXT_V17 = 4
};

struct PatchPaintNodeV17 {
  uint32_t kind = 0;
  uint32_t operation = 0;
  std::string expr;
  std::string color;
  std::string fill;
  std::string stroke;
  std::string textExpr;
  std::string x, y, width, height, x1, y1, x2, y2, strokeWidth, fontSize;
  std::vector<PatchPaintNodeV17> thenBody;
  std::vector<PatchPaintNodeV17> elseBody;
  std::vector<PatchPaintNodeV17> body;
};

struct PatchPaintBoxV17 {
  int nativeIndex = -1;
  std::string id;
  std::string width;
  std::string height;
  std::vector<PatchPaintNodeV17> program;
};

class PatchPaintReaderV17 {
public:
  PatchPaintReaderV17(const uint8_t* data, size_t size): data_(data), size_(size) {}
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
  PatchPaintNodeV17 readNode(int& remaining) {
    if (--remaining < 0) throw 1;
    PatchPaintNodeV17 node;
    node.kind = u32();
    if (node.kind == PATCH_PAINT_DRAW_V17) {
      node.operation = u32();
      if (node.operation == PATCH_PAINT_CLEAR_V17) {
        node.color = text();
      } else if (node.operation == PATCH_PAINT_LINE_V17) {
        node.x1 = text(); node.y1 = text(); node.x2 = text(); node.y2 = text();
        node.stroke = text(); node.strokeWidth = text();
      } else if (node.operation == PATCH_PAINT_RECTANGLE_V17 || node.operation == PATCH_PAINT_ELLIPSE_V17) {
        node.x = text(); node.y = text(); node.width = text(); node.height = text();
        node.fill = text(); node.stroke = text(); node.strokeWidth = text();
      } else if (node.operation == PATCH_PAINT_TEXT_V17) {
        node.textExpr = text(); node.x = text(); node.y = text(); node.color = text(); node.fontSize = text();
      } else throw 1;
      return node;
    }
    if (node.kind == PATCH_PAINT_IF_V17) {
      node.expr = text();
      node.thenBody = readProgram(remaining);
      node.elseBody = readProgram(remaining);
      return node;
    }
    if (node.kind == PATCH_PAINT_REPEAT_V17) {
      node.expr = text();
      node.body = readProgram(remaining);
      return node;
    }
    throw 1;
  }
  std::vector<PatchPaintNodeV17> readProgram(int& remaining) {
    uint32_t count = u32();
    std::vector<PatchPaintNodeV17> nodes;
    nodes.reserve(count);
    for (uint32_t index = 0; index < count; ++index) nodes.push_back(readNode(remaining));
    return nodes;
  }
private:
  void need(size_t n) { if (n > size_ - off_) throw 1; }
  const uint8_t* data_ = nullptr;
  size_t size_ = 0, off_ = 0;
};

static bool PatchConvertPayloadV16ToV15(const std::vector<uint8_t>& input, std::vector<uint8_t>& payloadV15, std::vector<PatchPaintBoxV17>& paintboxes) {
  paintboxes.clear();
  payloadV15.clear();
  try {
    if (input.size() < 8) return false;
    const size_t trailer = input.size() - 8;
    if (std::memcmp(input.data() + trailer, "PPBX", 4) != 0) return false;
    const uint8_t* p = input.data() + trailer + 4;
    uint32_t extLen = (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
    if ((size_t)extLen > trailer) return false;
    const size_t extStart = trailer - (size_t)extLen;
    if (extStart == 0) return false;
    payloadV15.assign(input.begin(), input.begin() + (std::ptrdiff_t)extStart);
    PatchPaintReaderV17 r(input.data() + extStart, (size_t)extLen);
    uint32_t count = r.u32();
    if (count > 1024) return false;
    std::set<int> nativeIndices;
    std::set<std::string> ids;
    int remaining = 4096;
    for (uint32_t index = 0; index < count; ++index) {
      PatchPaintBoxV17 item;
      item.nativeIndex = (int)r.u32();
      item.id = r.text();
      item.width = r.text();
      item.height = r.text();
      item.program = r.readProgram(remaining);
      if (item.nativeIndex < 0 || item.id.empty() || !ids.insert(item.id).second || !nativeIndices.insert(item.nativeIndex).second) return false;
      paintboxes.push_back(std::move(item));
    }
    return r.done();
  } catch (...) {
    payloadV15.clear();
    paintboxes.clear();
    return false;
  }
}

static const PatchPaintBoxV17* PatchPaintBoxForNativeIndexV17(const std::vector<PatchPaintBoxV17>& paintboxes, int nativeIndex) {
  for (const auto& item : paintboxes) if (item.nativeIndex == nativeIndex) return &item;
  return nullptr;
}

static bool PatchPaintUnquoteV17(const std::string& expr, std::string& out) {
  if (expr.size() < 2 || expr.front() != '"' || expr.back() != '"') return false;
  out.clear();
  for (size_t i = 1; i + 1 < expr.size(); ++i) {
    if (expr[i] == '\\' && i + 2 < expr.size()) {
      out.push_back(expr[++i]);
      continue;
    }
    out.push_back(expr[i]);
  }
  return true;
}

static bool PatchPaintSimpleIdentV17(const std::string& value) {
  if (value.empty()) return false;
  const unsigned char first = (unsigned char)value.front();
  if (!(std::isalpha(first) || value.front() == '_')) return false;
  for (size_t i = 1; i < value.size(); ++i) {
    const unsigned char c = (unsigned char)value[i];
    if (!(std::isalnum(c) || value[i] == '_')) return false;
  }
  return true;
}

static bool PatchPaintParseNumberTextV17(const std::string& value, double& out) {
  size_t start = 0, endIndex = value.size();
  while (start < endIndex && std::isspace((unsigned char)value[start])) ++start;
  while (endIndex > start && std::isspace((unsigned char)value[endIndex - 1])) --endIndex;
  if (start == endIndex) { out = 0; return true; }
  const std::string trimmed = value.substr(start, endIndex - start);
  char* end = nullptr;
  out = std::strtod(trimmed.c_str(), &end);
  return end && end != trimmed.c_str() && *end == 0 && std::isfinite(out);
}

static bool PatchPaintLookupStateV17(const std::string& name, const State*& out) {
#ifdef _WIN32
  auto it = gStateByName.find(PatchWideV11(name));
#else
  auto it = gStateByName.find(name);
#endif
  if (it == gStateByName.end() || it->second < 0 || (size_t)it->second >= gStates.size()) return false;
  out = &gStates[(size_t)it->second];
  return true;
}

#ifdef _WIN32
static std::string PatchPaintNarrowV17(const std::wstring& value) {
  if (value.empty()) return {};
  int needed = WideCharToMultiByte(CP_UTF8, 0, value.c_str(), (int)value.size(), nullptr, 0, nullptr, nullptr);
  if (needed <= 0) return {};
  std::string out((size_t)needed, '\0');
  if (WideCharToMultiByte(CP_UTF8, 0, value.c_str(), (int)value.size(), out.data(), needed, nullptr, nullptr) != needed) return {};
  return out;
}
#endif

static bool PatchPaintEvalNumberV17(const std::string& expr, int loopCount, double& out) {
  if (loopCount > 0 && expr == "count") { out = (double)loopCount; return true; }
  if (PatchPaintParseNumberTextV17(expr, out)) return true;
  const State* state = nullptr;
  if (!PatchPaintLookupStateV17(expr, state)) return false;
  if (state->type == ST_NUMBER) { out = state->number; return std::isfinite(out); }
  if (state->type == ST_BOOLEAN) { out = state->boolean ? 1.0 : 0.0; return true; }
  if (state->type == ST_TEXT) {
#ifdef _WIN32
    const std::string text = PatchPaintNarrowV17(state->text);
#else
    const std::string& text = state->text;
#endif
    return PatchPaintParseNumberTextV17(text, out);
  }
  return false;
}

static bool PatchPaintEvalBoolV17(const std::string& expr, int loopCount, bool& out) {
  if (expr == "true") { out = true; return true; }
  if (expr == "false") { out = false; return true; }
  if (loopCount > 0 && expr == "count") { out = true; return true; }

  double literal = 0;
  if (PatchPaintParseNumberTextV17(expr, literal)) { out = literal != 0; return true; }

  const State* state = nullptr;
  if (!PatchPaintLookupStateV17(expr, state)) return false;
  if (state->type == ST_BOOLEAN) { out = state->boolean; return true; }
  if (state->type == ST_NUMBER) { out = state->number != 0; return std::isfinite(state->number); }
  if (state->type == ST_TEXT) {
#ifdef _WIN32
    out = !state->text.empty();
#else
    out = !state->text.empty();
#endif
    return true;
  }
  return false;
}

static bool PatchPaintEvalTextV17(const std::string& expr, int loopCount, std::string& out) {
  if (PatchPaintUnquoteV17(expr, out)) return true;
  if (loopCount > 0 && expr == "count") { out = std::to_string(loopCount); return true; }
  double number = 0;
  if (PatchPaintParseNumberTextV17(expr, number)) {
    std::ostringstream stream;
    stream << number;
    out = stream.str();
    return true;
  }
  const State* state = nullptr;
  if (!PatchPaintLookupStateV17(expr, state)) {
    if (PatchPaintSimpleIdentV17(expr)) { out = expr; return true; }
    return false;
  }
#ifdef _WIN32
  out = PatchPaintNarrowV17(StateText(*state));
#else
  out = StateText(*state);
#endif
  return true;
}

static bool PatchPaintEvalRepeatV17(const std::string& expr, int loopCount, int& out) {
  double number = 0;
  if (!PatchPaintEvalNumberV17(expr, loopCount, number)) return false;
  if (!std::isfinite(number) || number < 0 || number > 100000 || number != std::floor(number)) return false;
  out = (int)number;
  return true;
}

struct PatchPaintMetricsV17 {
  double sx = 1, sy = 1, width = 1, height = 1;
};

static bool PatchPaintMetricsFromBoxV17(const PatchPaintBoxV17& box, double clientW, double clientH, PatchPaintMetricsV17& out) {
  double logicalW = 0, logicalH = 0;
  if (!PatchParseFiniteV16(box.width, 16, 1000000, logicalW) || !PatchParseFiniteV16(box.height, 16, 1000000, logicalH)) return false;
  if (logicalW <= 0 || logicalH <= 0 || clientW <= 0 || clientH <= 0) return false;
  out.sx = clientW / logicalW;
  out.sy = clientH / logicalH;
  out.width = clientW;
  out.height = clientH;
  return std::isfinite(out.sx) && std::isfinite(out.sy) && out.sx > 0 && out.sy > 0;
}

static double PatchPaintMapX(const PatchPaintMetricsV17& metrics, double x) { return x * metrics.sx; }
static double PatchPaintMapY(const PatchPaintMetricsV17& metrics, double y) { return y * metrics.sy; }
static double PatchPaintMapW(const PatchPaintMetricsV17& metrics, double w) { return w * metrics.sx; }
static double PatchPaintMapH(const PatchPaintMetricsV17& metrics, double h) { return h * metrics.sy; }
static double PatchPaintMapFont(const PatchPaintMetricsV17& metrics, double size) { return size * metrics.sy; }

template <typename Draw>
static void PatchPaintRunProgramV17(const std::vector<PatchPaintNodeV17>& nodes, int loopCount, Draw&& draw) {
  for (const auto& node : nodes) {
    if (node.kind == PATCH_PAINT_IF_V17) {
      bool cond = false;
      if (!PatchPaintEvalBoolV17(node.expr, loopCount, cond)) continue;
      PatchPaintRunProgramV17(cond ? node.thenBody : node.elseBody, loopCount, draw);
      continue;
    }
    if (node.kind == PATCH_PAINT_REPEAT_V17) {
      int n = 0;
      if (!PatchPaintEvalRepeatV17(node.expr, loopCount, n) || n <= 0) continue;
      for (int index = 1; index <= n; ++index) PatchPaintRunProgramV17(node.body, index, draw);
      continue;
    }
    if (node.kind == PATCH_PAINT_DRAW_V17) draw(node, loopCount);
  }
}