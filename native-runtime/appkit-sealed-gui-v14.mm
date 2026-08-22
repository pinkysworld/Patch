// Patch sealed AppKit GUI runtime v1.4.
// Payload v13 adds native Slider metadata over frozen payload-v12/runtime-v1.3.
#define PATCH_RUNTIME_V14_RESTORE_MAIN PatchRuntimeV13CompatibilityMain
#include "appkit-sealed-gui-v13.mm"
#undef main
#undef PATCH_RUNTIME_V14_RESTORE_MAIN
#include "sealed-slider-v14.hpp"

static std::vector<PatchSliderV14> gPatchSlidersV14;
static NSSlider* gPatchSliderViewsV14[10000] = {};
static NSInteger gPatchSliderDispatchCountV14=0;

static bool ReadSelfPayloadV14(std::vector<uint8_t>& payload){std::string path;if(!SelfPath(path))return false;std::ifstream file(path,std::ios::binary|std::ios::ate);if(!file)return false;std::streamoff size=file.tellg();if(size<20)return false;file.seekg(size-20);uint8_t footer[20]{};file.read(reinterpret_cast<char*>(footer),20);if(!file||memcmp(footer,PATCH_MAGIC,8)!=0)return false;auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};const uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);if(version!=13||!length||(uint64_t)length>(uint64_t)(size-20))return false;file.seekg(size-20-(std::streamoff)length);payload.resize(length);file.read(reinterpret_cast<char*>(payload.data()),(std::streamsize)length);return file&&Crc32(payload.data(),payload.size())==crc;}

static bool PatchSliderStateValueV14(const PatchSliderV14& slider,double& value){if(slider.binding.empty()){value=slider.min;return true;}auto it=gStateByName.find(slider.binding);if(it==gStateByName.end())return false;const auto& state=gStates[(size_t)it->second];if(state.type!=ST_NUMBER||!std::isfinite(state.number))return false;value=state.number;return true;}
static double PatchSliderValueV14(const PatchSliderV14& slider,NSSlider* view){double raw=view?view.doubleValue:slider.min;double steps=std::round((raw-slider.min)/slider.step);double value=slider.min+steps*slider.step;return std::max(slider.min,std::min(slider.max,value));}
static bool PatchResolveSlidersV14(){for(const auto& slider:gPatchSlidersV14){if(slider.nativeIndex<0||slider.nativeIndex>=(int)gControls.size()||slider.nativeIndex>=10000)return false;auto it=gControlById.find(slider.id);if(it==gControlById.end()||it->second!=slider.nativeIndex)return false;const auto& c=gControls[(size_t)slider.nativeIndex];if(c.kind!=CK_INPUT)return false;double initial=0;if(!PatchSliderStateValueV14(slider,initial))return false;for(const auto& patch:slider.events){if(patch.eventIndex>=gEvents.size())return false;const auto& event=gEvents[(size_t)patch.eventIndex];if(event.control!=slider.id||event.kind!=EV_CHANGED)return false;}}return true;}

struct PatchSliderSentinelRestoreV14{Operation* op=nullptr;double value=0;};
static bool PatchExecuteSliderEventV14(const PatchSliderV14& slider,const PatchSliderEventPatchV14& patch,double value){if(patch.eventIndex>=gEvents.size())return false;Event& event=gEvents[(size_t)patch.eventIndex];std::vector<PatchSliderSentinelRestoreV14> restore;for(auto& action:event.actions)for(auto& op:action.ops)if(op.valueKind==VK_LITERAL&&action.stateType==ST_NUMBER)for(double sentinel:patch.sentinels)if(op.number==sentinel){restore.push_back({&op,op.number});op.number=value;break;}if(restore.size()!=patch.sentinels.size()){for(auto& item:restore)item.op->number=item.value;return false;}PatchExecuteEventV11(event,false,{},nullptr);for(auto& item:restore)item.op->number=item.value;++gPatchSliderDispatchCountV14;return true;}

static void PatchRefreshSlidersV14(){bool previous=gRefreshing;gRefreshing=true;for(const auto& slider:gPatchSlidersV14){const int index=slider.nativeIndex;NSSlider* view=index>=0&&index<10000?gPatchSliderViewsV14[index]:nil;if(!view)continue;auto& c=gControls[(size_t)index];NSTextField* shadow=(NSTextField*)c.widget;if(shadow)view.frame=shadow.frame;if(!slider.binding.empty()){double value=slider.min;if(PatchSliderStateValueV14(slider,value))view.doubleValue=value;}view.hidden=NO;if(shadow)shadow.hidden=YES;}gRefreshing=previous;}
static bool PatchDispatchSliderV14(const PatchSliderV14& slider,NSSlider* view){if(gRefreshing||!view)return false;double value=PatchSliderValueV14(slider,view);view.doubleValue=value;for(const auto& patch:slider.events)if(!PatchExecuteSliderEventV14(slider,patch,value))return false;PatchRefreshMenusV12();PatchRefreshTreesV13();PatchRefreshSlidersV14();return true;}

@interface PatchSliderTargetV14 : NSObject
- (void)handleSlider:(id)sender;
@end
static PatchSliderTargetV14* gPatchSliderTargetV14=nil;
@implementation PatchSliderTargetV14
- (void)handleSlider:(id)sender{if(gRefreshing||![sender isKindOfClass:[NSSlider class]])return;NSInteger index=[sender tag]-1000;const auto* slider=PatchSliderForNativeIndexV14(gPatchSlidersV14,(int)index);if(slider)PatchDispatchSliderV14(*slider,(NSSlider*)sender);}
@end

static bool PatchInstallSlidersV14(){gPatchSliderTargetV14=[PatchSliderTargetV14 new];for(const auto& slider:gPatchSlidersV14){const int index=slider.nativeIndex;auto& c=gControls[(size_t)index];NSTextField* shadow=(NSTextField*)c.widget;if(!shadow||!shadow.superview)return false;NSSlider* view=[[NSSlider alloc]initWithFrame:shadow.frame];view.minValue=slider.min;view.maxValue=slider.max;view.continuous=NO;view.tag=1000+index;view.target=gPatchSliderTargetV14;view.action=@selector(handleSlider:);double initial=slider.min;if(!PatchSliderStateValueV14(slider,initial))return false;view.doubleValue=initial;[view setAccessibilityLabel:NS(PatchControlNameV09(c))];[shadow.superview addSubview:view positioned:NSWindowAbove relativeTo:shadow];shadow.hidden=YES;gPatchSliderViewsV14[index]=view;}return true;}

@interface PatchEventTargetV14 : PatchEventTargetV13
@end
@implementation PatchEventTargetV14
- (void)handleControl:(id)sender{[super handleControl:sender];PatchRefreshSlidersV14();}
- (void)controlTextDidChange:(NSNotification*)notification{[super controlTextDidChange:notification];PatchRefreshSlidersV14();}
@end
@interface PatchTableTargetV14 : PatchTableTargetV13
@end
@implementation PatchTableTargetV14
- (void)tableViewSelectionDidChange:(NSNotification*)notification{[super tableViewSelectionDidChange:notification];PatchRefreshSlidersV14();}
@end
@interface PatchTreeTargetV14 : PatchTreeTargetV13
@end
@implementation PatchTreeTargetV14
- (void)outlineViewSelectionDidChange:(NSNotification*)notification{[super outlineViewSelectionDidChange:notification];PatchRefreshSlidersV14();}
@end
@interface PatchSliderResizeObserverV14 : NSObject
- (void)windowDidResize:(NSNotification*)notification;
@end
@implementation PatchSliderResizeObserverV14
- (void)windowDidResize:(NSNotification*)notification{(void)notification;PatchRefreshSlidersV14();}
@end
static PatchTableTargetV14* gPatchTableTargetV14=nil;static PatchTreeTargetV14* gPatchTreeTargetV14=nil;static PatchSliderResizeObserverV14* gPatchSliderResizeObserverV14=nil;
static bool PatchUpgradeTargetsV14(){gPatchTableTargetV14=[PatchTableTargetV14 new];for(const auto& table:gPatchTablesV10){NSTableView* view=(NSTableView*)gControls[(size_t)table.nativeIndex].widget;if(!view)return false;view.dataSource=gPatchTableTargetV14;view.delegate=gPatchTableTargetV14;}gPatchTreeTargetV14=[PatchTreeTargetV14 new];gPatchTreeTargetV13=gPatchTreeTargetV14;for(const auto& tree:gPatchTreesV13){NSOutlineView* outline=gPatchTreeViewsV13[tree.nativeIndex];if(!outline)return false;outline.dataSource=gPatchTreeTargetV14;outline.delegate=gPatchTreeTargetV14;}return true;}

static const std::string* PatchSliderSetTargetV14(const PatchSliderV14& slider){for(const auto& patch:slider.events){if(patch.eventIndex>=gEvents.size())continue;const auto& event=gEvents[(size_t)patch.eventIndex];for(const auto& action:event.actions)if(action.kind==ACT_CHANGE&&action.stateType==ST_NUMBER)for(const auto& op:action.ops)if(op.op==OP_SET&&op.valueKind==VK_LITERAL)for(double sentinel:patch.sentinels)if(op.number==sentinel)return &action.target;}return nullptr;}
static int RunPatchSliderSmokeV14(){int code=340;for(const auto& slider:gPatchSlidersV14){NSSlider* view=gPatchSliderViewsV14[slider.nativeIndex];if(!view||std::fabs(view.minValue-slider.min)>1e-9||std::fabs(view.maxValue-slider.max)>1e-9)return code++;if(!slider.events.empty()){NSInteger before=gPatchSliderDispatchCountV14;view.doubleValue=slider.max;if(!PatchDispatchSliderV14(slider,view)||gPatchSliderDispatchCountV14<=before)return code++;if(const auto* target=PatchSliderSetTargetV14(slider)){auto it=gStateByName.find(*target);if(it==gStateByName.end()||gStates[(size_t)it->second].type!=ST_NUMBER||std::fabs(gStates[(size_t)it->second].number-PatchSliderValueV14(slider,view))>1e-9)return code++;}}}return 0;}

int main(int argc,const char* argv[]){@autoreleasepool{[NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];gSmokeMode=HasArg(argc,argv,"--patch-smoke");std::vector<uint8_t> payloadV13,payloadV12,payloadV11,payloadV10,payloadV9,payloadV8,payloadV7;if(!ReadSelfPayloadV14(payloadV13)||!PatchConvertPayloadV13ToV12(payloadV13,payloadV12,gPatchSlidersV14)||!PatchConvertPayloadV12ToV11(payloadV12,payloadV11,gPatchTreesV13)||!PatchConvertPayloadV11ToV10(payloadV11,payloadV10,gPatchMenuEntriesV12)||!PatchConvertPayloadV10ToV9(payloadV10,payloadV9,gPatchListStatesV11,gPatchListBoxesV11,gPatchListEventsV11)||!PatchConvertPayloadV9ToV8(payloadV9,payloadV8,gPatchTablesV10)||!PatchConvertPayloadV8ToV7(payloadV8,payloadV7,gPatchLayoutPoliciesV09)||!ParsePayload(payloadV7))return 20;if(gPatchLayoutPoliciesV09.size()!=gControls.size()||!PatchResolveTablesV10()||!PatchResolveListsV11()||!PatchResolveTreesV13()||!PatchResolveSlidersV14())return 22;PatchSyncListShadowsV11();gEventTarget=[PatchEventTargetV14 new];gWindowDelegates=[NSMutableArray arrayWithCapacity:gForms.size()];CreateMenus();if(!CreateForms()||!PatchInstallTablesV10()||!PatchInstallListsV11()||!PatchUpgradeTableTargetV12()||!PatchUpgradeTableTargetV13()||!PatchInstallTreesV13()||!PatchUpgradeTargetsV14()||!PatchInstallSlidersV14()||!PatchInstallMenusV12())return 21;gPatchResponsiveObserverV11=[PatchResponsiveObserverV11 new];[[NSNotificationCenter defaultCenter]addObserver:gPatchResponsiveObserverV11 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];gPatchSliderResizeObserverV14=[PatchSliderResizeObserverV14 new];[[NSNotificationCenter defaultCenter]addObserver:gPatchSliderResizeObserverV14 selector:@selector(windowDidResize:) name:NSWindowDidResizeNotification object:nil];ApplyPatchAccessibilityV09();ApplyPatchTableAccessibilityV10();RefreshUI();PatchRefreshListsV11();PatchRefreshMenusV12();PatchRefreshTreesV13();PatchRefreshSlidersV14();[NSApp finishLaunching];for(auto& f:gForms)if(f.visible)[f.window makeKeyAndOrderFront:nil];if(gSmokeMode){int result=RunSmoke();if(!result)result=RunPatchAccessibilitySmokeV09();if(!result)result=RunPatchTableAccessibilitySmokeV10();if(!result)result=RunPatchResponsiveSmokeV10();if(!result)result=RunPatchTableSmokeV10();if(!result)result=RunPatchListSmokeV11();if(!result)result=RunPatchMenuSmokeV12();if(!result)result=RunPatchTreeSmokeV13();if(!result)result=RunPatchSliderSmokeV14();return result;}[NSApp activateIgnoringOtherApps:YES];[NSApp run];}return 0;}
