// Patch sealed AppKit GUI runtime v1.3.
// Payload v12 adds TreeView hierarchy over frozen payload-v11/runtime-v1.2.
#import <Cocoa/Cocoa.h>
#include <algorithm>
#include <fstream>
#include <vector>

#define PATCH_RUNTIME_V13_RESTORE_MAIN PatchRuntimeV12CompatibilityMain
#include "appkit-sealed-gui-v12.mm"
#undef main
#undef PATCH_RUNTIME_V13_RESTORE_MAIN
#include "sealed-tree-v13.hpp"

static std::vector<PatchTreeV13> gPatchTreesV13;
static NSMutableArray* gPatchTreeRootsV13[10000] = {};
static NSMutableArray* gPatchTreeItemsV13[10000] = {};
static NSOutlineView* gPatchTreeViewsV13[10000] = {};
static NSScrollView* gPatchTreeScrollsV13[10000] = {};
static NSInteger gPatchTreeSelectionCountV13 = 0;

static bool ReadSelfPayloadV13(std::vector<uint8_t>& payload){
  std::string path;if(!SelfPath(path))return false;std::ifstream file(path,std::ios::binary|std::ios::ate);if(!file)return false;
  std::streamoff size=file.tellg();if(size<20)return false;file.seekg(size-20);uint8_t footer[20]{};file.read(reinterpret_cast<char*>(footer),20);
  if(!file||memcmp(footer,PATCH_MAGIC,8)!=0)return false;auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);if(version!=12||!length||(uint64_t)length>(uint64_t)(size-20))return false;
  file.seekg(size-20-(std::streamoff)length);payload.resize(length);file.read(reinterpret_cast<char*>(payload.data()),(std::streamsize)length);return file&&Crc32(payload.data(),payload.size())==crc;
}

static bool PatchResolveTreesV13(){
  for(const auto& tree:gPatchTreesV13){if(tree.nativeIndex<0||tree.nativeIndex>=(int)gControls.size())return false;auto it=gControlById.find(tree.id);if(it==gControlById.end()||it->second!=tree.nativeIndex)return false;auto& c=gControls[(size_t)tree.nativeIndex];if(c.kind!=CK_LISTBOX||!PatchFindListBoxV11(gPatchListBoxesV11,tree.id)||c.options.size()<tree.nodes.size())return false;}return true;
}
static NSString* PatchTreeTextV13(const PatchTreeNodeV13& node){return NS(RenderText(node.text));}

@interface PatchTreeTargetV13 : NSObject <NSOutlineViewDataSource,NSOutlineViewDelegate>
@end
static PatchTreeTargetV13* gPatchTreeTargetV13=nil;

static NSArray* PatchTreeRootsForIndexV13(NSInteger nativeIndex){return nativeIndex>=0&&nativeIndex<10000&&gPatchTreeRootsV13[nativeIndex]?gPatchTreeRootsV13[nativeIndex]:@[];}
static const PatchTreeV13* PatchTreeMetaForIndexV13(int nativeIndex){return PatchTreeForNativeIndexV13(gPatchTreesV13,nativeIndex);}

static void PatchRefreshTreesV13(){
  bool previous=gRefreshing;gRefreshing=true;
  for(const auto& tree:gPatchTreesV13){const int index=tree.nativeIndex;if(index<0||index>=10000)continue;auto& c=gControls[(size_t)index];NSTableView* shadow=(NSTableView*)c.widget;NSScrollView* shadowScroll=shadow?[shadow enclosingScrollView]:nil;NSOutlineView* outline=gPatchTreeViewsV13[index];NSScrollView* scroll=gPatchTreeScrollsV13[index];if(!outline||!scroll)continue;
    for(size_t nodeIndex=0;nodeIndex<tree.nodes.size();++nodeIndex){NSString* text=PatchTreeTextV13(tree.nodes[nodeIndex]);c.options[nodeIndex]=UTF8(text);if(gPatchTreeItemsV13[index]&&nodeIndex<(size_t)gPatchTreeItemsV13[index].count)[[gPatchTreeItemsV13[index] objectAtIndex:(NSUInteger)nodeIndex]setObject:text forKey:@"text"];}
    if(shadowScroll)scroll.frame=shadowScroll.frame;[outline reloadData];[outline expandItem:nil expandChildren:YES];if(shadowScroll)shadowScroll.hidden=YES;scroll.hidden=NO;
  }gRefreshing=previous;
}

static bool PatchDispatchTreeSelectionV13(int nativeIndex,id item){
  const auto* tree=PatchTreeMetaForIndexV13(nativeIndex);if(!tree||!item)return false;NSNumber* flat=[item objectForKey:@"flat"];if(!flat)return false;int nodeIndex=(int)flat.integerValue;auto path=PatchTreePathIndicesV13(*tree,nodeIndex);if(path.empty())return false;auto& c=gControls[(size_t)nativeIndex];NSTableView* shadow=(NSTableView*)c.widget;if(!shadow)return false;PatchRefreshTreesV13();NSMutableIndexSet* indexes=[NSMutableIndexSet indexSet];for(int value:path)[indexes addIndex:(NSUInteger)value];bool previous=gRefreshing;gRefreshing=true;[shadow selectRowIndexes:indexes byExtendingSelection:NO];gRefreshing=previous;++gPatchTreeSelectionCountV13;PatchDispatchControlV11(nativeIndex,EV_CHANGED,shadow);PatchRefreshMenusV12();PatchRefreshTreesV13();return true;
}

@implementation PatchTreeTargetV13
- (NSInteger)outlineView:(NSOutlineView*)outline numberOfChildrenOfItem:(id)item{NSArray* children=item?[item objectForKey:@"children"]:PatchTreeRootsForIndexV13(outline.tag-1000);return children?(NSInteger)children.count:0;}
- (id)outlineView:(NSOutlineView*)outline child:(NSInteger)index ofItem:(id)item{NSArray* children=item?[item objectForKey:@"children"]:PatchTreeRootsForIndexV13(outline.tag-1000);return index>=0&&index<(NSInteger)children.count?[children objectAtIndex:(NSUInteger)index]:nil;}
- (BOOL)outlineView:(NSOutlineView*)outline isItemExpandable:(id)item{(void)outline;return [[item objectForKey:@"children"]count]>0;}
- (NSView*)outlineView:(NSOutlineView*)outline viewForTableColumn:(NSTableColumn*)column item:(id)item{(void)outline;(void)column;NSTextField* label=[NSTextField labelWithString:[item objectForKey:@"text"]?:@""];label.lineBreakMode=NSLineBreakByTruncatingTail;return label;}
- (void)outlineViewSelectionDidChange:(NSNotification*)notification{if(gRefreshing)return;NSOutlineView* outline=(NSOutlineView*)notification.object;if(!outline)return;NSInteger row=outline.selectedRow;if(row<0)return;PatchDispatchTreeSelectionV13((int)(outline.tag-1000),[outline itemAtRow:row]);}
@end

static bool PatchInstallTreesV13(){
  gPatchTreeTargetV13=[PatchTreeTargetV13 new];
  for(const auto& tree:gPatchTreesV13){const int index=tree.nativeIndex;if(index<0||index>=10000)return false;auto& c=gControls[(size_t)index];NSTableView* shadow=(NSTableView*)c.widget;NSScrollView* oldScroll=shadow?[shadow enclosingScrollView]:nil;if(!oldScroll||!oldScroll.superview)return false;
    NSMutableArray* roots=[NSMutableArray array];NSMutableArray* items=[NSMutableArray arrayWithCapacity:tree.nodes.size()];
    for(size_t nodeIndex=0;nodeIndex<tree.nodes.size();++nodeIndex){const auto& node=tree.nodes[nodeIndex];NSMutableDictionary* model=[@{@"text":PatchTreeTextV13(node),@"children":[NSMutableArray array],@"flat":@((NSInteger)nodeIndex)}mutableCopy];[items addObject:model];if(node.parent<0)[roots addObject:model];else [[[items objectAtIndex:(NSUInteger)node.parent]objectForKey:@"children"]addObject:model];c.options[nodeIndex]=UTF8([model objectForKey:@"text"]);}
    NSScrollView* scroll=[[NSScrollView alloc]initWithFrame:oldScroll.frame];scroll.hasVerticalScroller=YES;scroll.autohidesScrollers=YES;scroll.borderType=NSBezelBorder;NSOutlineView* outline=[[NSOutlineView alloc]initWithFrame:scroll.bounds];NSTableColumn* column=[[NSTableColumn alloc]initWithIdentifier:@"tree"];column.width=std::max<CGFloat>(40,scroll.bounds.size.width);[outline addTableColumn:column];outline.outlineTableColumn=column;outline.headerView=nil;outline.tag=1000+index;outline.dataSource=gPatchTreeTargetV13;outline.delegate=gPatchTreeTargetV13;outline.allowsMultipleSelection=NO;outline.allowsEmptySelection=YES;scroll.documentView=outline;[oldScroll.superview addSubview:scroll positioned:NSWindowAbove relativeTo:oldScroll];oldScroll.hidden=YES;
    [outline setAccessibilityLabel:NS(PatchControlNameV09(c))];gPatchTreeRootsV13[index]=roots;gPatchTreeItemsV13[index]=items;gPatchTreeViewsV13[index]=outline;gPatchTreeScrollsV13[index]=scroll;[outline reloadData];[outline expandItem:nil expandChildren:YES];
  }return true;
}

@interface PatchEventTargetV13 : PatchEventTargetV12
@end
@implementation PatchEventTargetV13
- (void)handleControl:(id)sender{[super handleControl:sender];PatchRefreshTreesV13();}
- (void)controlTextDidChange:(NSNotification*)notification{[super controlTextDidChange:notification];PatchRefreshTreesV13();}
@end

@interface PatchTableTargetV13 : PatchTableTargetV12
@end
@implementation PatchTableTargetV13
- (void)tableViewSelectionDidChange:(NSNotification*)notification{[super tableViewSelectionDidChange:notification];PatchRefreshTreesV13();}
@end
static PatchTableTargetV13* gPatchTableTargetV13=nil;
static bool PatchUpgradeTableTargetV13(){gPatchTableTargetV13=[PatchTableTargetV13 new];gPatchTableTargetV12=gPatchTableTargetV13;gPatchTableTargetV11=gPatchTableTargetV13;for(const auto& table:gPatchTablesV10){NSTableView* view=(NSTableView*)gControls[(size_t)table.nativeIndex].widget;if(!view)return false;view.dataSource=gPatchTableTargetV13;view.delegate=gPatchTableTargetV13;}return true;}

static int RunPatchTreeSmokeV13(){int code=300;for(const auto& tree:gPatchTreesV13){const int index=tree.nativeIndex;NSOutlineView* outline=gPatchTreeViewsV13[index];if(!outline||!gPatchTreeItemsV13[index]||(size_t)gPatchTreeItemsV13[index].count!=tree.nodes.size()||(size_t)outline.numberOfRows!=tree.nodes.size())return code++;if(tree.id=="files"&&!tree.nodes.empty()){auto* selected=PatchFindListStateV11(gPatchListStatesV11,"selected");if(selected){NSInteger row=[outline rowForItem:[gPatchTreeItemsV13[index]lastObject]];if(row<0)return code++;int before=(int)gPatchTreeSelectionCountV13;if(!PatchDispatchTreeSelectionV13(index,[outline itemAtRow:row])||gPatchTreeSelectionCountV13!=before+1)return code++;auto path=PatchTreePathIndicesV13(tree,(int)tree.nodes.size()-1);std::vector<std::string> expected;for(int node:path)expected.push_back(UTF8(PatchTreeTextV13(tree.nodes[(size_t)node])));if(selected->value!=expected)return code++;}}}return 0;}

int main(int argc,const char* argv[]){
  @autoreleasepool{
    [NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];gSmokeMode=HasArg(argc,argv,"--patch-smoke");
    std::vector<uint8_t> payloadV12,payloadV11,payloadV10,payloadV9,payloadV8,payloadV7;
    if(!ReadSelfPayloadV13(payloadV12)||!PatchConvertPayloadV12ToV11(payloadV12,payloadV11,gPatchTreesV13)||!PatchConvertPayloadV11ToV10(payloadV11,payloadV10,gPatchMenuEntriesV12)||!PatchConvertPayloadV10ToV9(payloadV10,payloadV9,gPatchListStatesV11,gPatchListBoxesV11,gPatchListEventsV11)||!PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10)||!PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09)||!ParsePayload(payloadV7))return 20;
    if(gPatchLayoutPoliciesV09.size()!=gControls.size()||!PatchResolveTablesV10()||!PatchResolveListsV11()||!PatchResolveTreesV13())return 22;
    PatchSyncListShadowsV11();gEventTarget=[PatchEventTargetV13 new];gWindowDelegates=[NSMutableArray arrayWithCapacity:gForms.size()];CreateMenus();
    if(!CreateForms()||!PatchInstallTablesV10()||!PatchInstallListsV11()||!PatchUpgradeTableTargetV12()||!PatchUpgradeTableTargetV13()||!PatchInstallTreesV13()||!PatchInstallMenusV12())return 21;
    gPatchResponsiveObserverV11=[PatchResponsiveObserverV11 new];[[NSNotificationCenter defaultCenter]addObserver:gPatchResponsiveObserverV11 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];
    ApplyPatchAccessibilityV09();ApplyPatchTableAccessibilityV10();RefreshUI();PatchRefreshListsV11();PatchRefreshMenusV12();PatchRefreshTreesV13();[NSApp finishLaunching];for(auto& f:gForms)if(f.visible)[f.window makeKeyAndOrderFront:nil];
    if(gSmokeMode){int result=RunSmoke();if(!result)result=RunPatchAccessibilitySmokeV09();if(!result)result=RunPatchTableAccessibilitySmokeV10();if(!result)result=RunPatchResponsiveSmokeV10();if(!result)result=RunPatchTableSmokeV10();if(!result)result=RunPatchListSmokeV11();if(!result)result=RunPatchMenuSmokeV12();if(!result)result=RunPatchTreeSmokeV13();return result;}
    [NSApp activateIgnoringOtherApps:YES];[NSApp run];
  }return 0;
}
