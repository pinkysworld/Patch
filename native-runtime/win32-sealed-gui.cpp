#define UNICODE
#define _UNICODE
#include <windows.h>
#include <commctrl.h>
#include <cstdint>
#include <cmath>
#include <cstring>
#include <string>
#include <vector>
#include <unordered_map>
#include <sstream>
#pragma comment(lib, "comctl32.lib")

static const wchar_t* PATCH_WINDOW_CLASS = L"PatchSealedNativeWindowV5";
static const char PATCH_MAGIC[8] = {'P','C','H','G','U','I','0','1'};
static const uint32_t PATCH_PAYLOAD_VERSION = 5;
static HINSTANCE gInstance = nullptr;
static HFONT gGuiFont = nullptr;
static bool gRefreshing = false;

enum StateType : uint8_t { ST_NUMBER=1, ST_TEXT=2, ST_BOOLEAN=3 };
enum ControlKind : uint8_t { CK_TEXT=1, CK_BUTTON=2, CK_INPUT=3, CK_CHECKBOX=4, CK_COMBO=5, CK_LISTBOX=6, CK_TABS=7, CK_RADIO=8 };
enum EventKind : uint8_t { EV_CLICKED=1, EV_CHANGED=2 };
enum ActionKind : uint8_t { ACT_OPEN=1, ACT_CLOSE=2, ACT_CHANGE=3 };
enum OpKind : uint8_t { OP_SET=1, OP_ADD=2, OP_REMOVE=3, OP_CLEAR=4 };
enum ValueKind : uint8_t { VK_NONE=0, VK_LITERAL=1, VK_EVENT=2 };

struct State {
  std::wstring name;
  uint8_t type=0;
  double number=0.0;
  std::wstring text;
  bool boolean=false;
};
struct Control {
  uint8_t kind=0;
  std::wstring id,text,binding;
  std::vector<std::wstring> options;
  int x=0,y=0,width=0,height=0,formIndex=-1,commandId=0;
  int parentTabIndex=-1,pageIndex=-1,selectedPage=0;
  HWND hwnd=nullptr;
  std::vector<HWND> radioItems;
};
struct Form { std::wstring id,title; int width=640,height=420; bool visible=false; HWND hwnd=nullptr; std::vector<int> controls; };
struct Operation { uint8_t op=0,valueKind=0; double number=0.0; std::wstring text; bool boolean=false; };
struct Action { uint8_t kind=0; std::wstring form,target; uint8_t stateType=0; std::vector<Operation> ops; };
struct Event { std::wstring control; uint8_t kind=0,valueType=0; std::vector<Action> actions; };

static std::vector<State> gStates;
static std::vector<Form> gForms;
static std::vector<Control> gControls;
static std::vector<Event> gEvents;
static std::unordered_map<std::wstring,int> gStateByName,gFormById,gControlById;

static uint32_t Crc32(const uint8_t* data,size_t size){
  uint32_t crc=0xffffffffu;
  for(size_t n=0;n<size;++n){crc^=data[n];for(int i=0;i<8;++i)crc=(crc>>1)^(0xedb88320u&(0u-(crc&1u)));}
  return crc^0xffffffffu;
}
static std::wstring Utf8ToWide(const uint8_t* data,size_t size){
  if(!size)return L"";
  if(size>INT_MAX)throw 1;
  int needed=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,reinterpret_cast<const char*>(data),(int)size,nullptr,0);
  if(needed<=0)throw 1;
  std::wstring out((size_t)needed,L'\0');
  if(MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,reinterpret_cast<const char*>(data),(int)size,out.data(),needed)!=needed)throw 1;
  return out;
}
class Reader{
public:
  Reader(const uint8_t*d,size_t s):data(d),size(s){}
  uint8_t u8(){need(1);return data[offset++];}
  uint32_t u32(){need(4);uint32_t v=(uint32_t)data[offset]|((uint32_t)data[offset+1]<<8)|((uint32_t)data[offset+2]<<16)|((uint32_t)data[offset+3]<<24);offset+=4;return v;}
  int32_t i32(){return(int32_t)u32();}
  double f64(){need(8);double v;memcpy(&v,data+offset,8);offset+=8;if(!std::isfinite(v))throw 1;return v;}
  std::wstring text(){uint32_t n=u32();need(n);auto v=Utf8ToWide(data+offset,n);offset+=n;return v;}
  bool done()const{return offset==size;}
private:
  void need(size_t n){if(n>size-offset)throw 1;}
  const uint8_t*data;size_t size=0,offset=0;
};

static bool ReadSelfPayload(std::vector<uint8_t>&payload){
  wchar_t path[MAX_PATH];DWORD n=GetModuleFileNameW(nullptr,path,MAX_PATH);if(!n||n>=MAX_PATH)return false;
  HANDLE file=CreateFileW(path,GENERIC_READ,FILE_SHARE_READ,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);if(file==INVALID_HANDLE_VALUE)return false;
  LARGE_INTEGER size{};if(!GetFileSizeEx(file,&size)||size.QuadPart<20){CloseHandle(file);return false;}
  LARGE_INTEGER pos{};pos.QuadPart=size.QuadPart-20;if(!SetFilePointerEx(file,pos,nullptr,FILE_BEGIN)){CloseHandle(file);return false;}
  uint8_t footer[20]{};DWORD got=0;if(!ReadFile(file,footer,20,&got,nullptr)||got!=20){CloseHandle(file);return false;}
  if(memcmp(footer,PATCH_MAGIC,8)!=0){CloseHandle(file);return false;}
  auto le32=[](const uint8_t*p){return(uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);};
  uint32_t version=le32(footer+8),length=le32(footer+12),crc=le32(footer+16);
  if(version!=PATCH_PAYLOAD_VERSION||!length||(uint64_t)length>(uint64_t)(size.QuadPart-20)){CloseHandle(file);return false;}
  pos.QuadPart=size.QuadPart-20-length;if(!SetFilePointerEx(file,pos,nullptr,FILE_BEGIN)){CloseHandle(file);return false;}
  payload.resize(length);got=0;BOOL ok=ReadFile(file,payload.data(),length,&got,nullptr);CloseHandle(file);
  return ok&&got==length&&Crc32(payload.data(),payload.size())==crc;
}
static void ReadValue(Reader&r,uint8_t type,double&number,std::wstring&text,bool&boolean){
  if(type==ST_NUMBER)number=r.f64();else if(type==ST_TEXT)text=r.text();else if(type==ST_BOOLEAN)boolean=r.u8()!=0;else throw 1;
}

static bool ParsePayload(const std::vector<uint8_t>&bytes){
  try{
    Reader r(bytes.data(),bytes.size());
    uint32_t stateCount=r.u32();if(stateCount>10000)return false;
    for(uint32_t i=0;i<stateCount;++i){
      State s;s.name=r.text();s.type=r.u8();ReadValue(r,s.type,s.number,s.text,s.boolean);
      if(s.name.empty()||gStateByName.count(s.name))return false;
      gStateByName[s.name]=(int)gStates.size();gStates.push_back(std::move(s));
    }
    uint32_t formCount=r.u32();if(!formCount||formCount>1024)return false;
    int nextCommand=1000;
    for(uint32_t f=0;f<formCount;++f){
      Form form;form.id=r.text();form.title=r.text();form.width=(int)r.u32();form.height=(int)r.u32();form.visible=r.u8()!=0;
      if(form.id.empty()||gFormById.count(form.id)||form.width<=0||form.height<=0||form.width>10000||form.height>10000)return false;
      int formIndex=(int)gForms.size();gFormById[form.id]=formIndex;
      uint32_t count=r.u32();if(count>10000)return false;
      for(uint32_t c=0;c<count;++c){
        Control control;control.kind=r.u8();control.id=r.text();control.text=r.text();control.binding=r.text();
        uint32_t options=r.u32();if(options>10000)return false;for(uint32_t o=0;o<options;++o)control.options.push_back(r.text());
        control.x=r.i32();control.y=r.i32();control.width=r.i32();control.height=r.i32();
        control.parentTabIndex=r.i32();control.pageIndex=r.i32();
        control.formIndex=formIndex;control.commandId=nextCommand++;
        if(control.kind<CK_TEXT||control.kind>CK_RADIO||control.width<=0||control.height<=0||control.width>10000||control.height>10000)return false;
        if((control.kind==CK_COMBO||control.kind==CK_LISTBOX||control.kind==CK_TABS||control.kind==CK_RADIO)&&control.options.size()<2)return false;
        if(!control.id.empty()){if(gControlById.count(control.id))return false;gControlById[control.id]=(int)gControls.size();}
        form.controls.push_back((int)gControls.size());gControls.push_back(std::move(control));
      }
      gForms.push_back(std::move(form));
    }
    for(int i=0;i<(int)gControls.size();++i){
      const auto& c=gControls[i];
      if(c.parentTabIndex<0){if(c.pageIndex!=-1)return false;continue;}
      if(c.parentTabIndex>=i||c.parentTabIndex>=(int)gControls.size())return false;
      const auto& parent=gControls[c.parentTabIndex];
      if(parent.kind!=CK_TABS||parent.formIndex!=c.formIndex||c.pageIndex<0||c.pageIndex>=(int)parent.options.size())return false;
    }
    uint32_t eventCount=r.u32();if(eventCount>10000)return false;
    for(uint32_t e=0;e<eventCount;++e){
      Event event;event.control=r.text();event.kind=r.u8();event.valueType=r.u8();
      if(!gControlById.count(event.control)||(event.kind!=EV_CLICKED&&event.kind!=EV_CHANGED)||event.valueType>2)return false;
      uint32_t actions=r.u32();if(actions>10000)return false;
      for(uint32_t a=0;a<actions;++a){
        Action action;action.kind=r.u8();
        if(action.kind==ACT_OPEN||action.kind==ACT_CLOSE){action.form=r.text();if(!gFormById.count(action.form))return false;}
        else if(action.kind==ACT_CHANGE){
          action.target=r.text();action.stateType=r.u8();auto sit=gStateByName.find(action.target);if(sit==gStateByName.end()||gStates[sit->second].type!=action.stateType)return false;
          uint32_t ops=r.u32();if(ops>10000)return false;
          for(uint32_t o=0;o<ops;++o){
            Operation op;op.op=r.u8();op.valueKind=r.u8();if(op.op<OP_SET||op.op>OP_CLEAR||op.valueKind>VK_EVENT)return false;
            if(op.op==OP_CLEAR){if(op.valueKind!=VK_NONE)return false;}
            else if(op.valueKind==VK_LITERAL)ReadValue(r,action.stateType,op.number,op.text,op.boolean);
            else if(op.valueKind!=VK_EVENT)return false;
            action.ops.push_back(std::move(op));
          }
        }else return false;
        event.actions.push_back(std::move(action));
      }
      gEvents.push_back(std::move(event));
    }
    if(!r.done())return false;
    for(const auto&c:gControls){
      if(c.kind==CK_INPUT||c.kind==CK_COMBO||c.kind==CK_LISTBOX||c.kind==CK_RADIO){auto it=gStateByName.find(c.binding);if(it==gStateByName.end()||gStates[it->second].type!=ST_TEXT)return false;}
      else if(c.kind==CK_CHECKBOX){auto it=gStateByName.find(c.binding);if(it==gStateByName.end()||gStates[it->second].type!=ST_BOOLEAN)return false;}
    }
    return true;
  }catch(...){return false;}
}

static std::wstring PatchNumber(double v){if(std::floor(v)==v)return std::to_wstring((long long)v);std::wostringstream out;out<<v;return out.str();}
static std::wstring StateText(const State&s){if(s.type==ST_NUMBER)return PatchNumber(s.number);if(s.type==ST_BOOLEAN)return s.boolean?L"true":L"false";return s.text;}
static std::wstring RenderText(const std::wstring&source){
  std::wstring out;size_t pos=0;
  while(pos<source.size()){
    size_t open=source.find(L'{',pos);if(open==std::wstring::npos){out.append(source,pos,std::wstring::npos);break;}
    out.append(source,pos,open-pos);size_t close=source.find(L'}',open+1);if(close==std::wstring::npos){out.append(source,open,std::wstring::npos);break;}
    std::wstring name=source.substr(open+1,close-open-1);auto it=gStateByName.find(name);
    if(it==gStateByName.end())out.append(source,open,close-open+1);else out+=StateText(gStates[it->second]);pos=close+1;
  }
  return out;
}
static std::wstring WindowText(HWND hwnd){int len=GetWindowTextLengthW(hwnd);if(len<=0)return L"";std::wstring v((size_t)len+1,L'\0');int copied=GetWindowTextW(hwnd,v.data(),len+1);v.resize(copied>0?(size_t)copied:0);return v;}
static std::wstring ComboText(HWND hwnd){LRESULT selected=SendMessageW(hwnd,CB_GETCURSEL,0,0);if(selected==CB_ERR)return L"";LRESULT len=SendMessageW(hwnd,CB_GETLBTEXTLEN,(WPARAM)selected,0);if(len==CB_ERR||len<0)return L"";std::wstring v((size_t)len+1,L'\0');LRESULT copied=SendMessageW(hwnd,CB_GETLBTEXT,(WPARAM)selected,(LPARAM)v.data());v.resize(copied>0?(size_t)copied:0);return v;}
static std::wstring ListBoxText(HWND hwnd){LRESULT selected=SendMessageW(hwnd,LB_GETCURSEL,0,0);if(selected==LB_ERR)return L"";LRESULT len=SendMessageW(hwnd,LB_GETTEXTLEN,(WPARAM)selected,0);if(len==LB_ERR||len<0)return L"";std::wstring v((size_t)len+1,L'\0');LRESULT copied=SendMessageW(hwnd,LB_GETTEXT,(WPARAM)selected,(LPARAM)v.data());v.resize(copied>0?(size_t)copied:0);return v;}
static void SetText(HWND hwnd,const std::wstring&v){if(WindowText(hwnd)!=v)SetWindowTextW(hwnd,v.c_str());}
static void SetCombo(HWND hwnd,const std::wstring&v){if(ComboText(hwnd)==v)return;LRESULT found=SendMessageW(hwnd,CB_FINDSTRINGEXACT,(WPARAM)-1,(LPARAM)v.c_str());SendMessageW(hwnd,CB_SETCURSEL,found==CB_ERR?(WPARAM)-1:(WPARAM)found,0);}
static void SetList(HWND hwnd,const std::wstring&v){if(ListBoxText(hwnd)==v)return;LRESULT found=SendMessageW(hwnd,LB_FINDSTRINGEXACT,(WPARAM)-1,(LPARAM)v.c_str());SendMessageW(hwnd,LB_SETCURSEL,found==LB_ERR?(WPARAM)-1:(WPARAM)found,0);}
static void SetRadio(Control&control,const std::wstring&v){for(HWND item:control.radioItems)if(item)SendMessageW(item,BM_SETCHECK,WindowText(item)==v?BST_CHECKED:BST_UNCHECKED,0);}
static void RefreshTabVisibility(){
  for(int i=0;i<(int)gControls.size();++i){auto&c=gControls[i];if(c.parentTabIndex<0)continue;const auto&tab=gControls[c.parentTabIndex];bool visible=tab.selectedPage==c.pageIndex;if(c.kind==CK_RADIO){for(HWND item:c.radioItems)if(item)ShowWindow(item,visible?SW_SHOW:SW_HIDE);}else if(c.hwnd)ShowWindow(c.hwnd,visible?SW_SHOW:SW_HIDE);}
}
static bool HandleTabNotify(NMHDR*header){
  if(!header||header->code!=TCN_SELCHANGE)return false;
  for(auto&c:gControls){if(c.kind!=CK_TABS||c.hwnd!=header->hwndFrom)continue;int selected=(int)SendMessageW(c.hwnd,TCM_GETCURSEL,0,0);c.selectedPage=selected>=0?selected:0;RefreshTabVisibility();return true;}
  return false;
}

static void RefreshUI();
static void ApplyOperation(State&state,const Operation&op,bool eventBool,const std::wstring&eventText){
  if(op.op==OP_CLEAR){if(state.type==ST_NUMBER)state.number=0.0;else if(state.type==ST_TEXT)state.text.clear();else state.boolean=false;return;}
  bool fromEvent=op.valueKind==VK_EVENT;
  if(state.type==ST_NUMBER){double v=op.number;if(op.op==OP_SET)state.number=v;else if(op.op==OP_ADD)state.number+=v;else if(op.op==OP_REMOVE)state.number-=v;}
  else if(state.type==ST_TEXT){const std::wstring&v=fromEvent?eventText:op.text;if(op.op==OP_SET)state.text=v;else if(op.op==OP_ADD)state.text+=v;}
  else if(state.type==ST_BOOLEAN&&op.op==OP_SET)state.boolean=fromEvent?eventBool:op.boolean;
}
static void ExecuteEvent(const Event&event,bool eventBool,const std::wstring&eventText){
  for(const auto&action:event.actions){
    if(action.kind==ACT_OPEN)ShowWindow(gForms[gFormById[action.form]].hwnd,SW_SHOW);
    else if(action.kind==ACT_CLOSE)ShowWindow(gForms[gFormById[action.form]].hwnd,SW_HIDE);
    else if(action.kind==ACT_CHANGE){State&state=gStates[gStateByName[action.target]];for(const auto&op:action.ops)ApplyOperation(state,op,eventBool,eventText);}
  }
  RefreshUI();
}
static void DispatchControl(int controlIndex,uint8_t kind,HWND eventHwnd=nullptr){
  if(gRefreshing||controlIndex<0||controlIndex>=(int)gControls.size())return;
  Control&control=gControls[controlIndex];if(control.id.empty())return;
  for(const auto&event:gEvents){
    if(event.control!=control.id||event.kind!=kind)continue;
    bool eventBool=false;std::wstring eventText;
    if(event.valueType==1&&control.kind==CK_CHECKBOX)eventBool=SendMessageW(control.hwnd,BM_GETCHECK,0,0)==BST_CHECKED;
    else if(event.valueType==2&&control.kind==CK_INPUT)eventText=WindowText(control.hwnd);
    else if(event.valueType==2&&control.kind==CK_COMBO)eventText=ComboText(control.hwnd);
    else if(event.valueType==2&&control.kind==CK_LISTBOX)eventText=ListBoxText(control.hwnd);
    else if(event.valueType==2&&control.kind==CK_RADIO)eventText=WindowText(eventHwnd?eventHwnd:control.hwnd);
    ExecuteEvent(event,eventBool,eventText);
  }
}
static void RefreshUI(){
  gRefreshing=true;
  for(auto&control:gControls){
    if(control.kind==CK_RADIO){SetRadio(control,gStates[gStateByName[control.binding]].text);continue;}
    if(!control.hwnd)continue;
    if(control.kind==CK_TEXT||control.kind==CK_BUTTON)SetText(control.hwnd,RenderText(control.text));
    else if(control.kind==CK_INPUT)SetText(control.hwnd,gStates[gStateByName[control.binding]].text);
    else if(control.kind==CK_CHECKBOX){SetText(control.hwnd,RenderText(control.text));SendMessageW(control.hwnd,BM_SETCHECK,gStates[gStateByName[control.binding]].boolean?BST_CHECKED:BST_UNCHECKED,0);}
    else if(control.kind==CK_COMBO)SetCombo(control.hwnd,gStates[gStateByName[control.binding]].text);
    else if(control.kind==CK_LISTBOX)SetList(control.hwnd,gStates[gStateByName[control.binding]].text);
  }
  RefreshTabVisibility();
  gRefreshing=false;
}

static LRESULT CALLBACK WndProc(HWND hwnd,UINT msg,WPARAM wParam,LPARAM lParam){
  int formIndex=(int)(INT_PTR)GetWindowLongPtrW(hwnd,GWLP_USERDATA);
  if(msg==WM_NCCREATE){auto*cs=reinterpret_cast<CREATESTRUCTW*>(lParam);formIndex=(int)(INT_PTR)cs->lpCreateParams;SetWindowLongPtrW(hwnd,GWLP_USERDATA,(LONG_PTR)formIndex);}
  if(msg==WM_COMMAND){
    int id=LOWORD(wParam),notification=HIWORD(wParam);HWND eventHwnd=reinterpret_cast<HWND>(lParam);
    for(int i=0;i<(int)gControls.size();++i){auto&c=gControls[i];if(c.commandId!=id)continue;
      if(c.kind==CK_BUTTON&&notification==BN_CLICKED)DispatchControl(i,EV_CLICKED,eventHwnd);
      else if(c.kind==CK_CHECKBOX&&notification==BN_CLICKED)DispatchControl(i,EV_CHANGED,eventHwnd);
      else if(c.kind==CK_RADIO&&notification==BN_CLICKED)DispatchControl(i,EV_CHANGED,eventHwnd);
      else if(c.kind==CK_INPUT&&notification==EN_CHANGE)DispatchControl(i,EV_CHANGED,eventHwnd);
      else if(c.kind==CK_COMBO&&notification==CBN_SELCHANGE)DispatchControl(i,EV_CHANGED,eventHwnd);
      else if(c.kind==CK_LISTBOX&&notification==LBN_SELCHANGE)DispatchControl(i,EV_CHANGED,eventHwnd);
      break;
    }
    return 0;
  }
  if(msg==WM_NOTIFY&&HandleTabNotify(reinterpret_cast<NMHDR*>(lParam)))return 0;
  if(msg==WM_CLOSE){if(formIndex==0)DestroyWindow(hwnd);else ShowWindow(hwnd,SW_HIDE);return 0;}
  if(msg==WM_DESTROY&&formIndex==0){PostQuitMessage(0);return 0;}
  return DefWindowProcW(hwnd,msg,wParam,lParam);
}
static bool CreateControl(int index){
  auto&c=gControls[index];HWND parent=gForms[c.formIndex].hwnd;DWORD style=WS_CHILD|WS_VISIBLE;const wchar_t*klass=L"STATIC";int height=c.height;int x=c.x,y=c.y;
  if(c.parentTabIndex>=0){const auto&tab=gControls[c.parentTabIndex];x=tab.x+10+c.x;y=tab.y+30+c.y;}
  if(c.kind==CK_RADIO){int count=(int)c.options.size();int itemHeight=count?c.height/count:26;if(itemHeight<22)itemHeight=22;if(itemHeight>30)itemHeight=30;for(int o=0;o<count;++o){DWORD radioStyle=WS_CHILD|WS_VISIBLE|WS_TABSTOP|BS_AUTORADIOBUTTON|(o==0?WS_GROUP:0);HWND item=CreateWindowExW(0,L"BUTTON",c.options[o].c_str(),radioStyle,x,y+o*itemHeight,c.width,itemHeight,parent,reinterpret_cast<HMENU>((INT_PTR)c.commandId),gInstance,nullptr);if(!item)return false;if(gGuiFont)SendMessageW(item,WM_SETFONT,(WPARAM)gGuiFont,TRUE);c.radioItems.push_back(item);if(!c.hwnd)c.hwnd=item;}return !c.radioItems.empty();}
  if(c.kind==CK_TEXT)style|=SS_LEFT;
  else if(c.kind==CK_BUTTON){klass=L"BUTTON";style|=WS_TABSTOP|BS_PUSHBUTTON;}
  else if(c.kind==CK_INPUT){klass=L"EDIT";style|=WS_TABSTOP|WS_BORDER|ES_AUTOHSCROLL;}
  else if(c.kind==CK_CHECKBOX){klass=L"BUTTON";style|=WS_TABSTOP|BS_AUTOCHECKBOX;}
  else if(c.kind==CK_COMBO){klass=L"COMBOBOX";style|=WS_TABSTOP|WS_VSCROLL|CBS_DROPDOWNLIST;height=c.height+120;if(height<160)height=160;}
  else if(c.kind==CK_LISTBOX){klass=L"LISTBOX";style|=WS_TABSTOP|WS_VSCROLL|WS_BORDER|LBS_NOTIFY;}
  else if(c.kind==CK_TABS){klass=WC_TABCONTROLW;style|=WS_TABSTOP|WS_CLIPSIBLINGS;}
  else return false;
  c.hwnd=CreateWindowExW(0,klass,L"",style,x,y,c.width,height,parent,reinterpret_cast<HMENU>((INT_PTR)c.commandId),gInstance,nullptr);
  if(!c.hwnd)return false;if(gGuiFont)SendMessageW(c.hwnd,WM_SETFONT,(WPARAM)gGuiFont,TRUE);
  if(c.kind==CK_COMBO)for(const auto&o:c.options)SendMessageW(c.hwnd,CB_ADDSTRING,0,(LPARAM)o.c_str());
  if(c.kind==CK_LISTBOX)for(const auto&o:c.options)SendMessageW(c.hwnd,LB_ADDSTRING,0,(LPARAM)o.c_str());
  if(c.kind==CK_TABS){for(int p=0;p<(int)c.options.size();++p){TCITEMW item{};item.mask=TCIF_TEXT;item.pszText=const_cast<wchar_t*>(c.options[p].c_str());SendMessageW(c.hwnd,TCM_INSERTITEMW,p,(LPARAM)&item);}SendMessageW(c.hwnd,TCM_SETCURSEL,0,0);c.selectedPage=0;}
  return true;
}
static bool CreateForms(){
  for(int i=0;i<(int)gForms.size();++i){auto&f=gForms[i];RECT r{0,0,f.width,f.height};AdjustWindowRect(&r,WS_OVERLAPPEDWINDOW,FALSE);f.hwnd=CreateWindowExW(0,PATCH_WINDOW_CLASS,f.title.c_str(),WS_OVERLAPPEDWINDOW,CW_USEDEFAULT,CW_USEDEFAULT,r.right-r.left,r.bottom-r.top,nullptr,nullptr,gInstance,reinterpret_cast<void*>((INT_PTR)i));if(!f.hwnd)return false;}
  for(int i=0;i<(int)gControls.size();++i)if(!CreateControl(i))return false;
  RefreshTabVisibility();return true;
}
static bool Click(const wchar_t*id){auto it=gControlById.find(id);if(it==gControlById.end())return false;auto&c=gControls[it->second];if(c.kind!=CK_BUTTON)return false;SendMessageW(gForms[c.formIndex].hwnd,WM_COMMAND,MAKEWPARAM(c.commandId,BN_CLICKED),(LPARAM)c.hwnd);return true;}
static int RunSmoke(){
  auto mainIt=gFormById.find(L"main");int mainIndex=mainIt==gFormById.end()?0:mainIt->second;auto settingsForm=gFormById.find(L"settings");
  if(!IsWindowVisible(gForms[mainIndex].hwnd))return 70;
  if(settingsForm!=gFormById.end()&&IsWindowVisible(gForms[settingsForm->second].hwnd))return 71;
  if(gControlById.count(L"open_settings")&&settingsForm!=gFormById.end()){if(!Click(L"open_settings")||!IsWindowVisible(gForms[settingsForm->second].hwnd))return 72;}
  if(gControlById.count(L"name")&&gStateByName.count(L"name")){auto&c=gControls[gControlById[L"name"]];if(c.kind==CK_INPUT){SetWindowTextW(c.hwnd,L"Ada");SendMessageW(gForms[c.formIndex].hwnd,WM_COMMAND,MAKEWPARAM(c.commandId,EN_CHANGE),(LPARAM)c.hwnd);if(gStates[gStateByName[L"name"]].text!=L"Ada")return 73;}}
  if(gControlById.count(L"settings")){auto&tab=gControls[gControlById[L"settings"]];if(tab.kind==CK_TABS){if((int)SendMessageW(tab.hwnd,TCM_GETITEMCOUNT,0,0)!=(int)tab.options.size())return 74;SendMessageW(tab.hwnd,TCM_SETCURSEL,1,0);NMHDR header{};header.hwndFrom=tab.hwnd;header.idFrom=tab.commandId;header.code=TCN_SELCHANGE;SendMessageW(gForms[tab.formIndex].hwnd,WM_NOTIFY,header.idFrom,(LPARAM)&header);if(tab.selectedPage!=1)return 75;}}
  if(gControlById.count(L"notifications")){auto&c=gControls[gControlById[L"notifications"]];auto s=gStateByName.find(L"notifications");if(c.kind!=CK_CHECKBOX||s==gStateByName.end())return 76;bool before=gStates[s->second].boolean;SendMessageW(c.hwnd,BM_SETCHECK,before?BST_UNCHECKED:BST_CHECKED,0);SendMessageW(gForms[c.formIndex].hwnd,WM_COMMAND,MAKEWPARAM(c.commandId,BN_CLICKED),(LPARAM)c.hwnd);if(gStates[s->second].boolean==before)return 77;}
  if(gControlById.count(L"size")){auto&c=gControls[gControlById[L"size"]];auto s=gStateByName.find(L"size");if(c.kind!=CK_COMBO||c.options.empty()||s==gStateByName.end())return 78;int last=(int)c.options.size()-1;SendMessageW(c.hwnd,CB_SETCURSEL,last,0);SendMessageW(gForms[c.formIndex].hwnd,WM_COMMAND,MAKEWPARAM(c.commandId,CBN_SELCHANGE),(LPARAM)c.hwnd);if(gStates[s->second].text!=c.options[last])return 79;}
  if(gControlById.count(L"fruit")){auto&c=gControls[gControlById[L"fruit"]];auto s=gStateByName.find(L"fruit");if(c.kind!=CK_LISTBOX||c.options.empty()||s==gStateByName.end())return 80;int last=(int)c.options.size()-1;SendMessageW(c.hwnd,LB_SETCURSEL,last,0);SendMessageW(gForms[c.formIndex].hwnd,WM_COMMAND,MAKEWPARAM(c.commandId,LBN_SELCHANGE),(LPARAM)c.hwnd);if(gStates[s->second].text!=c.options[last])return 81;}
  if(gControlById.count(L"mode")){auto&c=gControls[gControlById[L"mode"]];auto s=gStateByName.find(L"mode");if(c.kind!=CK_RADIO||c.options.empty()||c.radioItems.size()!=c.options.size()||s==gStateByName.end())return 83;int last=(int)c.options.size()-1;SendMessageW(c.radioItems[last],BM_CLICK,0,0);if(gStates[s->second].text!=c.options[last])return 84;}
  if(gControlById.count(L"close_settings")&&settingsForm!=gFormById.end()){if(!Click(L"close_settings")||IsWindowVisible(gForms[settingsForm->second].hwnd))return 82;}
  return 0;
}
static bool HasArg(const wchar_t*arg){return wcsstr(GetCommandLineW(),arg)!=nullptr;}

int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,PWSTR,int showCommand){
  gInstance=instance;gGuiFont=(HFONT)GetStockObject(DEFAULT_GUI_FONT);
  std::vector<uint8_t>payload;if(!ReadSelfPayload(payload)||!ParsePayload(payload))return 20;
  INITCOMMONCONTROLSEX common{};common.dwSize=sizeof(common);common.dwICC=ICC_TAB_CLASSES;if(!InitCommonControlsEx(&common))return 21;
  WNDCLASSEXW wc{};wc.cbSize=sizeof(wc);wc.hInstance=instance;wc.lpfnWndProc=WndProc;wc.lpszClassName=PATCH_WINDOW_CLASS;wc.hCursor=LoadCursor(nullptr,IDC_ARROW);wc.hIcon=LoadIcon(nullptr,IDI_APPLICATION);wc.hbrBackground=(HBRUSH)(COLOR_WINDOW+1);if(!RegisterClassExW(&wc))return 22;
  if(!CreateForms())return 23;RefreshUI();for(auto&f:gForms)if(f.visible)ShowWindow(f.hwnd,showCommand==0?SW_SHOWNORMAL:showCommand);
  if(HasArg(L"--patch-smoke"))return RunSmoke();
  MSG msg{};while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}return(int)msg.wParam;
}