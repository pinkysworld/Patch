// Patch sealed Win32 GUI runtime v1.0.
// Payload v9 adds Table/Grid to the responsive/accessibility runtime-v0.9 line
// without redefining payload v8 or the stable Native GUI IR 0.7 contract.
#include <windows.h>
#include <commctrl.h>
#include <fstream>

#define wWinMain PatchSealedRuntimeV09WinMain
#include "win32-sealed-gui-v09.cpp"
#undef wWinMain
#include "sealed-table-v10.hpp"

static std::vector<PatchTableV10> gPatchTablesV10;
static std::vector<std::wstring> gPatchLastTableRowV10;
static int gPatchTableSelectionCountV10 = 0;

static std::wstring PatchWideV10(const std::string& value) {
  return Utf8ToWide(reinterpret_cast<const uint8_t*>(value.data()), value.size());
}

static bool ReadSelfPayloadV10(std::vector<uint8_t>& payload) {
  wchar_t path[MAX_PATH]; DWORD n = GetModuleFileNameW(nullptr, path, MAX_PATH);
  if (!n || n >= MAX_PATH) return false;
  HANDLE file = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER size{};
  if (!GetFileSizeEx(file, &size) || size.QuadPart < 20) { CloseHandle(file); return false; }
  LARGE_INTEGER pos{}; pos.QuadPart = size.QuadPart - 20;
  if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  uint8_t footer[20]{}; DWORD got = 0;
  if (!ReadFile(file, footer, 20, &got, nullptr) || got != 20 || memcmp(footer, PATCH_MAGIC, 8) != 0) { CloseHandle(file); return false; }
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8), length=le32(footer+12), crc=le32(footer+16);
  if (version != 9 || !length || (uint64_t)length > (uint64_t)(size.QuadPart - 20)) { CloseHandle(file); return false; }
  pos.QuadPart = size.QuadPart - 20 - length;
  if (!SetFilePointerEx(file, pos, nullptr, FILE_BEGIN)) { CloseHandle(file); return false; }
  payload.resize(length); got = 0;
  BOOL ok = ReadFile(file, payload.data(), length, &got, nullptr); CloseHandle(file);
  return ok && got == length && Crc32(payload.data(), payload.size()) == crc;
}

static bool PatchResolveTablesV10() {
  for (const auto& table : gPatchTablesV10) {
    if (table.nativeIndex < 0 || table.nativeIndex >= (int)gControls.size()) return false;
    auto it = gControlById.find(PatchWideV10(table.id));
    if (it == gControlById.end() || it->second != table.nativeIndex) return false;
    auto& c = gControls[(size_t)table.nativeIndex];
    if (c.kind != CK_LISTBOX || c.binding != PatchWideV10(table.shadowState)) return false;
  }
  return true;
}

static bool PatchInstallTableV10(const PatchTableV10& table) {
  auto& c = gControls[(size_t)table.nativeIndex];
  HWND parent = gForms[(size_t)c.formIndex].hwnd;
  int x=c.x, y=c.y;
  if (c.parentTabIndex >= 0) {
    if (c.parentTabIndex >= (int)gControls.size()) return false;
    const auto& tab = gControls[(size_t)c.parentTabIndex];
    x = tab.x + 10 + c.x;
    y = tab.y + 30 + c.y;
  }
  if (c.hwnd) DestroyWindow(c.hwnd);
  c.hwnd = CreateWindowExW(
    WS_EX_CLIENTEDGE, WC_LISTVIEWW, L"",
    WS_CHILD | WS_VISIBLE | WS_TABSTOP | LVS_REPORT | LVS_SINGLESEL | LVS_SHOWSELALWAYS,
    x, y, c.width, c.height, parent,
    reinterpret_cast<HMENU>((INT_PTR)c.commandId), gInstance, nullptr);
  if (!c.hwnd) return false;
  if (gGuiFont) SendMessageW(c.hwnd, WM_SETFONT, (WPARAM)gGuiFont, TRUE);
  ListView_SetExtendedListViewStyle(c.hwnd, LVS_EX_FULLROWSELECT | LVS_EX_GRIDLINES | LVS_EX_DOUBLEBUFFER);

  const int columnWidth = table.columns.empty() ? c.width : max(40, c.width / (int)table.columns.size());
  for (int columnIndex=0; columnIndex<(int)table.columns.size(); ++columnIndex) {
    std::wstring title = PatchWideV10(table.columns[(size_t)columnIndex]);
    LVCOLUMNW column{};
    column.mask = LVCF_TEXT | LVCF_WIDTH | LVCF_SUBITEM;
    column.cx = columnIndex + 1 == (int)table.columns.size() ? max(40, c.width - columnWidth * columnIndex) : columnWidth;
    column.iSubItem = columnIndex;
    column.pszText = title.data();
    if (ListView_InsertColumn(c.hwnd, columnIndex, &column) < 0) return false;
  }
  for (int rowIndex=0; rowIndex<(int)table.rows.size(); ++rowIndex) {
    const auto& row = table.rows[(size_t)rowIndex];
    std::wstring first = PatchWideV10(row.empty() ? std::string() : row[0]);
    LVITEMW item{}; item.mask=LVIF_TEXT; item.iItem=rowIndex; item.iSubItem=0; item.pszText=first.data();
    if (ListView_InsertItem(c.hwnd, &item) < 0) return false;
    for (int columnIndex=1; columnIndex<(int)row.size(); ++columnIndex) {
      std::wstring value = PatchWideV10(row[(size_t)columnIndex]);
      ListView_SetItemText(c.hwnd, rowIndex, columnIndex, value.data());
    }
  }
  c.kind = 9;
  return true;
}

static bool PatchInstallTablesV10() {
  for (const auto& table : gPatchTablesV10) if (!PatchInstallTableV10(table)) return false;
  RefreshTabVisibility();
  return true;
}

static void PatchDispatchTableV10(const PatchTableV10& table, int row) {
  if (gRefreshing || row < 0 || row >= (int)table.rows.size()) return;
  gPatchLastTableRowV10.clear();
  for (const auto& cell : table.rows[(size_t)row]) gPatchLastTableRowV10.push_back(PatchWideV10(cell));
  ++gPatchTableSelectionCountV10;
  const std::wstring id = PatchWideV10(table.id);
  for (const auto& event : gEvents) {
    if (event.control == id && event.kind == EV_CHANGED) ExecuteEvent(event, false, L"");
  }
}

static bool PatchHandleTableNotifyV10(NMHDR* header) {
  if (!header || header->code != LVN_ITEMCHANGED) return false;
  for (const auto& table : gPatchTablesV10) {
    auto& c = gControls[(size_t)table.nativeIndex];
    if (c.hwnd != header->hwndFrom) continue;
    auto* change = reinterpret_cast<NMLISTVIEW*>(header);
    if (change->iItem >= 0 && (change->uNewState & LVIS_SELECTED) && !(change->uOldState & LVIS_SELECTED)) {
      PatchDispatchTableV10(table, change->iItem);
    }
    return true;
  }
  return false;
}

static LRESULT CALLBACK PatchWndProcV10(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  if (msg == WM_NOTIFY && PatchHandleTableNotifyV10(reinterpret_cast<NMHDR*>(lParam))) return 0;
  return PatchWndProcV09(hwnd, msg, wParam, lParam);
}

static void ApplyPatchTableAccessibilityV10() {
  for (const auto& table : gPatchTablesV10) {
    auto& c = gControls[(size_t)table.nativeIndex];
    PatchSetAccessibleNameV09(c.hwnd, PatchControlNameV09(c));
  }
}

static int RunPatchTableAccessibilitySmokeV10() {
  int code=210;
  for (const auto& table : gPatchTablesV10) {
    const auto& c=gControls[(size_t)table.nativeIndex];
    if (!c.hwnd || PatchReadAccessibleNameV09(c.hwnd) != PatchControlNameV09(c)) return code++;
  }
  return 0;
}

static int RunPatchTableSmokeV10() {
  int code=220;
  for (const auto& table : gPatchTablesV10) {
    auto& c=gControls[(size_t)table.nativeIndex];
    if (!c.hwnd || c.kind != 9) return code++;
    if (ListView_GetItemCount(c.hwnd) != (int)table.rows.size()) return code++;
    HWND header=ListView_GetHeader(c.hwnd);
    if (!header || Header_GetItemCount(header) != (int)table.columns.size()) return code++;
    if (table.rows.empty()) return code++;
    const int row=(int)table.rows.size()-1;
    const int before=gPatchTableSelectionCountV10;
    NMLISTVIEW change{};
    change.hdr.hwndFrom=c.hwnd; change.hdr.idFrom=c.commandId; change.hdr.code=LVN_ITEMCHANGED;
    change.iItem=row; change.uOldState=0; change.uNewState=LVIS_SELECTED;
    SendMessageW(gForms[(size_t)c.formIndex].hwnd, WM_NOTIFY, c.commandId, (LPARAM)&change);
    if (gPatchTableSelectionCountV10 != before + 1) return code++;
    if (gPatchLastTableRowV10.size() != table.columns.size()) return code++;
    for (size_t i=0;i<table.columns.size();++i) if (gPatchLastTableRowV10[i] != PatchWideV10(table.rows[(size_t)row][i])) return code++;
    auto status=gStateByName.find(L"status");
    if (status != gStateByName.end() && gStates[(size_t)status->second].text != L"selected") return code++;
  }
  return 0;
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  PatchComScopeV09 patchCom;
  gInstance=instance;
  gGuiFont=(HFONT)GetStockObject(DEFAULT_GUI_FONT);
  gSmokeMode=HasArg(L"--patch-smoke");
  std::vector<uint8_t> payloadV9,payloadV8,payloadV7;
  if (!ReadSelfPayloadV10(payloadV9) || !PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10) ||
      !PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
  if (gPatchLayoutPoliciesV09.size()!=gControls.size() || !PatchResolveTablesV10()) return 24;
  INITCOMMONCONTROLSEX common{}; common.dwSize=sizeof(common); common.dwICC=ICC_TAB_CLASSES|ICC_LISTVIEW_CLASSES;
  if (!InitCommonControlsEx(&common)) return 21;
  WNDCLASSEXW wc{}; wc.cbSize=sizeof(wc); wc.hInstance=instance; wc.lpfnWndProc=PatchWndProcV10; wc.lpszClassName=PATCH_WINDOW_CLASS; wc.hCursor=LoadCursor(nullptr,IDC_ARROW); wc.hIcon=LoadIcon(nullptr,IDI_APPLICATION); wc.hbrBackground=(HBRUSH)(COLOR_WINDOW+1);
  if (!RegisterClassExW(&wc)) return 22;
  if (!CreateForms() || !PatchInstallTablesV10()) return 23;
  ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10();
  RefreshUI();
  for (auto& f:gForms) if (f.visible) ShowWindow(f.hwnd,showCommand==0?SW_SHOWNORMAL:showCommand);
  if (gSmokeMode) {
    int result=RunSmoke();
    if (!result) result=RunPatchAccessibilitySmokeV09();
    if (!result) result=RunPatchTableAccessibilitySmokeV10();
    if (!result) result=RunPatchResponsiveSmokeV09();
    if (!result) result=RunPatchTableSmokeV10();
    ClearPatchAccessibilityV09();
    return result;
  }
  MSG msg{}; while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);} ClearPatchAccessibilityV09(); return (int)msg.wParam;
}
