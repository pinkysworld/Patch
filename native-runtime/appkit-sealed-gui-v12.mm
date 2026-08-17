// Patch sealed AppKit GUI runtime v1.2.
// Payload v11 layers Menu separators, portable shortcuts and source-backed
// enabled/checked state over the proven payload-v10/runtime-v1.1 core.
#import <Cocoa/Cocoa.h>
#include <algorithm>
#include <fstream>
#include <vector>

#define main PatchRuntimeV11CompatibilityMain
#include "appkit-sealed-gui-v11.mm"
#undef main
#include "sealed-menu-v12.hpp"

static std::vector<PatchMenuEntryV12> gPatchMenuEntriesV12;

static bool ReadSelfPayloadV12(std::vector<uint8_t>& payload){
  std::string path;if(!SelfPath(path))return false;
  std::ifstream file(path,std::ios::binary|std::ios::ate);if(!file)return false;
  std::streamoff size=file.tellg();if(size<20)return false;
  file.seekg(size-20);uint8_t footer[20]{};file.read(reinterpret_cast<char*>(footer),20);
  if(!file||memcmp(footer,PATCH_MAGIC,8)!=0)return false;
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);
  if(version!=11||!length||(uint64_t)length>(uint64_t)(size-20))return false;
  file.seekg(size-20-(std::streamoff)length);payload.resize(length);
  file.read(reinterpret_cast<char*>(payload.data()),(std::streamsize)length);
  return file&&Crc32(payload.data(),payload.size())==crc;
}

static bool PatchBooleanStateV12(const std::string& name,bool fallback=true){
  if(name.empty())return fallback;
  auto it=gStateByName.find(name);if(it==gStateByName.end())return fallback;
  const auto& state=gStates[(size_t)it->second];
  return state.type==ST_BOOLEAN?state.boolean:fallback;
}

static const PatchMenuEntryV12* PatchMenuMetaForNativeItemV12(int nativeItemIndex){
  for(const auto& entry:gPatchMenuEntriesV12)if(entry.type==1&&entry.nativeItemIndex==nativeItemIndex)return &entry;
  return nullptr;
}

static NSMenu* PatchNativeMenuV12(uint32_t formIndex,uint32_t menuIndex){
  if(formIndex>=gForms.size()||menuIndex>=gForms[(size_t)formIndex].menus.size())return nil;
  const auto& menu=gForms[(size_t)formIndex].menus[(size_t)menuIndex];
  if(menu.items.empty())return nil;
  const int nativeIndex=menu.items.front();
  if(nativeIndex<0||nativeIndex>=(int)gMenuItems.size()||!gMenuItems[(size_t)nativeIndex].widget)return nil;
  return gMenuItems[(size_t)nativeIndex].widget.menu;
}

static NSString* PatchAppKitKeyEquivalentV12(const std::string& key){
  if(key.size()==1){
    char ch=key[0];if(ch>='A'&&ch<='Z')ch=(char)(ch-'A'+'a');
    return NS(std::string(1,ch));
  }
  if(key.size()>=2&&key[0]=='F'){
    int number=0;for(size_t i=1;i<key.size();++i){if(key[i]<'0'||key[i]>'9')return nil;number=number*10+(key[i]-'0');}
    if(number<1||number>12)return nil;
    unichar functionKey=(unichar)(NSF1FunctionKey+(number-1));
    return [NSString stringWithCharacters:&functionKey length:1];
  }
  return nil;
}

static NSEventModifierFlags PatchAppKitModifiersV12(const PatchMenuEntryV12& entry){
  NSEventModifierFlags flags=0;
  if(entry.modifiers&1)flags|=NSEventModifierFlagCommand;
  if(entry.modifiers&2)flags|=NSEventModifierFlagShift;
  if(entry.modifiers&4)flags|=NSEventModifierFlagOption;
  return flags;
}

static bool PatchMenuEnabledV12(int nativeItemIndex){
  const auto* meta=PatchMenuMetaForNativeItemV12(nativeItemIndex);
  return !meta||meta->enabledState.empty()||PatchBooleanStateV12(meta->enabledState,false);
}

static void PatchRefreshMenusV12(){
  const bool previous=gRefreshing;gRefreshing=true;
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type!=1||entry.nativeItemIndex<0||entry.nativeItemIndex>=(int)gMenuItems.size())continue;
    NSMenuItem* item=gMenuItems[(size_t)entry.nativeItemIndex].widget;if(!item)continue;
    if(!entry.enabledState.empty())item.enabled=PatchBooleanStateV12(entry.enabledState,false)?YES:NO;
    if(!entry.checkedState.empty())item.state=PatchBooleanStateV12(entry.checkedState,false)?NSControlStateValueOn:NSControlStateValueOff;
  }
  gRefreshing=previous;
}

static bool PatchInstallMenusV12(){
  std::vector<const PatchMenuEntryV12*> separators;
  for(const auto& entry:gPatchMenuEntriesV12)if(entry.type==2)separators.push_back(&entry);
  std::sort(separators.begin(),separators.end(),[](const auto* a,const auto* b){
    if(a->formIndex!=b->formIndex)return a->formIndex<b->formIndex;
    if(a->menuIndex!=b->menuIndex)return a->menuIndex<b->menuIndex;
    return a->entryIndex<b->entryIndex;
  });
  for(const auto* entry:separators){
    NSMenu* menu=PatchNativeMenuV12(entry->formIndex,entry->menuIndex);if(!menu)return false;
    [menu setAutoenablesItems:NO];
    if(entry->entryIndex>(uint32_t)menu.numberOfItems)return false;
    [menu insertItem:[NSMenuItem separatorItem] atIndex:(NSInteger)entry->entryIndex];
  }
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type!=1)continue;
    if(entry.nativeItemIndex<0||entry.nativeItemIndex>=(int)gMenuItems.size())return false;
    NSMenuItem* item=gMenuItems[(size_t)entry.nativeItemIndex].widget;if(!item)return false;
    NSMenu* menu=item.menu;if(menu)[menu setAutoenablesItems:NO];
    if(entry.hasShortcut){
      NSString* key=PatchAppKitKeyEquivalentV12(entry.key);if(!key)return false;
      item.keyEquivalent=key;item.keyEquivalentModifierMask=PatchAppKitModifiersV12(entry);
    }
  }
  PatchRefreshMenusV12();
  return true;
}

static void PatchDispatchMenuV12(int index){
  if(!PatchMenuEnabledV12(index))return;
  PatchDispatchMenuV11(index);
  PatchRefreshMenusV12();
}

@interface PatchEventTargetV12 : PatchEventTargetV11
@end
@implementation PatchEventTargetV12
- (void)handleControl:(id)sender{
  NSInteger tag=[sender tag];
  if(tag>=20000){PatchDispatchMenuV12((int)(tag-20000));return;}
  [super handleControl:sender];PatchRefreshMenusV12();
}
- (void)controlTextDidChange:(NSNotification*)notification{[super controlTextDidChange:notification];PatchRefreshMenusV12();}
- (void)tableViewSelectionDidChange:(NSNotification*)notification{[super tableViewSelectionDidChange:notification];PatchRefreshMenusV12();}
@end

@interface PatchTableTargetV12 : PatchTableTargetV11
@end
@implementation PatchTableTargetV12
- (void)tableViewSelectionDidChange:(NSNotification*)notification{[super tableViewSelectionDidChange:notification];PatchRefreshMenusV12();}
@end
static PatchTableTargetV12* gPatchTableTargetV12=nil;

static bool PatchUpgradeTableTargetV12(){
  gPatchTableTargetV12=[PatchTableTargetV12 new];
  gPatchTableTargetV11=gPatchTableTargetV12;
  for(const auto& table:gPatchTablesV10){
    if(table.nativeIndex<0||table.nativeIndex>=(int)gControls.size())return false;
    NSTableView* view=(NSTableView*)gControls[(size_t)table.nativeIndex].widget;if(!view)return false;
    view.dataSource=gPatchTableTargetV12;view.delegate=gPatchTableTargetV12;
  }
  return true;
}

static int RunPatchMenuSmokeV12(){
  int code=260;
  const PatchMenuEntryV12* enabledEntry=nullptr;const PatchMenuEntryV12* checkedEntry=nullptr;const PatchMenuEntryV12* separator=nullptr;
  for(const auto& entry:gPatchMenuEntriesV12){
    if(entry.type==2)separator=&entry;
    if(entry.type==1&&!entry.enabledState.empty())enabledEntry=&entry;
    if(entry.type==1&&!entry.checkedState.empty())checkedEntry=&entry;
  }
  if(!enabledEntry||!checkedEntry||!separator)return code++;
  NSMenu* menu=PatchNativeMenuV12(separator->formIndex,separator->menuIndex);if(!menu)return code++;
  if(menu.numberOfItems!=4)return code++;
  NSMenuItem* separatorItem=[menu itemAtIndex:(NSInteger)separator->entryIndex];if(!separatorItem||!separatorItem.separatorItem)return code++;
  NSMenuItem* enabledItem=gMenuItems[(size_t)enabledEntry->nativeItemIndex].widget;if(!enabledItem||enabledItem.enabled)return code++;
  PatchDispatchMenuV12(enabledEntry->nativeItemIndex);if(PatchBooleanStateV12(enabledEntry->enabledState,false))return code++;
  auto enableAction=gMenuItemById.find("enable_advanced");if(enableAction==gMenuItemById.end())return code++;
  PatchDispatchMenuV12(enableAction->second);if(!enabledItem.enabled||!PatchMenuEnabledV12(enabledEntry->nativeItemIndex))return code++;
  NSMenuItem* checkedItem=gMenuItems[(size_t)checkedEntry->nativeItemIndex].widget;if(!checkedItem||checkedItem.state!=NSControlStateValueOff)return code++;
  PatchDispatchMenuV12(checkedEntry->nativeItemIndex);if(!PatchBooleanStateV12(checkedEntry->checkedState,false)||checkedItem.state!=NSControlStateValueOn)return code++;
  if(enabledEntry->hasShortcut&&enabledItem.keyEquivalent.length==0)return code++;
  if(checkedEntry->hasShortcut&&checkedItem.keyEquivalent.length==0)return code++;
  return 0;
}

int main(int argc,const char* argv[]){
  @autoreleasepool{
    [NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];
    gSmokeMode=HasArg(argc,argv,"--patch-smoke");
    std::vector<uint8_t> payloadV11,payloadV10,payloadV9,payloadV8,payloadV7;
    if(!ReadSelfPayloadV12(payloadV11)||!PatchConvertPayloadV11ToV10(payloadV11,payloadV10,gPatchMenuEntriesV12)||!PatchConvertPayloadV10ToV9(payloadV10,payloadV9,gPatchListStatesV11,gPatchListBoxesV11,gPatchListEventsV11)||!PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10)||!PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09)||!ParsePayload(payloadV7))return 20;
    if(gPatchLayoutPoliciesV09.size()!=gControls.size()||!PatchResolveTablesV10()||!PatchResolveListsV11())return 22;
    PatchSyncListShadowsV11();gEventTarget=[PatchEventTargetV12 new];gWindowDelegates=[NSMutableArray arrayWithCapacity:gForms.size()];
    CreateMenus();
    if(!CreateForms()||!PatchInstallTablesV10()||!PatchInstallListsV11()||!PatchUpgradeTableTargetV12()||!PatchInstallMenusV12())return 21;
    gPatchResponsiveObserverV11=[PatchResponsiveObserverV11 new];
    [[NSNotificationCenter defaultCenter]addObserver:gPatchResponsiveObserverV11 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    ApplyPatchAccessibilityV09();ApplyPatchTableAccessibilityV10();RefreshUI();PatchRefreshListsV11();PatchRefreshMenusV12();[NSApp finishLaunching];
    for(auto& f:gForms)if(f.visible)[f.window makeKeyAndOrderFront:nil];
    if(gSmokeMode){int result=RunSmoke();if(!result)result=RunPatchAccessibilitySmokeV09();if(!result)result=RunPatchTableAccessibilitySmokeV10();if(!result)result=RunPatchResponsiveSmokeV10();if(!result)result=RunPatchTableSmokeV10();if(!result)result=RunPatchListSmokeV11();if(!result)result=RunPatchMenuSmokeV12();return result;}
    [NSApp activateIgnoringOtherApps:YES];[NSApp run];
  }
  return 0;
}
