#import <Cocoa/Cocoa.h>
#include <mach-o/dyld.h>
#include <cstdint>
#include <cmath>
#include <cstring>
#include <fstream>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

static const char PATCH_MAGIC[8] = {'P','C','H','G','U','I','0','1'};
static const uint32_t PATCH_PAYLOAD_VERSION = 1;
static bool gRefreshing = false;

enum StateType : uint8_t { ST_NUMBER=1, ST_TEXT=2, ST_BOOLEAN=3 };
enum ControlKind : uint8_t { CK_TEXT=1, CK_BUTTON=2, CK_INPUT=3, CK_CHECKBOX=4 };
enum EventKind : uint8_t { EV_CLICKED=1, EV_CHANGED=2 };
enum ActionKind : uint8_t { ACT_OPEN=1, ACT_CLOSE=2, ACT_CHANGE=3 };
enum OpKind : uint8_t { OP_SET=1, OP_ADD=2, OP_REMOVE=3, OP_CLEAR=4 };
enum ValueKind : uint8_t { VK_NONE=0, VK_LITERAL=1, VK_EVENT=2 };

struct State {
  std::string name;
  uint8_t type = 0;
  double number = 0.0;
  std::string text;
  bool boolean = false;
};

struct Control {
  uint8_t kind = 0;
  std::string id;
  std::string text;
  std::string binding;
  int x = 0, y = 0, width = 0, height = 0;
  int formIndex = -1;
  NSControl* widget = nil;
};

struct Form {
  std::string id;
  std::string title;
  int width = 640, height = 420;
  bool visible = false;
  NSWindow* window = nil;
  std::vector<int> controls;
};

struct Operation {
  uint8_t op = 0;
  uint8_t valueKind = 0;
  double number = 0.0;
  std::string text;
  bool boolean = false;
};

struct Action {
  uint8_t kind = 0;
  std::string form;
  std::string target;
  uint8_t stateType = 0;
  std::vector<Operation> ops;
};

struct Event {
  std::string control;
  uint8_t kind = 0;
  uint8_t valueType = 0;
  std::vector<Action> actions;
};

static std::vector<State> gStates;
static std::vector<Form> gForms;
static std::vector<Control> gControls;
static std::vector<Event> gEvents;
static std::unordered_map<std::string, int> gStateByName;
static std::unordered_map<std::string, int> gFormById;
static std::unordered_map<std::string, int> gControlById;
static NSMutableArray* gWindowDelegates = nil;

static NSString* NS(const std::string& value) {
  return [[NSString alloc] initWithBytes:value.data() length:value.size() encoding:NSUTF8StringEncoding];
}

static uint32_t Crc32(const uint8_t* data, size_t size) {
  uint32_t crc = 0xffffffffu;
  for (size_t n = 0; n < size; ++n) {
    crc ^= data[n];
    for (int i = 0; i < 8; ++i) crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1u)));
  }
  return crc ^ 0xffffffffu;
}

class Reader {
 public:
  Reader(const uint8_t* data, size_t size) : data_(data), size_(size) {}
  uint8_t u8() { require(1); return data_[offset_++]; }
  uint32_t u32() {
    require(4);
    uint32_t value = (uint32_t)data_[offset_]
      | ((uint32_t)data_[offset_ + 1] << 8)
      | ((uint32_t)data_[offset_ + 2] << 16)
      | ((uint32_t)data_[offset_ + 3] << 24);
    offset_ += 4;
    return value;
  }
  int32_t i32() { return (int32_t)u32(); }
  double f64() {
    require(8);
    double value;
    std::memcpy(&value, data_ + offset_, 8);
    offset_ += 8;
    if (!std::isfinite(value)) throw 1;
    return value;
  }
  std::string text() {
    const uint32_t count = u32();
    require(count);
    std::string value(reinterpret_cast<const char*>(data_ + offset_), count);
    offset_ += count;
    NSString* checked = NS(value);
    if (!checked) throw 1;
    return value;
  }
  bool done() const { return offset_ == size_; }
 private:
  void require(size_t count) { if (count > size_ - offset_) throw 1; }
  const uint8_t* data_ = nullptr;
  size_t size_ = 0;
  size_t offset_ = 0;
};

static bool ResolveSelfPath(std::string& path) {
  uint32_t size = 0;
  _NSGetExecutablePath(nullptr, &size);
  if (!size || size > 1024 * 1024) return false;
  std::vector<char> buffer(size + 1, 0);
  if (_NSGetExecutablePath(buffer.data(), &size) != 0) return false;
  path.assign(buffer.data());
  return !path.empty();
}

static bool ReadSelfPayload(std::vector<uint8_t>& payload) {
  std::string path;
  if (!ResolveSelfPath(path)) return false;
  std::ifstream file(path, std::ios::binary | std::ios::ate);
  if (!file) return false;
  const std::streamoff size = file.tellg();
  if (size < 20) return false;
  file.seekg(size - 20);
  uint8_t footer[20]{};
  file.read(reinterpret_cast<char*>(footer), sizeof(footer));
  if (!file || std::memcmp(footer, PATCH_MAGIC, 8) != 0) return false;
  auto le32 = [](const uint8_t* p) -> uint32_t {
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
  };
  const uint32_t version = le32(footer + 8);
  const uint32_t length = le32(footer + 12);
  const uint32_t expectedCrc = le32(footer + 16);
  if (version != PATCH_PAYLOAD_VERSION || !length || (uint64_t)length > (uint64_t)(size - 20)) return false;
  file.seekg(size - 20 - (std::streamoff)length);
  payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()), (std::streamsize)length);
  return file && Crc32(payload.data(), payload.size()) == expectedCrc;
}

static void ReadTypedValue(Reader& reader, uint8_t type, double& number, std::string& text, bool& boolean) {
  if (type == ST_NUMBER) number = reader.f64();
  else if (type == ST_TEXT) text = reader.text();
  else if (type == ST_BOOLEAN) boolean = reader.u8() != 0;
  else throw 1;
}

static bool ParsePayload(const std::vector<uint8_t>& bytes) {
  try {
    Reader reader(bytes.data(), bytes.size());
    const uint32_t stateCount = reader.u32();
    if (stateCount > 10000) return false;
    gStates.reserve(stateCount);
    for (uint32_t i = 0; i < stateCount; ++i) {
      State state;
      state.name = reader.text();
      state.type = reader.u8();
      ReadTypedValue(reader, state.type, state.number, state.text, state.boolean);
      if (state.name.empty() || gStateByName.count(state.name)) return false;
      gStateByName[state.name] = (int)gStates.size();
      gStates.push_back(std::move(state));
    }

    const uint32_t formCount = reader.u32();
    if (!formCount || formCount > 1024) return false;
    gForms.reserve(formCount);
    for (uint32_t f = 0; f < formCount; ++f) {
      Form form;
      form.id = reader.text();
      form.title = reader.text();
      form.width = (int)reader.u32();
      form.height = (int)reader.u32();
      form.visible = reader.u8() != 0;
      if (form.id.empty() || gFormById.count(form.id) || form.width <= 0 || form.height <= 0 || form.width > 10000 || form.height > 10000) return false;
      gFormById[form.id] = (int)gForms.size();
      const uint32_t controlCount = reader.u32();
      if (controlCount > 10000) return false;
      const int formIndex = (int)gForms.size();
      for (uint32_t c = 0; c < controlCount; ++c) {
        Control control;
        control.kind = reader.u8();
        control.id = reader.text();
        control.text = reader.text();
        control.binding = reader.text();
        control.x = reader.i32();
        control.y = reader.i32();
        control.width = reader.i32();
        control.height = reader.i32();
        control.formIndex = formIndex;
        if (control.kind < CK_TEXT || control.kind > CK_CHECKBOX || control.width <= 0 || control.height <= 0 || control.width > 10000 || control.height > 10000) return false;
        if (!control.id.empty()) {
          if (gControlById.count(control.id)) return false;
          gControlById[control.id] = (int)gControls.size();
        }
        form.controls.push_back((int)gControls.size());
        gControls.push_back(std::move(control));
      }
      gForms.push_back(std::move(form));
    }

    const uint32_t eventCount = reader.u32();
    if (eventCount > 10000) return false;
    gEvents.reserve(eventCount);
    for (uint32_t e = 0; e < eventCount; ++e) {
      Event event;
      event.control = reader.text();
      event.kind = reader.u8();
      event.valueType = reader.u8();
      if (!gControlById.count(event.control) || (event.kind != EV_CLICKED && event.kind != EV_CHANGED) || event.valueType > 2) return false;
      const uint32_t actionCount = reader.u32();
      if (actionCount > 10000) return false;
      for (uint32_t a = 0; a < actionCount; ++a) {
        Action action;
        action.kind = reader.u8();
        if (action.kind == ACT_OPEN || action.kind == ACT_CLOSE) {
          action.form = reader.text();
          if (!gFormById.count(action.form)) return false;
        } else if (action.kind == ACT_CHANGE) {
          action.target = reader.text();
          action.stateType = reader.u8();
          auto stateIt = gStateByName.find(action.target);
          if (stateIt == gStateByName.end() || gStates[stateIt->second].type != action.stateType) return false;
          const uint32_t opCount = reader.u32();
          if (opCount > 10000) return false;
          for (uint32_t o = 0; o < opCount; ++o) {
            Operation op;
            op.op = reader.u8();
            op.valueKind = reader.u8();
            if (op.op < OP_SET || op.op > OP_CLEAR || op.valueKind > VK_EVENT) return false;
            if (op.op == OP_CLEAR) {
              if (op.valueKind != VK_NONE) return false;
            } else if (op.valueKind == VK_LITERAL) {
              ReadTypedValue(reader, action.stateType, op.number, op.text, op.boolean);
            } else if (op.valueKind != VK_EVENT) {
              return false;
            }
            action.ops.push_back(std::move(op));
          }
        } else {
          return false;
        }
        event.actions.push_back(std::move(action));
      }
      gEvents.push_back(std::move(event));
    }
    if (!reader.done()) return false;

    for (const Control& control : gControls) {
      if (control.kind == CK_INPUT) {
        auto it = gStateByName.find(control.binding);
        if (it == gStateByName.end() || gStates[it->second].type != ST_TEXT) return false;
      } else if (control.kind == CK_CHECKBOX) {
        auto it = gStateByName.find(control.binding);
        if (it == gStateByName.end() || gStates[it->second].type != ST_BOOLEAN) return false;
      }
    }
    return true;
  } catch (...) {
    return false;
  }
}

static std::string StateText(const State& state) {
  if (state.type == ST_BOOLEAN) return state.boolean ? "true" : "false";
  if (state.type == ST_TEXT) return state.text;
  if (std::floor(state.number) == state.number) return std::to_string((long long)state.number);
  std::ostringstream out;
  out.precision(15);
  out << state.number;
  return out.str();
}

static NSString* RenderText(const std::string& source) {
  std::string out;
  size_t pos = 0;
  while (pos < source.size()) {
    const size_t open = source.find('{', pos);
    if (open == std::string::npos) { out.append(source, pos, std::string::npos); break; }
    out.append(source, pos, open - pos);
    const size_t close = source.find('}', open + 1);
    if (close == std::string::npos) { out.append(source, open, std::string::npos); break; }
    const std::string name = source.substr(open + 1, close - open - 1);
    auto it = gStateByName.find(name);
    if (it == gStateByName.end()) out.append(source, open, close - open + 1);
    else out += StateText(gStates[it->second]);
    pos = close + 1;
  }
  return NS(out);
}

static void RefreshUI();

static void ApplyOperation(State& state, const Operation& op, bool eventBool, const std::string& eventText) {
  if (op.op == OP_CLEAR) {
    if (state.type == ST_NUMBER) state.number = 0.0;
    else if (state.type == ST_TEXT) state.text.clear();
    else state.boolean = false;
    return;
  }
  const bool fromEvent = op.valueKind == VK_EVENT;
  if (state.type == ST_NUMBER) {
    const double value = op.number;
    if (op.op == OP_SET) state.number = value;
    else if (op.op == OP_ADD) state.number += value;
    else if (op.op == OP_REMOVE) state.number -= value;
  } else if (state.type == ST_TEXT) {
    const std::string& value = fromEvent ? eventText : op.text;
    if (op.op == OP_SET) state.text = value;
    else if (op.op == OP_ADD) state.text += value;
  } else if (state.type == ST_BOOLEAN && op.op == OP_SET) {
    state.boolean = fromEvent ? eventBool : op.boolean;
  }
}

static void ExecuteEvent(const Event& event, bool eventBool, const std::string& eventText) {
  for (const Action& action : event.actions) {
    if (action.kind == ACT_OPEN) {
      [gForms[gFormById[action.form]].window makeKeyAndOrderFront:nil];
    } else if (action.kind == ACT_CLOSE) {
      [gForms[gFormById[action.form]].window orderOut:nil];
    } else if (action.kind == ACT_CHANGE) {
      State& state = gStates[gStateByName[action.target]];
      for (const Operation& op : action.ops) ApplyOperation(state, op, eventBool, eventText);
    }
  }
  RefreshUI();
}

static void DispatchControl(int controlIndex, uint8_t kind) {
  if (gRefreshing || controlIndex < 0 || controlIndex >= (int)gControls.size()) return;
  Control& control = gControls[controlIndex];
  if (control.id.empty()) return;
  for (const Event& event : gEvents) {
    if (event.control != control.id || event.kind != kind) continue;
    bool eventBool = false;
    std::string eventText;
    if (event.valueType == 1 && control.kind == CK_CHECKBOX) {
      eventBool = [(NSButton*)control.widget state] == NSControlStateValueOn;
    } else if (event.valueType == 2 && control.kind == CK_INPUT) {
      NSString* value = [(NSTextField*)control.widget stringValue];
      eventText = value ? std::string([value UTF8String] ?: "") : std::string();
    }
    ExecuteEvent(event, eventBool, eventText);
  }
}

@interface PatchEventTarget : NSObject <NSTextFieldDelegate>
- (void)handleControl:(id)sender;
@end

@implementation PatchEventTarget
- (void)handleControl:(id)sender {
  NSInteger index = [sender tag] - 1000;
  if (index < 0 || index >= (NSInteger)gControls.size()) return;
  Control& control = gControls[(size_t)index];
  DispatchControl((int)index, control.kind == CK_CHECKBOX ? EV_CHANGED : EV_CLICKED);
}
- (void)controlTextDidChange:(NSNotification*)notification {
  NSInteger index = [(NSTextField*)notification.object tag] - 1000;
  DispatchControl((int)index, EV_CHANGED);
}
@end

static PatchEventTarget* gEventTarget = nil;

@interface PatchWindowDelegate : NSObject <NSWindowDelegate>
@property(nonatomic) NSInteger formIndex;
@end

@implementation PatchWindowDelegate
- (BOOL)windowShouldClose:(NSWindow*)sender {
  if (self.formIndex == 0) [NSApp terminate:nil];
  else [sender orderOut:nil];
  return NO;
}
@end

static void SetText(Control& control, NSString* value) {
  if (control.kind == CK_BUTTON || control.kind == CK_CHECKBOX) {
    NSButton* button = (NSButton*)control.widget;
    if (![[button title] isEqualToString:value]) [button setTitle:value];
  } else {
    NSTextField* field = (NSTextField*)control.widget;
    if (![[field stringValue] isEqualToString:value]) [field setStringValue:value];
  }
}

static void RefreshUI() {
  gRefreshing = true;
  for (Control& control : gControls) {
    if (!control.widget) continue;
    if (control.kind == CK_TEXT || control.kind == CK_BUTTON) {
      SetText(control, RenderText(control.text));
    } else if (control.kind == CK_INPUT) {
      SetText(control, NS(gStates[gStateByName[control.binding]].text));
    } else if (control.kind == CK_CHECKBOX) {
      SetText(control, RenderText(control.text));
      [(NSButton*)control.widget setState:gStates[gStateByName[control.binding]].boolean ? NSControlStateValueOn : NSControlStateValueOff];
    }
  }
  gRefreshing = false;
}

static NSControl* CreateControl(int index) {
  Control& control = gControls[index];
  Form& form = gForms[control.formIndex];
  const int nativeY = std::max(0, form.height - control.y - control.height);
  NSRect rect = NSMakeRect(control.x, nativeY, control.width, control.height);
  NSControl* widget = nil;
  if (control.kind == CK_TEXT) {
    NSTextField* field = [[NSTextField alloc] initWithFrame:rect];
    field.editable = NO;
    field.selectable = NO;
    field.bezeled = NO;
    field.drawsBackground = NO;
    widget = field;
  } else if (control.kind == CK_INPUT) {
    NSTextField* field = [[NSTextField alloc] initWithFrame:rect];
    field.tag = 1000 + index;
    field.delegate = gEventTarget;
    widget = field;
  } else {
    NSButton* button = [[NSButton alloc] initWithFrame:rect];
    button.tag = 1000 + index;
    button.target = gEventTarget;
    button.action = @selector(handleControl:);
    if (control.kind == CK_CHECKBOX) button.buttonType = NSButtonTypeSwitch;
    else { button.buttonType = NSButtonTypeMomentaryPushIn; button.bezelStyle = NSBezelStyleRounded; }
    widget = button;
  }
  control.widget = widget;
  return widget;
}

static NSWindow* CreateForm(int index) {
  Form& form = gForms[index];
  NSRect rect = NSMakeRect(0, 0, form.width, form.height);
  NSWindowStyleMask style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable;
  NSWindow* window = [[NSWindow alloc] initWithContentRect:rect styleMask:style backing:NSBackingStoreBuffered defer:NO];
  window.title = NS(form.title);
  [window center];
  PatchWindowDelegate* delegate = [PatchWindowDelegate new];
  delegate.formIndex = index;
  [gWindowDelegates addObject:delegate];
  window.delegate = delegate;
  form.window = window;
  for (int controlIndex : form.controls) {
    NSControl* widget = CreateControl(controlIndex);
    if (!widget) return nil;
    [window.contentView addSubview:widget];
  }
  return window;
}

static bool HasArg(int argc, const char* argv[], const char* value) {
  for (int i = 1; i < argc; ++i) if (std::strcmp(argv[i], value) == 0) return true;
  return false;
}

static void PumpAppKit() {
  for (;;) {
    NSEvent* event = [NSApp nextEventMatchingMask:NSEventMaskAny untilDate:[NSDate dateWithTimeIntervalSinceNow:0] inMode:NSDefaultRunLoopMode dequeue:YES];
    if (!event) break;
    [NSApp sendEvent:event];
  }
}

static bool Click(const char* id) {
  auto it = gControlById.find(id);
  if (it == gControlById.end()) return false;
  Control& control = gControls[it->second];
  if (!control.widget || control.kind != CK_BUTTON) return false;
  [(NSButton*)control.widget performClick:nil];
  PumpAppKit();
  return true;
}

static int RunSmoke() {
  auto mainIt = gFormById.find("main");
  auto settingsIt = gFormById.find("settings");
  if (mainIt != gFormById.end() && ![gForms[mainIt->second].window isVisible]) {
    [gForms[mainIt->second].window makeKeyAndOrderFront:nil];
    PumpAppKit();
  }
  if (settingsIt != gFormById.end() && [gForms[settingsIt->second].window isVisible]) return 70;
  if (gControlById.count("open_settings") && settingsIt != gFormById.end()) {
    if (!Click("open_settings") || ![gForms[settingsIt->second].window isVisible]) return 71;
  }
  if (gControlById.count("notifications")) {
    Control& control = gControls[gControlById["notifications"]];
    auto stateIt = gStateByName.find("notifications");
    if (!control.widget || control.kind != CK_CHECKBOX || stateIt == gStateByName.end()) return 72;
    const bool before = gStates[stateIt->second].boolean;
    [(NSButton*)control.widget performClick:nil];
    PumpAppKit();
    if (gStates[stateIt->second].boolean == before) return 73;
  }
  if (gControlById.count("close_settings") && settingsIt != gFormById.end()) {
    if (!Click("close_settings") || [gForms[settingsIt->second].window isVisible]) return 74;
  }
  return 0;
}

int main(int argc, const char* argv[]) {
  @autoreleasepool {
    std::vector<uint8_t> payload;
    if (!ReadSelfPayload(payload)) {
      std::fprintf(stderr, "This Patch native AppKit runtime has no valid sealed application payload.\n");
      return 20;
    }
    if (!ParsePayload(payload)) {
      std::fprintf(stderr, "The sealed Patch application payload is invalid or unsupported.\n");
      return 21;
    }
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gEventTarget = [PatchEventTarget new];
    gWindowDelegates = [NSMutableArray arrayWithCapacity:gForms.size()];
    for (int i = 0; i < (int)gForms.size(); ++i) if (!CreateForm(i)) return 30 + i;
    RefreshUI();
    for (Form& form : gForms) if (form.visible) [form.window makeKeyAndOrderFront:nil];
    [NSApp finishLaunching];
    if (HasArg(argc, argv, "--patch-smoke")) return RunSmoke();
    [NSApp activateIgnoringOtherApps:YES];
    [NSApp run];
  }
  return 0;
}
