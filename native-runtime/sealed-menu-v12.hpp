#pragma once
#include <cstdint>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>
#include "sealed-list-v11.hpp"

// Later sealed runtimes may compile the proven v1.2 source as a private
// compatibility layer. These hooks are opt-in; normal v1.2 builds remain
// byte-for-byte source-compatible in behavior when neither macro is defined.
#ifdef PATCH_WIN32_RUNTIME_V13_RESTORE_ENTRY
#define wWinMain PATCH_WIN32_RUNTIME_V13_RESTORE_ENTRY
#endif
#ifdef PATCH_RUNTIME_V13_RESTORE_MAIN
#define main PATCH_RUNTIME_V13_RESTORE_MAIN
#endif

struct PatchMenuEntryV12 {
  uint32_t formIndex = 0;
  uint32_t menuIndex = 0;
  uint32_t entryIndex = 0;
  uint8_t type = 0; // 1 item, 2 separator
  int nativeItemIndex = -1;
  std::string id;
  std::string text;
  bool hasShortcut = false;
  uint8_t modifiers = 0; // Primary=1, Shift=2, Alt=4
  std::string key;
  std::string enabledState;
  std::string checkedState;
};

static bool PatchValidMenuShortcutKeyV12(const std::string& key) {
  if (key.size() == 1) {
    const char ch = key[0];
    return (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9');
  }
  if (key.size() == 2 && key[0] == 'F' && key[1] >= '1' && key[1] <= '9') return true;
  if (key.size() == 3 && key[0] == 'F' && key[1] == '1' && key[2] >= '0' && key[2] <= '2') return true;
  return false;
}

static std::string PatchMenuShortcutIdentityV12(uint8_t modifiers, const std::string& key) {
  std::string out;
  if (modifiers & 1) out += "Primary+";
  if (modifiers & 2) out += "Shift+";
  if (modifiers & 4) out += "Alt+";
  out += key;
  return out;
}

static bool PatchConvertPayloadV11ToV10(
  const std::vector<uint8_t>& payloadV11,
  std::vector<uint8_t>& payloadV10,
  std::vector<PatchMenuEntryV12>& menuEntries
) {
  payloadV10.clear();
  menuEntries.clear();
  try {
    PatchPayloadV11Reader reader(payloadV11);
    PatchPayloadV11Writer writer;
    std::unordered_map<std::string, uint8_t> stateTypes;
    std::unordered_set<std::string> shortcuts;

    const uint32_t stateCount = reader.u32();
    if (stateCount > 10000) return false;
    writer.u32(stateCount);
    for (uint32_t state = 0; state < stateCount; ++state) {
      const std::string name = reader.text();
      const uint8_t type = reader.u8();
      if (name.empty() || type < 1 || type > 4 || stateTypes.count(name)) return false;
      stateTypes[name] = type;
      writer.text(name);
      writer.u8(type);
      const size_t start = reader.offset();
      reader.skipTyped(type);
      writer.raw(payloadV11, start, reader.offset());
    }

    const uint32_t formCount = reader.u32();
    if (!formCount || formCount > 1024) return false;
    writer.u32(formCount);
    int nativeMenuItemIndex = 0;

    for (uint32_t form = 0; form < formCount; ++form) {
      const std::string formId = reader.text();
      const std::string title = reader.text();
      const uint32_t width = reader.u32(), height = reader.u32();
      const uint8_t visible = reader.u8();
      if (formId.empty() || !width || !height || width > 10000 || height > 10000 || visible > 1) return false;
      writer.text(formId); writer.text(title); writer.u32(width); writer.u32(height); writer.u8(visible);

      const uint32_t controlCount = reader.u32();
      if (controlCount > 10000) return false;
      writer.u32(controlCount);
      for (uint32_t control = 0; control < controlCount; ++control) {
        const size_t start = reader.offset();
        const uint8_t kind = reader.u8();
        reader.text(); reader.text(); reader.text();
        if (kind < 1 || kind > 9) return false;
        const uint32_t optionCount = reader.u32();
        if (optionCount > 10000) return false;
        for (uint32_t option = 0; option < optionCount; ++option) reader.skipText();
        reader.i32(); reader.i32();
        const int32_t controlWidth = reader.i32(), controlHeight = reader.i32();
        if (controlWidth <= 0 || controlHeight <= 0 || controlWidth > 10000 || controlHeight > 10000) return false;
        const uint8_t policyKind = reader.u8(), policyValue = reader.u8();
        if (policyKind == 0) { if (policyValue != 0) return false; }
        else if (policyKind == 1) { if (policyValue < 1 || policyValue > 15) return false; }
        else if (policyKind == 2) { if (policyValue < 1 || policyValue > 5) return false; }
        else return false;
        reader.i32(); reader.i32();
        const uint32_t columnCount = reader.u32();
        if (columnCount > 256) return false;
        for (uint32_t column = 0; column < columnCount; ++column) reader.skipText();
        const uint32_t rowCount = reader.u32();
        if (rowCount > 10000) return false;
        for (uint32_t row = 0; row < rowCount; ++row) for (uint32_t column = 0; column < columnCount; ++column) reader.skipText();
        if (kind == 9) { if (!columnCount || !rowCount) return false; }
        else if (columnCount || rowCount) return false;
        writer.raw(payloadV11, start, reader.offset());
      }

      const uint32_t menuCount = reader.u32();
      if (menuCount > 1024) return false;
      writer.u32(menuCount);
      for (uint32_t menu = 0; menu < menuCount; ++menu) {
        const std::string menuTitle = reader.text();
        const uint32_t entryCount = reader.u32();
        if (menuTitle.empty() || !entryCount || entryCount > 10000) return false;
        writer.text(menuTitle);

        std::vector<PatchMenuEntryV12> parsed;
        parsed.reserve(entryCount);
        uint32_t itemCount = 0;
        bool previousSeparator = false;
        for (uint32_t entryIndex = 0; entryIndex < entryCount; ++entryIndex) {
          PatchMenuEntryV12 entry;
          entry.formIndex = form;
          entry.menuIndex = menu;
          entry.entryIndex = entryIndex;
          entry.type = reader.u8();
          if (entry.type == 2) {
            if (entryIndex == 0 || entryIndex + 1 == entryCount || previousSeparator) return false;
            previousSeparator = true;
            parsed.push_back(std::move(entry));
            continue;
          }
          if (entry.type != 1) return false;
          previousSeparator = false;
          entry.id = reader.text();
          entry.text = reader.text();
          if (entry.id.empty()) return false;
          const uint8_t hasShortcut = reader.u8();
          if (hasShortcut > 1) return false;
          entry.hasShortcut = hasShortcut == 1;
          if (entry.hasShortcut) {
            entry.modifiers = reader.u8();
            entry.key = reader.text();
            if (entry.modifiers > 7 || !PatchValidMenuShortcutKeyV12(entry.key)) return false;
            const std::string identity = PatchMenuShortcutIdentityV12(entry.modifiers, entry.key);
            if (!shortcuts.insert(identity).second) return false;
          }
          entry.enabledState = reader.text();
          entry.checkedState = reader.text();
          if (!entry.enabledState.empty()) {
            auto state = stateTypes.find(entry.enabledState);
            if (state == stateTypes.end() || state->second != 3) return false;
          }
          if (!entry.checkedState.empty()) {
            auto state = stateTypes.find(entry.checkedState);
            if (state == stateTypes.end() || state->second != 3) return false;
          }
          entry.nativeItemIndex = nativeMenuItemIndex++;
          ++itemCount;
          parsed.push_back(std::move(entry));
        }
        if (!itemCount) return false;
        writer.u32(itemCount);
        for (const auto& entry : parsed) {
          if (entry.type != 1) continue;
          writer.text(entry.id);
          writer.text(entry.text);
          menuEntries.push_back(entry);
        }
        for (const auto& entry : parsed) if (entry.type == 2) menuEntries.push_back(entry);
      }
    }

    writer.raw(payloadV11, reader.offset(), payloadV11.size());
    payloadV10 = writer.take();
    return !payloadV10.empty();
  } catch (...) {
    payloadV10.clear();
    menuEntries.clear();
    return false;
  }
}
