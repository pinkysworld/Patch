// Patch sealed AppKit GUI runtime v1.0.
// Payload v9 adds real multi-column Table/Grid widgets while preserving the
// responsive/accessibility behavior of runtime v0.9 and payload v8.
#import <Cocoa/Cocoa.h>
#include <fstream>

#define PATCH_APPKIT_RUNTIME_V09_ENTRY PatchSealedRuntimeV09Main
#include "appkit-sealed-gui-v09.mm"
#undef PATCH_APPKIT_RUNTIME_V09_ENTRY
#include "sealed-table-v10.hpp"

static std::vector<PatchTableV10> gPatchTablesV10;
static std::vector<std::string> gPatchLastTableRowV10;
static NSInteger gPatchTableSelectionCountV10=0;

static bool ReadSelfPayloadV10(std::vector<uint8_t>& payload) {
  std::string path; if (!SelfPath(path)) return false;
  std::ifstream file(path,std::ios::binary|std::ios::ate); if (!file) return false;
  std::streamoff size=file.tellg(); if (size<20) return false;
  file.seekg(size-20); uint8_t footer[20]{}; file.read(reinterpret_cast<char*>(footer),20);
  if (!file || memcmp(footer,PATCH_MAGIC,8)!=0) return false;
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);
  if (version!=9 || !length || (uint64_t)length>(uint64_t)(size-20)) return false;
  file.seekg(size-20-(std::streamoff)length); payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()),(std::streamsize)length);
  return file && Crc32(payload.data(),payload.size())==crc;
}

static const PatchTableV10* PatchTableForIndexV10(int index) { return PatchFindTableV10(gPatchTablesV10,index); }

static bool PatchResolveTablesV10() {
  for (const auto& table:gPatchTablesV10) {
    if (table.nativeIndex<0 || table.nativeIndex>=(int)gControls.size()) return false;
    auto it=gControlById.find(table.id);
    if (it==gControlById.end() || it->second!=table.nativeIndex) return false;
    auto& c=gControls[(size_t)table.nativeIndex];
    if (c.kind!=CK_LISTBOX || c.binding!=table.shadowState) return false;
  }
  return true;
}

static void PatchDispatchTableV10(int controlIndex, NSInteger row) {
  const PatchTableV10* table=PatchTableForIndexV10(controlIndex);
  if (!table || gRefreshing || row<0 || row>=(NSInteger)table->rows.size()) return;
  gPatchLastTableRowV10=table->rows[(size_t)row];
  ++gPatchTableSelectionCountV10;
  for (const auto& event:gEvents) if (event.control==table->id && event.kind==EV_CHANGED) ExecuteEvent(event,false,{});
}

@interface PatchTableTargetV10 : NSObject <NSTableViewDataSource,NSTableViewDelegate>
@end
@implementation PatchTableTargetV10
- (NSInteger)numberOfRowsInTableView:(NSTableView*)tableView {
  NSInteger index=tableView.tag-1000;
  const PatchTableV10* table=PatchTableForIndexV10((int)index);
  return table ? (NSInteger)table->rows.size() : 0;
}
- (NSView*)tableView:(NSTableView*)tableView viewForTableColumn:(NSTableColumn*)column row:(NSInteger)row {
  NSInteger index=tableView.tag-1000;
  const PatchTableV10* table=PatchTableForIndexV10((int)index);
  if (!table || row<0 || row>=(NSInteger)table->rows.size()) return nil;
  NSInteger columnIndex=[column.identifier integerValue];
  if (columnIndex<0 || columnIndex>=(NSInteger)table->columns.size()) return nil;
  NSTextField* label=[NSTextField labelWithString:NS(table->rows[(size_t)row][(size_t)columnIndex])];
  label.lineBreakMode=NSLineBreakByTruncatingTail;
  return label;
}
- (void)tableViewSelectionDidChange:(NSNotification*)notification {
  NSTableView* table=(NSTableView*)notification.object;
  if (table) PatchDispatchTableV10((int)(table.tag-1000),table.selectedRow);
}
@end
static PatchTableTargetV10* gPatchTableTargetV10=nil;

static bool PatchInstallTableV10(const PatchTableV10& table) {
  auto& c=gControls[(size_t)table.nativeIndex];
  NSTableView* legacy=(NSTableView*)c.widget;
  NSScrollView* scroll=legacy ? [legacy enclosingScrollView] : nil;
  if (!scroll) return false;
  NSTableView* view=[[NSTableView alloc] initWithFrame:scroll.bounds];
  const CGFloat baseWidth=std::max(40,c.width/(int)std::max<size_t>(1,table.columns.size()));
  for (size_t columnIndex=0;columnIndex<table.columns.size();++columnIndex) {
    NSTableColumn* column=[[NSTableColumn alloc] initWithIdentifier:[NSString stringWithFormat:@"%zu",columnIndex]];
    column.title=NS(table.columns[columnIndex]);
    column.width=columnIndex+1==table.columns.size()?std::max<CGFloat>(40,c.width-baseWidth*(CGFloat)columnIndex):baseWidth;
    [view addTableColumn:column];
  }
  view.allowsMultipleSelection=NO;
  view.allowsEmptySelection=YES;
  view.tag=1000+table.nativeIndex;
  view.dataSource=gPatchTableTargetV10;
  view.delegate=gPatchTableTargetV10;
  scroll.documentView=view;
  c.widget=view;
  c.kind=9;
  return true;
}

static bool PatchInstallTablesV10() {
  gPatchTableTargetV10=[PatchTableTargetV10 new];
  for (const auto& table:gPatchTablesV10) if (!PatchInstallTableV10(table)) return false;
  return true;
}

static void ApplyPatchTableAccessibilityV10() {
  for (const auto& table:gPatchTablesV10) {
    auto& c=gControls[(size_t)table.nativeIndex];
    if (c.widget) [c.widget setAccessibilityLabel:NS(PatchControlNameV09(c))];
  }
}

static int RunPatchTableAccessibilitySmokeV10() {
  int code=210;
  for (const auto& table:gPatchTablesV10) {
    auto& c=gControls[(size_t)table.nativeIndex];
    if (!c.widget || ![[c.widget accessibilityLabel] isEqualToString:NS(PatchControlNameV09(c))]) return code++;
  }
  return 0;
}

static void MovePatchControlV10(int index,int x,int y,int width,int height,int formHeight) {
  if (index<0 || index>=(int)gControls.size()) return;
  auto& c=gControls[(size_t)index];
  if (c.kind!=9) { MovePatchControlV09(index,x,y,width,height,formHeight); return; }
  NSTableView* table=(NSTableView*)c.widget;
  NSScrollView* scroll=table ? [table enclosingScrollView] : nil;
  if (!scroll) return;
  const int nativeY=std::max(0,formHeight-y-height);
  scroll.frame=NSMakeRect(x,nativeY,width,height);
  table.frame=NSMakeRect(0,0,width,height);
  const NSInteger count=[table numberOfColumns];
  if (count>0) {
    const CGFloat columnWidth=std::max<CGFloat>(40,width/(CGFloat)count);
    for (NSInteger column=0;column<count;++column) {
      NSTableColumn* item=[[table tableColumns] objectAtIndex:(NSUInteger)column];
      item.width=column+1==count?std::max<CGFloat>(40,width-columnWidth*(CGFloat)column):columnWidth;
    }
  }
}

static void ApplyPatchResponsiveLayoutV10(int formIndex,int formWidth,int formHeight) {
  if (formIndex<0 || formIndex>=(int)gForms.size() || formWidth<=0 || formHeight<=0 || gPatchLayoutPoliciesV09.size()!=gControls.size()) return;
  const auto& form=gForms[(size_t)formIndex];
  for (int index=0;index<(int)gControls.size();++index) {
    auto& c=gControls[(size_t)index];
    if (c.formIndex!=formIndex || c.parentTabIndex>=0 || !PatchPolicyResponsiveV09(gPatchLayoutPoliciesV09[(size_t)index])) continue;
    int x=c.x,y=c.y,width=c.width,height=c.height;
    PatchApplyLayoutPolicyV09(gPatchLayoutPoliciesV09[(size_t)index],form.width,form.height,formWidth,formHeight,x,y,width,height);
    MovePatchControlV10(index,x,y,width,height,formHeight);
  }
}

@interface PatchResponsiveObserverV10 : NSObject
- (void)windowDidResize:(NSNotification*)notification;
@end
@implementation PatchResponsiveObserverV10
- (void)windowDidResize:(NSNotification*)notification {
  NSWindow* window=(NSWindow*)notification.object;
  for (size_t index=0;index<gForms.size();++index) if (gForms[index].window==window) {
    const NSSize size=window.contentView.bounds.size;
    ApplyPatchResponsiveLayoutV10((int)index,(int)llround(size.width),(int)llround(size.height));
    break;
  }
}
@end
static PatchResponsiveObserverV10* gPatchResponsiveObserverV10=nil;

static int RunPatchResponsiveSmokeV10() {
  if (gPatchLayoutPoliciesV09.size()!=gControls.size()) return 180;
  for (int index=0;index<(int)gControls.size();++index) {
    auto& c=gControls[(size_t)index]; const auto policy=gPatchLayoutPoliciesV09[(size_t)index];
    if (c.parentTabIndex>=0 || !PatchPolicyResponsiveV09(policy)) continue;
    const auto& form=gForms[(size_t)c.formIndex];
    int x=c.x,y=c.y,width=c.width,height=c.height;
    PatchApplyLayoutPolicyV09(policy,form.width,form.height,form.width+80,form.height+60,x,y,width,height);
    ApplyPatchResponsiveLayoutV10(c.formIndex,form.width+80,form.height+60);
    if (c.kind==CK_RADIO) return 0;
    NSView* measured=(c.kind==CK_LISTBOX || c.kind==9)?[(NSTableView*)c.widget enclosingScrollView]:c.widget;
    if (!measured) return 181;
    NSRect frame=measured.frame;
    if ((int)llround(frame.origin.x)!=x || (int)llround(frame.size.width)!=width || (int)llround(frame.size.height)!=height) return 182;
    return 0;
  }
  return 0;
}

static int RunPatchTableSmokeV10() {
  int code=220;
  for (const auto& table:gPatchTablesV10) {
    auto& c=gControls[(size_t)table.nativeIndex];
    NSTableView* view=(NSTableView*)c.widget;
    if (!view || c.kind!=9) return code++;
    if ([view numberOfColumns]!=(NSInteger)table.columns.size() || [view numberOfRows]!=(NSInteger)table.rows.size()) return code++;
    if (table.rows.empty()) return code++;
    const NSInteger row=(NSInteger)table.rows.size()-1;
    const NSInteger before=gPatchTableSelectionCountV10;
    [view selectRowIndexes:[NSIndexSet indexSetWithIndex:(NSUInteger)row] byExtendingSelection:NO];
    [gPatchTableTargetV10 tableViewSelectionDidChange:[NSNotification notificationWithName:NSTableViewSelectionDidChangeNotification object:view]];
    if (gPatchTableSelectionCountV10<=before) return code++;
    if (gPatchLastTableRowV10!=table.rows[(size_t)row]) return code++;
    auto status=gStateByName.find("status");
    if (status!=gStateByName.end() && gStates[(size_t)status->second].text!="selected") return code++;
  }
  return 0;
}

int main(int argc,const char* argv[]) {
  @autoreleasepool {
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode=HasArg(argc,argv,"--patch-smoke");
    std::vector<uint8_t> payloadV9,payloadV8,payloadV7;
    if (!ReadSelfPayloadV10(payloadV9) || !PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10) ||
        !PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09) || !ParsePayload(payloadV7)) return 20;
    if (gPatchLayoutPoliciesV09.size()!=gControls.size() || !PatchResolveTablesV10()) return 22;
    gEventTarget=[PatchEventTarget new];
    gWindowDelegates=[NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if (!CreateForms() || !PatchInstallTablesV10()) return 21;
    gPatchResponsiveObserverV10=[PatchResponsiveObserverV10 new];
    [[NSNotificationCenter defaultCenter] addObserver:gPatchResponsiveObserverV10 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    ApplyPatchAccessibilityV09(); ApplyPatchTableAccessibilityV10();
    RefreshUI(); [NSApp finishLaunching];
    for (auto& f:gForms) if (f.visible) [f.window makeKeyAndOrderFront:nil];
    if (gSmokeMode) {
      int result=RunSmoke();
      if (!result) result=RunPatchAccessibilitySmokeV09();
      if (!result) result=RunPatchTableAccessibilitySmokeV10();
      if (!result) result=RunPatchResponsiveSmokeV10();
      if (!result) result=RunPatchTableSmokeV10();
      return result;
    }
    [NSApp activateIgnoringOtherApps:YES]; [NSApp run];
  }
  return 0;
}
