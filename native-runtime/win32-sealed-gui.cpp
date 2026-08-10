#define UNICODE
#define _UNICODE
#include <windows.h>
#include <cstdint>
#include <cmath>
#include <cstring>
#include <string>
#include <vector>
#include <unordered_map>
#include <sstream>

static const wchar_t* PATCH_WINDOW_CLASS = L"PatchSealedNativeWindowV1";
static const char PATCH_MAGIC[8] = {'P','C','H','G','U','I','0','1'};
static const uint32_t PATCH_PAYLOAD_VERSION = 1;
static HINSTANCE gInstance = nullptr;
static HFONT gGuiFont = nullptr;
static bool gRefreshing = false;

enum StateType : uint8_t { ST_NUMBER=1, ST_TEXT=2, ST_BOOLEAN=3 };
enum ControlKind : uint8_t { CK_TEXT=1, CK_BUTTON=2, CK_INPUT=3, CK_CHECKBOX=4 };
enum EventKind : uint8_t { EV_CLICKED=1, EV_CHANGED=2 };
enum ActionKind : uint8_t { ACT_OPEN=1, ACT_CLOSE=2, ACT_CHANGE=3 };
enum OpKind : uint8_t { OP_SET=1, OP_ADD=2, OP_REMOVE=3, OP_CLEAR=4 };
enum ValueKind : uint8_t { VK_NONE=0, VK_LITERAL=1, VK_EVENT=2 };

struct State {
  std::wstring name;
  uint8_t type = 0;
  double number = 0.0;
  std::wstring text;
  bool boolean = false;
};
struct Control {
  uint8_t kind = 0;
  std::wstring id;
  std::wstring text;
  std::wstring binding;
  int x = 0, y = 0, width = 0, height = 0;
  int formIndex = -1;
  int commandId = 0;
  HWND hwnd = nullptr;
};
struct Form {
  std::wstring id;
  std::wstring title;
  int width = 640, height = 420;
  bool visible = false;
  HWND hwnd = nullptr;
  std::vector<int> controls;
};
struct Operation {
  uint8_t op = 0;
  uint8_t valueKind = 0;
  double number = 0.0;
  std::wstring text;
  bool boolean = false;
};
struct Action {
  uint8_t kind = 0;
  std::wstring form;
  std::wstring target;
  uint8_t stateType = 0;
  std::vector<Operation> ops;
};
struct Event {
  std::wstring control;
  uint8_t kind = 0;
  uint8_t valueType = 0;
  std::vector<Action> actions;
};

static std::vector<State> gStates;
static std::vector<Form> gForms;
static std::vector<Control> gControls;
static std::vector<Event> gEvents;
static std::unordered_map<std::wstring, int> gStateByName;
static std::unordered_map<std::wstring, int> gFormById;
static std::unordered_map<std::wstring, int> gControlById;

static uint32_t Crc32(const uint8_t* data, size_t size) {
  uint32_t crc = 0xffffffffu;
  for (size_t n = 0; n < size; ++n) {
    crc ^= data[n];
    for (int i = 0; i < 8; ++i) crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1u)));
  }
  return crc ^ 0xffffffffu;
}

static std::wstring Utf8ToWide(const uint8_t* data, size_t size) {
  if (!size) return L"";
  if (size > INT_MAX) throw 1;
  const int needed = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, reinterpret_cast<const char*>(data), (int)size, nullptr, 0);
  if (needed <= 0) throw 1;
  std::wstring out((size_t)needed, L'\0');
  if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, reinterpret_cast<const char*>(data), (int)size, out.data(), needed) != needed) throw 1;
  return out;
}

class Reader {
 public:
  Reader(const uint8_t* data, size_t size) : data_(data), size_(size) {}
  uint8_t u8() { require(1); return data_[offset_++]; }
  uint32_t u32() { require(4); uint32_t v = (uint32_t)data_[offset_] | ((uint32_t)data_[offset_+1] << 8) | ((uint32_t)data_[offset_+2] << 16) | ((uint32_t)data_[offset_+3] << 24); offset_ += 4; return v; }
  int32_t i32() { return (int32_t)u32(); }
  double f64() { require(8); double v; std::memcpy(&v, data_ + offset_, 8); offset_ += 8; if (!std::isfinite(v)) throw 1; return v; }
  std::wstring text() { const uint32_t n = u32(); require(n); std::wstring v = Utf8ToWide(data_ + offset_, n); offset_ += n; return v; }
  bool done() const { return offset_ == size_; }
 private:
  void require(size_t n) { if (n > size_ - offset_) throw 1; }
  const uint8_t* data_ = nullptr;
  size_t size_ = 0;
  size_t offset_ = 0;
};

static bool ReadSelfPayload(std::vector<uint8_t>& payload) {
  wchar_t path[MAX_PATH];
  const DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH);
  if (!n || n >= MAX_PATH) return false;
  HANDLE file = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER size{};
  if (!GetFileSizeEx(file, &size) || size.QuadPart < 20) { CloseHandle(file); return false; }
  LARGE_INTEGER footerPos{}; footerPos.QuadPart = size.QuadPart - 20;
  if (!SetFilePointerEx(file, footerPos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  uint8_t footer[20]{}; DWORD got = 0;
  if (!ReadFile(file, footer, 20, &got, nullptr) || got != 20) { CloseHandle(file); return false; }
  if (std::memcmp(footer, PATCH_MAGIC, 8) != 0) { CloseHandle(file); return false; }
  auto le32 = [](const uint8_t* p) -> uint32_t { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); };
  const uint32_t version = le32(footer + 8);
  const uint32_t length = le32(footer + 12);
  const uint32_t expectedCrc = le32(footer + 16);
  if (version != PATCH_PAYLOAD_VERSION || !length || length > (uint64_t)(size.QuadPart - 20)) { CloseHandle(file); return false; }
  LARGE_INTEGER payloadPos{}; payloadPos.QuadPart = size.QuadPart - 20 - length;
  if (!SetFilePointerEx(file, payloadPos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  payload.resize(length);
  got = 0;
  const BOOL ok = ReadFile(file, payload.data(), length, &got, nullptr);
  CloseHandle(file);
  if (!ok || got != length) return false;
  return Crc32(payload.data(), payload.size()) == expectedCrc;
}

static void ReadTypedValue(Reader& r, uint8_t type, double& number, std::wstring& text, bool& boolean) {
  if (type == ST_NUMBER) number = r.f64();
  else if (type == ST_TEXT) text = r.text();
  else if (type == ST_BOOLEAN) boolean = r.u8() != 0;
  else throw 1;
}

static bool ParsePayload(const std::vector<uint8_t>& bytes) {
  try {
    Reader r(bytes.data(), bytes.size());
    const uint32_t stateCount = r.u32();
    if (stateCount > 10000) return false;
    gStates.reserve(stateCount);
    for (uint32_t i = 0; i < stateCount; ++i) {
      State state; state.name = r.text(); state.type = r.u8();
      ReadTypedValue(r, state.type, state.number, state.text, state.boolean);
      if (state.name.empty() || gStateByName.count(state.name)) return false;
      gStateByName[state.name] = (int)gStates.size(); gStates.push_back(std::move(state));
    }

    const uint32_t formCount = r.u32();
    if (!formCount || formCount > 1024) return false;
    gForms.reserve(formCount);
    int nextCommand = 1000;
    for (uint32_t f = 0; f < formCount; ++f) {
      Form form; form.id = r.text(); form.title = r.text(); form.width = (int)r.u32(); form.height = (int)r.u32(); form.visible = r.u8() != 0;
      if (form.id.empty() || gFormById.count(form.id) || form.width <= 0 || form.height <= 0 || form.width > 10000 || form.height > 10000) return false;
      gFormById[form.id] = (int)gForms.size();
      const uint32_t controlCount = r.u32();
      if (controlCount > 10000) return false;
      const int formIndex = (int)gForms.size();
      for (uint32_t c = 0; c < controlCount; ++c) {
        Control control; control.kind = r.u8(); control.id = r.text(); control.text = r.text(); control.binding = r.text();
        control.x = r.i32(); control.y = r.i32(); control.width = r.i32(); control.height = r.i32(); control.formIndex = formIndex; control.commandId = nextCommand++;
        if (control.kind < CK_TEXT || control.kind > CK_CHECKBOX || control.width <= 0 || control.height <= 0 || control.width > 10000 || control.height > 10000) return false;
        if (!control.id.empty()) { if (gControlById.count(control.id)) return false; gControlById[control.id] = (int)gControls.size(); }
        form.controls.push_back((int)gControls.size()); gControls.push_back(std::move(control));
      }
      gForms.push_back(std::move(form));
    }

    const uint32_t eventCount = r.u32();
    if (eventCount > 10000) return false;
    gEvents.reserve(eventCount);
    for (uint32_t e = 0; e < eventCount; ++e) {
      Event event; event.control = r.text(); event.kind = r.u8(); event.valueType = r.u8();
      if (!gControlById.count(event.control) || (event.kind != EV_CLICKED && event.kind != EV_CHANGED) || event.valueType > 2) return false;
      const uint32_t actionCount = r.u32(); if (actionCount > 10000) return false;
      for (uint32_t a = 0; a < actionCount; ++a) {
        Action action; action.kind = r.u8();
        if (action.kind == ACT_OPEN || action.kind == ACT_CLOSE) {
          action.form = r.text(); if (!gFormById.count(action.form)) return false;
        } else if (action.kind == ACT_CHANGE) {
          action.target = r.text(); action.stateType = r.u8();
          auto stateIt = gStateByName.find(action.target); if (stateIt == gStateByName.end() || gStates[stateIt->second].type != action.stateType) return false;
          const uint32_t opCount = r.u32(); if (opCount > 10000) return false;
          for (uint32_t o = 0; o < opCount; ++o) {
            Operation op; op.op = r.u8(); op.valueKind = r.u8();
            if (op.op < OP_SET || op.op > OP_CLEAR || op.valueKind > VK_EVENT) return false;
            if (op.op == OP_CLEAR) { if (op.valueKind != VK_NONE) return false; }
            else if (op.valueKind == VK_LITERAL) ReadTypedValue(r, action.stateType, op.number, op.text, op.boolean);
            else if (op.valueKind != VK_EVENT) return false;
            action.ops.push_back(std::move(op));
          }
        } else return false;
        event.actions.push_back(std::move(action));
      }
      gEvents.push_back(std::move(event));
    }
    if (!r.done()) return false;

    for (const Control& control : gControls) {
      if (control.kind == CK_INPUT) {
        auto it = gStateByName.find(control.binding); if (it == gStateByName.end() || gStates[it->second].type != ST_TEXT) return false;
      } else if (control.kind == CK_CHECKBOX) {
        auto it = gStateByName.find(control.binding); if (it == gStateByName.end() || gStates[it->second].type != ST_BOOLEAN) return false;
      }
    }
    return true;
  } catch (...) { return false; }
}

static std::wstring PatchNumber(double value) {
  if (std::floor(value) == value) return std::to_wstring((long long)value);
  std::wostringstream out; out << value; return out.str();
}
static std::wstring StateText(const State& state) {
  if (state.type == ST_NUMBER) return PatchNumber(state.number);
  if (state.type == ST_BOOLEAN) return state.boolean ? L"true" : L"false";
  return state.text;
}
static std::wstring RenderText(const std::wstring& source) {
  std::wstring out;
  size_t pos = 0;
  while (pos < source.size()) {
    const size_t open = source.find(L'{', pos);
    if (open == std::wstring::npos) { out.append(source, pos, std::wstring::npos); break; }
    out.append(source, pos, open - pos);
    const size_t close = source.find(L'}', open + 1);
    if (close == std::wstring::npos) { out.append(source, open, std::wstring::npos); break; }
    const std::wstring name = source.substr(open + 1, close - open - 1);
    auto it = gStateByName.find(name);
    if (it == gStateByName.end()) { out.append(source, open, close - open + 1); }
    else out += StateText(gStates[it->second]);
    pos = close + 1;
  }
  return out;
}
static std::wstring WindowText(HWND hwnd) {
  const int len = GetWindowTextLengthW(hwnd); if (len <= 0) return L"";
  std::wstring value((size_t)len + 1, L'\0'); const int copied = GetWindowTextW(hwnd, value.data(), len + 1); value.resize(copied > 0 ? (size_t)copied : 0); return value;
}
static void SetWindowTextIfDifferent(HWND hwnd, const std::wstring& value) { if (WindowText(hwnd) != value) SetWindowTextW(hwnd, value.c_str()); }
static void RefreshUI();

static void ApplyOperation(State& state, const Operation& op, bool eventBool, const std::wstring& eventText) {
  if (op.op == OP_CLEAR) {
    if (state.type == ST_NUMBER) state.number = 0.0; else if (state.type == ST_TEXT) state.text.clear(); else state.boolean = false; return;
  }
  const bool fromEvent = op.valueKind == VK_EVENT;
  if (state.type == ST_NUMBER) {
    const double value = op.number;
    if (op.op == OP_SET) state.number = value; else if (op.op == OP_ADD) state.number += value; else if (op.op == OP_REMOVE) state.number -= value;
  } else if (state.type == ST_TEXT) {
    const std::wstring& value = fromEvent ? eventText : op.text;
    if (op.op == OP_SET) state.text = value; else if (op.op == OP_ADD) state.text += value;
  } else if (state.type == ST_BOOLEAN && op.op == OP_SET) state.boolean = fromEvent ? eventBool : op.boolean;
}

static void ExecuteEvent(const Event& event, bool eventBool, const std::wstring& eventText) {
  for (const Action& action : event.actions) {
    if (action.kind == ACT_OPEN) { ShowWindow(gForms[gFormById[action.form]].hwnd, SW_SHOW); UpdateWindow(gForms[gFormById[action.form]].hwnd); }
    else if (action.kind == ACT_CLOSE) ShowWindow(gForms[gFormById[action.form]].hwnd, SW_HIDE);
    else if (action.kind == ACT_CHANGE) {
      State& state = gStates[gStateByName[action.target]];
      for (const Operation& op : action.ops) ApplyOperation(state, op, eventBool, eventText);
    }
  }
  RefreshUI();
}

static void DispatchControl(int commandId, int notification, HWND controlHwnd) {
  if (gRefreshing) return;
  Control* control = nullptr;
  for (Control& candidate : gControls) if (candidate.commandId == commandId) { control = &candidate; break; }
  if (!control) return;
  const bool fired = (control->kind == CK_BUTTON || control->kind == CK_CHECKBOX) ? notification == BN_CLICKED : control->kind == CK_INPUT ? notification == EN_CHANGE : false;
  if (!fired) return;
  for (const Event& event : gEvents) {
    if (event.control != control->id) continue;
    bool eventBool = false; std::wstring eventText;
    if (event.valueType == 1) eventBool = SendMessageW(controlHwnd, BM_GETCHECK, 0, 0) == BST_CHECKED;
    else if (event.valueType == 2) eventText = WindowText(controlHwnd);
    ExecuteEvent(event, eventBool, eventText);
  }
}

static void RefreshUI() {
  gRefreshing = true;
  for (Control& control : gControls) {
    if (!control.hwnd) continue;
    if (control.kind == CK_TEXT || control.kind == CK_BUTTON) SetWindowTextIfDifferent(control.hwnd, RenderText(control.text));
    else if (control.kind == CK_INPUT) SetWindowTextIfDifferent(control.hwnd, gStates[gStateByName[control.binding]].text);
    else if (control.kind == CK_CHECKBOX) {
      SetWindowTextIfDifferent(control.hwnd, RenderText(control.text));
      SendMessageW(control.hwnd, BM_SETCHECK, gStates[gStateByName[control.binding]].boolean ? BST_CHECKED : BST_UNCHECKED, 0);
    }
  }
  gRefreshing = false;
}

static LRESULT CALLBACK PatchWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  int form = (int)(INT_PTR)GetWindowLongPtrW(hwnd, GWLP_USERDATA);
  if (msg == WM_NCCREATE) { auto* create = reinterpret_cast<CREATESTRUCTW*>(lParam); form = (int)(INT_PTR)create->lpCreateParams; SetWindowLongPtrW(hwnd, GWLP_USERDATA, (LONG_PTR)form); }
  switch (msg) {
    case WM_COMMAND: DispatchControl(LOWORD(wParam), HIWORD(wParam), reinterpret_cast<HWND>(lParam)); return 0;
    case WM_CLOSE: if (form == 0) DestroyWindow(hwnd); else ShowWindow(hwnd, SW_HIDE); return 0;
    case WM_DESTROY: if (form == 0) PostQuitMessage(0); return 0;
  }
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static HWND CreateControlWindow(Control& control, HWND parent) {
  DWORD style = WS_CHILD | WS_VISIBLE;
  const wchar_t* klass = L"STATIC";
  if (control.kind == CK_BUTTON) { klass = L"BUTTON"; style |= WS_TABSTOP | BS_PUSHBUTTON; }
  else if (control.kind == CK_INPUT) { klass = L"EDIT"; style |= WS_TABSTOP | WS_BORDER | ES_AUTOHSCROLL; }
  else if (control.kind == CK_CHECKBOX) { klass = L"BUTTON"; style |= WS_TABSTOP | BS_AUTOCHECKBOX; }
  else style |= SS_LEFT;
  HWND hwnd = CreateWindowExW(0, klass, L"", style, control.x, control.y, control.width, control.height, parent, (HMENU)(INT_PTR)control.commandId, gInstance, nullptr);
  if (hwnd && gGuiFont) SendMessageW(hwnd, WM_SETFONT, (WPARAM)gGuiFont, TRUE);
  control.hwnd = hwnd; return hwnd;
}

static HWND CreateForm(int index) {
  Form& form = gForms[index]; RECT rect{0,0,form.width,form.height}; AdjustWindowRect(&rect, WS_OVERLAPPEDWINDOW, FALSE);
  HWND hwnd = CreateWindowExW(0, PATCH_WINDOW_CLASS, form.title.c_str(), WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, CW_USEDEFAULT, rect.right-rect.left, rect.bottom-rect.top, nullptr, nullptr, gInstance, reinterpret_cast<void*>((INT_PTR)index));
  if (!hwnd) return nullptr; form.hwnd = hwnd;
  for (int controlIndex : form.controls) if (!CreateControlWindow(gControls[controlIndex], hwnd)) return nullptr;
  return hwnd;
}

static bool HasArg(const wchar_t* value) { return std::wcsstr(GetCommandLineW(), value) != nullptr; }
static bool Click(const wchar_t* id) {
  auto it = gControlById.find(id); if (it == gControlById.end()) return false; Control& c = gControls[it->second]; SendMessageW(c.hwnd, BM_CLICK, 0, 0); return true;
}
static int RunSmoke() {
  auto mainIt = gFormById.find(L"main"), settingsIt = gFormById.find(L"settings");
  if (mainIt != gFormById.end() && !IsWindowVisible(gForms[mainIt->second].hwnd)) ShowWindow(gForms[mainIt->second].hwnd, SW_SHOW);
  if (settingsIt != gFormById.end() && IsWindowVisible(gForms[settingsIt->second].hwnd)) return 70;
  if (gControlById.count(L"open_settings") && settingsIt != gFormById.end()) { if (!Click(L"open_settings") || !IsWindowVisible(gForms[settingsIt->second].hwnd)) return 71; }
  if (gControlById.count(L"notifications")) { if (!Click(L"notifications")) return 72; auto s = gStateByName.find(L"notifications"); if (s != gStateByName.end() && !gStates[s->second].boolean) return 73; }
  if (gControlById.count(L"close_settings") && settingsIt != gFormById.end()) { if (!Click(L"close_settings") || IsWindowVisible(gForms[settingsIt->second].hwnd)) return 74; }
  return 0;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  std::vector<uint8_t> payload; if (!ReadSelfPayload(payload)) { MessageBoxW(nullptr, L"This Patch native runtime has no valid sealed application payload.", L"Patch", MB_OK | MB_ICONERROR); return 20; }
  if (!ParsePayload(payload)) { MessageBoxW(nullptr, L"The sealed Patch application payload is invalid or unsupported.", L"Patch", MB_OK | MB_ICONERROR); return 21; }
  gInstance = instance; gGuiFont = (HFONT)GetStockObject(DEFAULT_GUI_FONT);
  WNDCLASSEXW wc{}; wc.cbSize = sizeof(wc); wc.hInstance = instance; wc.lpfnWndProc = PatchWndProc; wc.lpszClassName = PATCH_WINDOW_CLASS; wc.hCursor = LoadCursor(nullptr, IDC_ARROW); wc.hIcon = LoadIcon(nullptr, IDI_APPLICATION); wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  if (!RegisterClassExW(&wc)) return 22;
  for (int i = 0; i < (int)gForms.size(); ++i) if (!CreateForm(i)) return 30 + i;
  RefreshUI();
  for (Form& form : gForms) if (form.visible) ShowWindow(form.hwnd, showCommand == 0 ? SW_SHOWNORMAL : showCommand);
  if (!gForms.empty()) UpdateWindow(gForms[0].hwnd);
  if (HasArg(L"--patch-smoke")) return RunSmoke();
  MSG msg{}; while (GetMessageW(&msg, nullptr, 0, 0) > 0) { TranslateMessage(&msg); DispatchMessageW(&msg); }
  return (int)msg.wParam;
}
