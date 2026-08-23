/* HISTORICAL INCLUDE-CHAIN BASE — sealed payload v6.
 * This is not the Ready runtime. Current Ready is native-runtime/appkit-sealed-gui-v14.mm
 * (runtime v1.4 / payload v13). Frozen TreeView is appkit-sealed-gui-v13.mm.
 */
#import <Cocoa/Cocoa.h>
#include <mach-o/dyld.h>
#include <algorithm>
#include <cstdint>
#include <cmath>
#include <cstring>
#include <fstream>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

static const char PATCH_MAGIC[8] = {'P','C','H','G','U','I','0','1'};
static const uint32_t PATCH_PAYLOAD_VERSION = 6;
static bool gRefreshing = false;
static bool gSmokeMode = false;
static NSString* gLastDialogTitle=@"";
static NSString* gLastDialogMessage=@"";

enum StateType : uint8_t { ST_NUMBER=1, ST_TEXT=2, ST_BOOLEAN=3 };
enum ControlKind : uint8_t { CK_TEXT=1, CK_BUTTON=2, CK_INPUT=3, CK_CHECKBOX=4, CK_COMBO=5, CK_LISTBOX=6, CK_TABS=7, CK_RADIO=8 };
enum EventKind : uint8_t { EV_CLICKED=1, EV_CHANGED=2 };
enum ActionKind : uint8_t { ACT_OPEN=1, ACT_CLOSE=2, ACT_CHANGE=3, ACT_DIALOG=4 };
enum OpKind : uint8_t { OP_SET=1, OP_ADD=2, OP_REMOVE=3, OP_CLEAR=4 };
enum ValueKind : uint8_t { VK_NONE=0, VK_LITERAL=1, VK_EVENT=2 };

struct State { std::string name; uint8_t type=0; double number=0.0; std::string text; bool boolean=false; };
struct Control { uint8_t kind=0; std::string id,text,binding; std::vector<std::string> options; int x=0,y=0,width=0,height=0,formIndex=-1,commandId=0,parentTabIndex=-1,pageIndex=-1; NSView* widget=nil; };
struct MenuItem { std::string id,text; int formIndex=-1,commandId=0; NSMenuItem* widget=nil; };
struct Menu { std::string title; std::vector<int> items; };
struct Form { std::string id,title; int width=640,height=420; bool visible=false; NSWindow* window=nil; std::vector<int> controls; std::vector<Menu> menus; };
struct Operation { uint8_t op=0,valueKind=0; double number=0.0; std::string text; bool boolean=false; };
struct Action { uint8_t kind=0; std::string form,target,title,message; uint8_t stateType=0; std::vector<Operation> ops; };
struct Event { std::string control; uint8_t kind=0,valueType=0; std::vector<Action> actions; };

static std::vector<State> gStates;
static std::vector<Form> gForms;
static std::vector<Control> gControls;
static std::vector<MenuItem> gMenuItems;
static std::vector<Event> gEvents;
static std::vector<NSMutableArray*> gTabPages;
static std::vector<NSMutableArray*> gRadioItems;
static std::unordered_map<std::string,int> gStateByName,gFormById,gControlById,gMenuItemById;
static NSMutableArray* gWindowDelegates=nil;

static NSString* NS(const std::string& value){return [[NSString alloc] initWithBytes:value.data() length:value.size() encoding:NSUTF8StringEncoding];}
static std::string UTF8(NSString* value){const char* p=value?[value UTF8String]:nullptr;return p?p:"";}
static uint32_t Crc32(const uint8_t*data,size_t size){uint32_t crc=0xffffffffu;for(size_t n=0;n<size;++n){crc^=data[n];for(int i=0;i<8;++i)crc=(crc>>1)^(0xedb88320u&(0u-(crc&1u)));}return crc^0xffffffffu;}
class Reader{
public:
  Reader(const uint8_t*d,size_t s):data(d),size(s){}
  uint8_t u8(){need(1);return data[offset++];}
  uint32_t u32(){need(4);uint32_t v=(uint32_t)data[offset]|((uint32_t)data[offset+1]<<8)|((uint32_t)data[offset+2]<<16)|((uint32_t)data[offset+3]<<24);offset+=4;return v;}
  int32_t i32(){return(int32_t)u32();}
  double f64(){need(8);double v;memcpy(&v,data+offset,8);offset+=8;if(!std::isfinite(v))throw 1;return v;}
  std::string text(){uint32_t n=u32();need(n);std::string v(reinterpret_cast<const char*>(data+offset),n);offset+=n;NSString*checked=NS(v);if(!checked)throw 1;return v;}
  bool done()const{return offset==size;}
private:void need(size_t n){if(n>size-offset)throw 1;}const uint8_t*data;size_t size=0,offset=0;
};
static bool SelfPath(std::string&path){uint32_t size=0;_NSGetExecutablePath(nullptr,&size);if(!size||size>1024*1024)return false;std::vector<char>b(size+1,0);if(_NSGetExecutablePath(b.data(),&size)!=0)return false;path.assign(b.data());return !path.empty();}
static bool ReadSelfPayload(std::vector<uint8_t>&payload){std::string path;if(!SelfPath(path))return false;std::ifstream file(path,std::ios::binary|std::ios::ate);if(!file)return false;std::streamoff size=file.tellg();if(size<20)return false;file.seekg(size-20);uint8_t footer[20]{};file.read(reinterpret_cast<char*>(footer),20);if(!file||memcmp(footer,PATCH_MAGIC,8)!=0)return false;auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);if(version!=PATCH_PAYLOAD_VERSION||!length||(uint64_t)length>(uint64_t)(size-20))return false;file.seekg(size-20-(std::streamoff)length);payload.resize(length);file.read(reinterpret_cast<char*>(payload.data()),(std::streamsize)length);return file&&Crc32(payload.data(),payload.size())==crc;}
static void ReadValue(Reader&r,uint8_t type,double&number,std::string&text,bool&boolean){if(type==ST_NUMBER)number=r.f64();else if(type==ST_TEXT)text=r.text();else if(type==ST_BOOLEAN)boolean=r.u8()!=0;else throw 1;}

static bool ParsePayload(const std::vector<uint8_t>&bytes){
  try{
    Reader r(bytes.data(),bytes.size());uint32_t stateCount=r.u32();if(stateCount>10000)return false;
    for(uint32_t i=0;i<stateCount;++i){State s;s.name=r.text();s.type=r.u8();ReadValue(r,s.type,s.number,s.text,s.boolean);if(s.name.empty()||gStateByName.count(s.name))return false;gStateByName[s.name]=(int)gStates.size();gStates.push_back(std::move(s));}
    uint32_t formCount=r.u32();if(!formCount||formCount>1024)return false;int nextCommand=1000;
    for(uint32_t f=0;f<formCount;++f){
      Form form;form.id=r.text();form.title=r.text();form.width=(int)r.u32();form.height=(int)r.u32();form.visible=r.u8()!=0;if(form.id.empty()||gFormById.count(form.id)||form.width<=0||form.height<=0||form.width>10000||form.height>10000)return false;
      int formIndex=(int)gForms.size();gFormById[form.id]=formIndex;uint32_t count=r.u32();if(count>10000)return false;
      for(uint32_t c=0;c<count;++c){Control control;control.kind=r.u8();control.id=r.text();control.text=r.text();control.binding=r.text();uint32_t options=r.u32();if(options>10000)return false;for(uint32_t o=0;o<options;++o)control.options.push_back(r.text());control.x=r.i32();control.y=r.i32();control.width=r.i32();control.height=r.i32();control.parentTabIndex=r.i32();control.pageIndex=r.i32();control.formIndex=formIndex;control.commandId=nextCommand++;if(control.kind<CK_TEXT||control.kind>CK_RADIO||control.width<=0||control.height<=0||control.width>10000||control.height>10000)return false;if((control.kind==CK_COMBO||control.kind==CK_LISTBOX||control.kind==CK_TABS||control.kind==CK_RADIO)&&control.options.size()<2)return false;if(!control.id.empty()){if(gControlById.count(control.id)||gMenuItemById.count(control.id))return false;gControlById[control.id]=(int)gControls.size();}form.controls.push_back((int)gControls.size());gControls.push_back(std::move(control));}
      uint32_t menuCount=r.u32();if(menuCount>1024)return false;for(uint32_t m=0;m<menuCount;++m){Menu menu;menu.title=r.text();if(menu.title.empty())return false;uint32_t itemCount=r.u32();if(!itemCount||itemCount>10000)return false;for(uint32_t i=0;i<itemCount;++i){MenuItem item;item.id=r.text();item.text=r.text();item.formIndex=formIndex;item.commandId=20000+(int)gMenuItems.size();if(item.id.empty()||gControlById.count(item.id)||gMenuItemById.count(item.id))return false;int idx=(int)gMenuItems.size();gMenuItemById[item.id]=idx;gMenuItems.push_back(std::move(item));menu.items.push_back(idx);}form.menus.push_back(std::move(menu));}
      gForms.push_back(std::move(form));
    }
    for(int i=0;i<(int)gControls.size();++i){const auto&c=gControls[i];if(c.parentTabIndex<0){if(c.pageIndex!=-1)return false;continue;}if(c.parentTabIndex>=i||c.parentTabIndex>=(int)gControls.size())return false;const auto&p=gControls[c.parentTabIndex];if(p.kind!=CK_TABS||p.formIndex!=c.formIndex||c.pageIndex<0||c.pageIndex>=(int)p.options.size())return false;}
    uint32_t eventCount=r.u32();if(eventCount>10000)return false;for(uint32_t e=0;e<eventCount;++e){Event event;event.control=r.text();event.kind=r.u8();event.valueType=r.u8();bool isControl=gControlById.count(event.control)!=0;bool isMenu=gMenuItemById.count(event.control)!=0;if((!isControl&&!isMenu)||(event.kind!=EV_CLICKED&&event.kind!=EV_CHANGED)||event.valueType>2)return false;if(isMenu&&(event.kind!=EV_CLICKED||event.valueType!=0))return false;uint32_t actions=r.u32();if(actions>10000)return false;for(uint32_t a=0;a<actions;++a){Action action;action.kind=r.u8();if(action.kind==ACT_OPEN||action.kind==ACT_CLOSE){action.form=r.text();if(!gFormById.count(action.form))return false;}else if(action.kind==ACT_DIALOG){action.form=r.text();action.title=r.text();action.message=r.text();if(!gFormById.count(action.form))return false;}else if(action.kind==ACT_CHANGE){action.target=r.text();action.stateType=r.u8();auto sit=gStateByName.find(action.target);if(sit==gStateByName.end()||gStates[sit->second].type!=action.stateType)return false;uint32_t ops=r.u32();if(ops>10000)return false;for(uint32_t o=0;o<ops;++o){Operation op;op.op=r.u8();op.valueKind=r.u8();if(op.op<OP_SET||op.op>OP_CLEAR||op.valueKind>VK_EVENT)return false;if(op.op==OP_CLEAR){if(op.valueKind!=VK_NONE)return false;}else if(op.valueKind==VK_LITERAL)ReadValue(r,action.stateType,op.number,op.text,op.boolean);else if(op.valueKind!=VK_EVENT)return false;action.ops.push_back(std::move(op));}}else return false;event.actions.push_back(std::move(action));}gEvents.push_back(std::move(event));}
    if(!r.done())return false;for(const auto&c:gControls){if(c.kind==CK_INPUT||c.kind==CK_COMBO||c.kind==CK_LISTBOX||c.kind==CK_RADIO){auto it=gStateByName.find(c.binding);if(it==gStateByName.end()||gStates[it->second].type!=ST_TEXT)return false;}else if(c.kind==CK_CHECKBOX){auto it=gStateByName.find(c.binding);if(it==gStateByName.end()||gStates[it->second].type!=ST_BOOLEAN)return false;}}gTabPages.resize(gControls.size(),nil);gRadioItems.resize(gControls.size(),nil);return true;
  }catch(...){return false;}
}

static std::string PatchNumber(double v){if(std::floor(v)==v)return std::to_string((long long)v);std::ostringstream out;out.precision(15);out<<v;return out.str();}
static std::string StateText(const State&s){if(s.type==ST_NUMBER)return PatchNumber(s.number);if(s.type==ST_BOOLEAN)return s.boolean?"true":"false";return s.text;}
static NSString* RenderText(const std::string&source){std::string out;size_t pos=0;while(pos<source.size()){size_t open=source.find('{',pos);if(open==std::string::npos){out.append(source,pos,std::string::npos);break;}out.append(source,pos,open-pos);size_t close=source.find('}',open+1);if(close==std::string::npos){out.append(source,open,std::string::npos);break;}std::string name=source.substr(open+1,close-open-1);auto it=gStateByName.find(name);if(it==gStateByName.end())out.append(source,open,close-open+1);else out+=StateText(gStates[it->second]);pos=close+1;}return NS(out);}
static void ShowInfoDialog(const Action&action){if(gSmokeMode){gLastDialogTitle=NS(action.title);gLastDialogMessage=NS(action.message);return;}NSAlert*alert=[NSAlert new];alert.alertStyle=NSAlertStyleInformational;alert.messageText=NS(action.title);alert.informativeText=NS(action.message);[alert addButtonWithTitle:@"OK"];[alert runModal];}
static void RefreshUI();
static void ApplyOperation(State&state,const Operation&op,bool eventBool,const std::string&eventText){if(op.op==OP_CLEAR){if(state.type==ST_NUMBER)state.number=0.0;else if(state.type==ST_TEXT)state.text.clear();else state.boolean=false;return;}bool fromEvent=op.valueKind==VK_EVENT;if(state.type==ST_NUMBER){double v=op.number;if(op.op==OP_SET)state.number=v;else if(op.op==OP_ADD)state.number+=v;else if(op.op==OP_REMOVE)state.number-=v;}else if(state.type==ST_TEXT){const std::string&v=fromEvent?eventText:op.text;if(op.op==OP_SET)state.text=v;else if(op.op==OP_ADD)state.text+=v;}else if(state.type==ST_BOOLEAN&&op.op==OP_SET)state.boolean=fromEvent?eventBool:op.boolean;}
static void ExecuteEvent(const Event&event,bool eventBool,const std::string&eventText){for(const auto&action:event.actions){if(action.kind==ACT_OPEN)[gForms[gFormById[action.form]].window makeKeyAndOrderFront:nil];else if(action.kind==ACT_CLOSE)[gForms[gFormById[action.form]].window orderOut:nil];else if(action.kind==ACT_DIALOG)ShowInfoDialog(action);else if(action.kind==ACT_CHANGE){State&state=gStates[gStateByName[action.target]];for(const auto&op:action.ops)ApplyOperation(state,op,eventBool,eventText);}}RefreshUI();}
static void DispatchControl(int index,uint8_t kind,id sender=nil){if(gRefreshing||index<0||index>=(int)gControls.size())return;auto&control=gControls[index];if(control.id.empty())return;for(const auto&event:gEvents){if(event.control!=control.id||event.kind!=kind)continue;bool eventBool=false;std::string eventText;if(event.valueType==1&&control.kind==CK_CHECKBOX)eventBool=[(NSButton*)control.widget state]==NSControlStateValueOn;else if(event.valueType==2&&control.kind==CK_INPUT)eventText=UTF8([(NSTextField*)control.widget stringValue]);else if(event.valueType==2&&control.kind==CK_COMBO)eventText=UTF8([(NSPopUpButton*)control.widget titleOfSelectedItem]);else if(event.valueType==2&&control.kind==CK_LISTBOX){NSInteger row=[(NSTableView*)control.widget selectedRow];if(row>=0&&(size_t)row<control.options.size())eventText=control.options[(size_t)row];}else if(event.valueType==2&&control.kind==CK_RADIO)eventText=UTF8([(NSButton*)sender title]);ExecuteEvent(event,eventBool,eventText);}}
static void DispatchMenuItem(int index){if(gRefreshing||index<0||index>=(int)gMenuItems.size())return;auto&item=gMenuItems[index];for(const auto&event:gEvents)if(event.control==item.id&&event.kind==EV_CLICKED)ExecuteEvent(event,false,{});}

@interface PatchEventTarget : NSObject <NSTextFieldDelegate,NSTableViewDataSource,NSTableViewDelegate>
- (void)handleControl:(id)sender;
@end
@implementation PatchEventTarget
- (void)handleControl:(id)sender { NSInteger tag=[sender tag];if(tag>=20000){DispatchMenuItem((int)(tag-20000));return;}NSInteger index=tag-1000;if(index<0||index>=(NSInteger)gControls.size())return;auto&c=gControls[(size_t)index];if(c.kind==CK_RADIO){for(NSButton*item in gRadioItems[(size_t)index])item.state=(item==sender)?NSControlStateValueOn:NSControlStateValueOff;}DispatchControl((int)index,(c.kind==CK_CHECKBOX||c.kind==CK_COMBO||c.kind==CK_LISTBOX||c.kind==CK_RADIO)?EV_CHANGED:EV_CLICKED,sender); }
- (void)controlTextDidChange:(NSNotification*)notification { NSInteger index=[(NSTextField*)notification.object tag]-1000;DispatchControl((int)index,EV_CHANGED,notification.object); }
- (NSInteger)numberOfRowsInTableView:(NSTableView*)tableView { NSInteger index=tableView.tag-1000;return index>=0&&index<(NSInteger)gControls.size()?(NSInteger)gControls[(size_t)index].options.size():0; }
- (NSView*)tableView:(NSTableView*)tableView viewForTableColumn:(NSTableColumn*)column row:(NSInteger)row { (void)column;NSInteger index=tableView.tag-1000;if(index<0||index>=(NSInteger)gControls.size()||row<0||(size_t)row>=gControls[(size_t)index].options.size())return nil;NSTextField*label=[NSTextField labelWithString:NS(gControls[(size_t)index].options[(size_t)row])];label.lineBreakMode=NSLineBreakByTruncatingTail;return label; }
- (void)tableViewSelectionDidChange:(NSNotification*)notification { if(!gRefreshing)[self handleControl:notification.object]; }
@end
static PatchEventTarget* gEventTarget=nil;

@interface PatchWindowDelegate : NSObject <NSWindowDelegate>
@property(nonatomic) NSInteger formIndex;
@end
@implementation PatchWindowDelegate
- (BOOL)windowShouldClose:(NSWindow*)sender { if(self.formIndex==0)[NSApp terminate:nil];else[sender orderOut:nil];return NO; }
@end

static void SetText(Control&c,NSString*v){if(c.kind==CK_BUTTON||c.kind==CK_CHECKBOX){NSButton*b=(NSButton*)c.widget;if(![[b title]isEqualToString:v])[b setTitle:v];}else{NSTextField*f=(NSTextField*)c.widget;if(![[f stringValue]isEqualToString:v])[f setStringValue:v];}}
static void RefreshUI(){gRefreshing=true;for(size_t index=0;index<gControls.size();++index){auto&c=gControls[index];if(c.kind==CK_RADIO){NSString*value=NS(gStates[gStateByName[c.binding]].text);for(NSButton*item in gRadioItems[index])item.state=[item.title isEqualToString:value]?NSControlStateValueOn:NSControlStateValueOff;continue;}if(!c.widget||c.kind==CK_TABS)continue;if(c.kind==CK_TEXT||c.kind==CK_BUTTON)SetText(c,RenderText(c.text));else if(c.kind==CK_INPUT)SetText(c,NS(gStates[gStateByName[c.binding]].text));else if(c.kind==CK_CHECKBOX){SetText(c,RenderText(c.text));[(NSButton*)c.widget setState:gStates[gStateByName[c.binding]].boolean?NSControlStateValueOn:NSControlStateValueOff];}else if(c.kind==CK_COMBO)[(NSPopUpButton*)c.widget selectItemWithTitle:NS(gStates[gStateByName[c.binding]].text)];else if(c.kind==CK_LISTBOX){NSInteger selected=-1;auto&v=gStates[gStateByName[c.binding]].text;for(size_t i=0;i<c.options.size();++i)if(c.options[i]==v){selected=(NSInteger)i;break;}NSTableView*table=(NSTableView*)c.widget;if(selected>=0)[table selectRowIndexes:[NSIndexSet indexSetWithIndex:(NSUInteger)selected] byExtendingSelection:NO];else[table deselectAll:nil];}}gRefreshing=false;}
static NSRect NativeRect(const Control&c){int containerHeight=gForms[c.formIndex].height;if(c.parentTabIndex>=0)containerHeight=std::max(1,gControls[c.parentTabIndex].height-30);int nativeY=std::max(0,containerHeight-c.y-c.height);return NSMakeRect(c.x,nativeY,c.width,c.height);}
static NSView* TargetView(const Control&c){if(c.parentTabIndex<0)return gForms[c.formIndex].window.contentView;if(c.parentTabIndex>=(int)gTabPages.size()||!gTabPages[c.parentTabIndex]||c.pageIndex<0||c.pageIndex>=[gTabPages[c.parentTabIndex] count])return nil;return [gTabPages[c.parentTabIndex] objectAtIndex:(NSUInteger)c.pageIndex];}
static NSView* CreateControl(int index){
  auto&c=gControls[index];NSRect rect=NativeRect(c);NSView*target=TargetView(c);if(!target)return nil;
  if(c.kind==CK_TABS){NSTabView*tabs=[[NSTabView alloc]initWithFrame:rect];NSMutableArray*pages=[NSMutableArray arrayWithCapacity:c.options.size()];for(const auto&title:c.options){NSTabViewItem*item=[[NSTabViewItem alloc]initWithIdentifier:nil];item.label=NS(title);NSView*page=[[NSView alloc]initWithFrame:NSMakeRect(0,0,c.width,std::max(1,c.height-30))];item.view=page;[tabs addTabViewItem:item];[pages addObject:page];}[tabs selectTabViewItemAtIndex:0];gTabPages[index]=pages;c.widget=tabs;[target addSubview:tabs];return tabs;}
  if(c.kind==CK_RADIO){NSMutableArray*items=[NSMutableArray arrayWithCapacity:c.options.size()];int count=(int)c.options.size();int itemHeight=count?c.height/count:26;if(itemHeight<22)itemHeight=22;if(itemHeight>30)itemHeight=30;for(int o=0;o<count;++o){NSRect itemRect=NSMakeRect(rect.origin.x,rect.origin.y+(count-1-o)*itemHeight,rect.size.width,itemHeight);NSButton*item=[[NSButton alloc]initWithFrame:itemRect];item.buttonType=NSButtonTypeRadio;item.title=NS(c.options[(size_t)o]);item.tag=1000+index;item.target=gEventTarget;item.action=@selector(handleControl:);[items addObject:item];[target addSubview:item];if(!c.widget)c.widget=item;}gRadioItems[index]=items;return c.widget;}
  NSView*widget=nil;if(c.kind==CK_TEXT){NSTextField*field=[[NSTextField alloc]initWithFrame:rect];field.editable=NO;field.selectable=NO;field.bezeled=NO;field.drawsBackground=NO;widget=field;}else if(c.kind==CK_INPUT){NSTextField*field=[[NSTextField alloc]initWithFrame:rect];field.tag=1000+index;field.delegate=gEventTarget;widget=field;}else if(c.kind==CK_COMBO){NSPopUpButton*combo=[[NSPopUpButton alloc]initWithFrame:rect pullsDown:NO];for(const auto&o:c.options)[combo addItemWithTitle:NS(o)];combo.tag=1000+index;combo.target=gEventTarget;combo.action=@selector(handleControl:);widget=combo;}else if(c.kind==CK_LISTBOX){NSScrollView*scroll=[[NSScrollView alloc]initWithFrame:rect];scroll.hasVerticalScroller=YES;scroll.autohidesScrollers=YES;scroll.borderType=NSBezelBorder;NSTableView*table=[[NSTableView alloc]initWithFrame:scroll.bounds];NSTableColumn*column=[[NSTableColumn alloc]initWithIdentifier:@"value"];column.width=c.width;[table addTableColumn:column];table.headerView=nil;table.allowsMultipleSelection=NO;table.allowsEmptySelection=YES;table.tag=1000+index;table.dataSource=gEventTarget;table.delegate=gEventTarget;scroll.documentView=table;[target addSubview:scroll];widget=table;}else if(c.kind==CK_BUTTON||c.kind==CK_CHECKBOX){NSButton*button=[[NSButton alloc]initWithFrame:rect];button.tag=1000+index;button.target=gEventTarget;button.action=@selector(handleControl:);if(c.kind==CK_CHECKBOX)button.buttonType=NSButtonTypeSwitch;else{button.buttonType=NSButtonTypeMomentaryPushIn;button.bezelStyle=NSBezelStyleRounded;}widget=button;}else return nil;c.widget=widget;if(c.kind!=CK_LISTBOX)[target addSubview:widget];return widget;
}
static void CreateMenus(){NSMenu*mainMenu=[NSMenu new];for(auto&f:gForms){for(auto&menu:f.menus){NSMenuItem*root=[[NSMenuItem alloc]initWithTitle:NS(menu.title) action:nil keyEquivalent:@""];NSMenu*submenu=[[NSMenu alloc]initWithTitle:NS(menu.title)];root.submenu=submenu;[mainMenu addItem:root];for(int idx:menu.items){auto&entry=gMenuItems[idx];entry.widget=[[NSMenuItem alloc]initWithTitle:NS(entry.text) action:@selector(handleControl:) keyEquivalent:@""];entry.widget.tag=entry.commandId;entry.widget.target=gEventTarget;[submenu addItem:entry.widget];}}}[NSApp setMainMenu:mainMenu];}
static bool CreateForms(){for(int i=0;i<(int)gForms.size();++i){auto&f=gForms[i];NSRect rect=NSMakeRect(0,0,f.width,f.height);NSWindowStyleMask style=NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskMiniaturizable|NSWindowStyleMaskResizable;f.window=[[NSWindow alloc]initWithContentRect:rect styleMask:style backing:NSBackingStoreBuffered defer:NO];f.window.title=NS(f.title);[f.window center];PatchWindowDelegate*d=[PatchWindowDelegate new];d.formIndex=i;[gWindowDelegates addObject:d];f.window.delegate=d;}for(int i=0;i<(int)gControls.size();++i)if(!CreateControl(i))return false;return true;}
static void Pump(){for(;;){NSEvent*event=[NSApp nextEventMatchingMask:NSEventMaskAny untilDate:[NSDate dateWithTimeIntervalSinceNow:0] inMode:NSDefaultRunLoopMode dequeue:YES];if(!event)break;[NSApp sendEvent:event];}}
static bool Click(const char*id){auto it=gControlById.find(id);if(it==gControlById.end())return false;auto&c=gControls[it->second];if(c.kind!=CK_BUTTON)return false;[(NSButton*)c.widget performClick:nil];Pump();return true;}
static int RunSmoke(){
  auto mainIt=gFormById.find("main");int mainIndex=mainIt==gFormById.end()?0:mainIt->second;auto settingsForm=gFormById.find("settings");if(![gForms[mainIndex].window isVisible])return 70;if(settingsForm!=gFormById.end()&&[gForms[settingsForm->second].window isVisible])return 71;if(gControlById.count("open_settings")&&settingsForm!=gFormById.end()){if(!Click("open_settings")||![gForms[settingsForm->second].window isVisible])return 72;}if(gControlById.count("name")&&gStateByName.count("name")){auto&c=gControls[gControlById["name"]];if(c.kind==CK_INPUT){[(NSTextField*)c.widget setStringValue:@"Ada"];NSNotification*n=[NSNotification notificationWithName:NSControlTextDidChangeNotification object:c.widget];[gEventTarget controlTextDidChange:n];if(gStates[gStateByName["name"]].text!="Ada")return 73;}}
  if(gControlById.count("settings")){auto&tab=gControls[gControlById["settings"]];if(tab.kind==CK_TABS){NSTabView*tabs=(NSTabView*)tab.widget;if([tabs numberOfTabViewItems]!=(NSInteger)tab.options.size())return 74;[tabs selectTabViewItemAtIndex:1];if(![[[tabs selectedTabViewItem] label]isEqualToString:NS(tab.options[1])])return 75;}}if(gControlById.count("notifications")){auto&c=gControls[gControlById["notifications"]];auto s=gStateByName.find("notifications");if(c.kind!=CK_CHECKBOX||s==gStateByName.end())return 76;bool before=gStates[s->second].boolean;[(NSButton*)c.widget performClick:nil];Pump();if(gStates[s->second].boolean==before)return 77;}if(gControlById.count("size")){auto&c=gControls[gControlById["size"]];auto s=gStateByName.find("size");if(c.kind!=CK_COMBO||c.options.empty()||s==gStateByName.end())return 78;NSInteger last=(NSInteger)c.options.size()-1;[(NSPopUpButton*)c.widget selectItemAtIndex:last];[gEventTarget handleControl:c.widget];Pump();if(gStates[s->second].text!=c.options[(size_t)last])return 79;}if(gControlById.count("fruit")){auto&c=gControls[gControlById["fruit"]];auto s=gStateByName.find("fruit");if(c.kind!=CK_LISTBOX||c.options.empty()||s==gStateByName.end())return 80;NSInteger last=(NSInteger)c.options.size()-1;[(NSTableView*)c.widget selectRowIndexes:[NSIndexSet indexSetWithIndex:(NSUInteger)last] byExtendingSelection:NO];[gEventTarget handleControl:c.widget];Pump();if(gStates[s->second].text!=c.options[(size_t)last])return 81;}if(gControlById.count("mode")){auto&c=gControls[gControlById["mode"]];auto s=gStateByName.find("mode");if(c.kind!=CK_RADIO||c.options.empty()||!gRadioItems[gControlById["mode"]]||[gRadioItems[gControlById["mode"]] count]!=(NSInteger)c.options.size()||s==gStateByName.end())return 83;NSInteger last=(NSInteger)c.options.size()-1;[(NSButton*)[gRadioItems[gControlById["mode"]] objectAtIndex:(NSUInteger)last] performClick:nil];Pump();if(gStates[s->second].text!=c.options[(size_t)last])return 84;}
  if(gMenuItemById.count("about_item")){auto&item=gMenuItems[gMenuItemById["about_item"]];if(!item.widget)return 85;[NSApp sendAction:item.widget.action to:item.widget.target from:item.widget];if(![gLastDialogTitle isEqualToString:@"About Patch"]||![gLastDialogMessage isEqualToString:@"Native menus and informational dialogs"])return 86;}if(gControlById.count("close_settings")&&settingsForm!=gFormById.end()){if(!Click("close_settings")||[gForms[settingsForm->second].window isVisible])return 82;}return 0;
}
static bool HasArg(int argc,const char*argv[],const char*value){for(int i=1;i<argc;++i)if(strcmp(argv[i],value)==0)return true;return false;}

int main(int argc,const char*argv[]){@autoreleasepool{[NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyRegular];gSmokeMode=HasArg(argc,argv,"--patch-smoke");std::vector<uint8_t>payload;if(!ReadSelfPayload(payload)||!ParsePayload(payload))return 20;gEventTarget=[PatchEventTarget new];gWindowDelegates=[NSMutableArray arrayWithCapacity:gForms.size()];CreateMenus();if(!CreateForms())return 21;RefreshUI();[NSApp finishLaunching];for(auto&f:gForms)if(f.visible)[f.window makeKeyAndOrderFront:nil];if(gSmokeMode)return RunSmoke();[NSApp activateIgnoringOtherApps:YES];[NSApp run];}return 0;}
