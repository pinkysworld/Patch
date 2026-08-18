#pragma once
#include <cstdint>
#include <string>
#include <unordered_set>
#include <utility>
#include <vector>
#include "sealed-menu-v12.hpp"

struct PatchTreeNodeV13 {
  int32_t parent = -1;
  std::string text;
};

struct PatchTreeV13 {
  int nativeIndex = -1;
  std::string id;
  std::vector<PatchTreeNodeV13> nodes;
};

// Runtime-v1.3 compatibility helpers. The v1.3 sources compile the proven
// v1.2 implementation as a private layer; these adapters bridge only naming or
// toolkit-type differences and do not alter the v1.2 payload/action semantics.
#if defined(_WIN32)
static bool CreateFormsV09() { return CreateForms(); }
static bool PatchTranslateMenuAcceleratorV12(MSG* msg) {
  return msg != nullptr && PatchTranslateAcceleratorV12(*msg);
}
#endif

#ifdef __OBJC__
static NSString* NS(NSString* value) { return value; }
#endif

#ifdef GTK_MAJOR_VERSION
static int PatchTreeModelCount(GtkTreeModel* model, GtkTreeIter* parent) {
  if (!model) return 0;
  int count = 0;
  GtkTreeIter iter;
  gboolean ok = gtk_tree_model_iter_children(model, &iter, parent);
  while (ok) {
    ++count;
    count += PatchTreeModelCount(model, &iter);
    ok = gtk_tree_model_iter_next(model, &iter);
  }
  return count;
}
#endif

static bool PatchConvertPayloadV12ToV11(
  const std::vector<uint8_t>& payloadV12,
  std::vector<uint8_t>& payloadV11,
  std::vector<PatchTreeV13>& trees
) {
  payloadV11.clear();
  trees.clear();
  try {
    PatchPayloadV11Reader reader(payloadV12);
    PatchPayloadV11Writer writer;

    const uint32_t stateCount = reader.u32();
    if (stateCount > 10000) return false;
    for (uint32_t state = 0; state < stateCount; ++state) {
      reader.skipText();
      const uint8_t type = reader.u8();
      if (type < 1 || type > 4) return false;
      reader.skipTyped(type);
    }

    const uint32_t formCount = reader.u32();
    if (!formCount || formCount > 1024) return false;
    for (uint32_t form = 0; form < formCount; ++form) {
      reader.skipText(); reader.skipText(); reader.u32(); reader.u32();
      if (reader.u8() > 1) return false;
      const uint32_t controlCount = reader.u32();
      if (controlCount > 10000) return false;
      for (uint32_t control = 0; control < controlCount; ++control) {
        const uint8_t kind = reader.u8();
        if (kind < 1 || kind > 9) return false;
        reader.skipText(); reader.skipText(); reader.skipText();
        const uint32_t optionCount = reader.u32();
        if (optionCount > 10000) return false;
        for (uint32_t option = 0; option < optionCount; ++option) reader.skipText();
        reader.i32(); reader.i32();
        const int32_t width = reader.i32(), height = reader.i32();
        if (width <= 0 || height <= 0 || width > 10000 || height > 10000) return false;
        const uint8_t policyKind = reader.u8(), policyValue = reader.u8();
        if (policyKind == 0) { if (policyValue != 0) return false; }
        else if (policyKind == 1) { if (policyValue < 1 || policyValue > 15) return false; }
        else if (policyKind == 2) { if (policyValue < 1 || policyValue > 5) return false; }
        else return false;
        reader.i32(); reader.i32();
        const uint32_t columns = reader.u32();
        if (columns > 256) return false;
        for (uint32_t column = 0; column < columns; ++column) reader.skipText();
        const uint32_t rows = reader.u32();
        if (rows > 10000) return false;
        for (uint32_t row = 0; row < rows; ++row) for (uint32_t column = 0; column < columns; ++column) reader.skipText();
        if (kind == 9) { if (!columns || !rows) return false; }
        else if (columns || rows) return false;
      }
      const uint32_t menuCount = reader.u32();
      if (menuCount > 1024) return false;
      for (uint32_t menu = 0; menu < menuCount; ++menu) {
        reader.skipText();
        const uint32_t entryCount = reader.u32();
        if (!entryCount || entryCount > 10000) return false;
        for (uint32_t entry = 0; entry < entryCount; ++entry) {
          const uint8_t type = reader.u8();
          if (type == 2) continue;
          if (type != 1) return false;
          reader.skipText(); reader.skipText();
          const uint8_t hasShortcut = reader.u8();
          if (hasShortcut > 1) return false;
          if (hasShortcut) { reader.u8(); reader.skipText(); }
          reader.skipText(); reader.skipText();
        }
      }
    }

    const size_t prefixEnd = reader.offset();
    writer.raw(payloadV12, 0, prefixEnd);

    const uint32_t treeCount = reader.u32();
    if (treeCount > 1024) return false;
    std::unordered_set<int> nativeIndices;
    std::unordered_set<std::string> ids;
    trees.reserve(treeCount);
    for (uint32_t treeIndex = 0; treeIndex < treeCount; ++treeIndex) {
      PatchTreeV13 tree;
      const uint32_t nativeIndex = reader.u32();
      if (nativeIndex > 9999) return false;
      tree.nativeIndex = (int)nativeIndex;
      tree.id = reader.text();
      const uint32_t nodeCount = reader.u32();
      if (tree.id.empty() || !ids.insert(tree.id).second || !nativeIndices.insert(tree.nativeIndex).second || !nodeCount || nodeCount > 10000) return false;
      tree.nodes.reserve(nodeCount);
      for (uint32_t nodeIndex = 0; nodeIndex < nodeCount; ++nodeIndex) {
        PatchTreeNodeV13 node;
        node.parent = reader.i32();
        node.text = reader.text();
        if (node.parent < -1 || node.parent >= (int32_t)nodeIndex) return false;
        tree.nodes.push_back(std::move(node));
      }
      trees.push_back(std::move(tree));
    }

    writer.raw(payloadV12, reader.offset(), payloadV12.size());
    payloadV11 = writer.take();
    return !payloadV11.empty();
  } catch (...) {
    payloadV11.clear();
    trees.clear();
    return false;
  }
}

static const PatchTreeV13* PatchTreeForNativeIndexV13(const std::vector<PatchTreeV13>& trees, int nativeIndex) {
  for (const auto& tree : trees) if (tree.nativeIndex == nativeIndex) return &tree;
  return nullptr;
}

static std::vector<int> PatchTreePathIndicesV13(const PatchTreeV13& tree, int nodeIndex) {
  std::vector<int> reversed;
  int current = nodeIndex;
  while (current >= 0 && current < (int)tree.nodes.size()) {
    reversed.push_back(current);
    current = tree.nodes[(size_t)current].parent;
  }
  if (current != -1) return {};
  return std::vector<int>(reversed.rbegin(), reversed.rend());
}
