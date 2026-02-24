from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io
import datetime
import json
from pydantic import BaseModel
from groq import Groq

from . import models, auth, database
from .database import engine, get_db, settings

# 初始化資料庫 (建立新資料表)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="農產品管理系統 API")

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq Client
groq_client = Groq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None

# --- Pydantic Models ---

class UserOut(BaseModel):
    email: str
    display_name: str
    birthday: str
    phone: Optional[str] = None
    shipping_address: Optional[str] = None
    is_vip: int
    is_admin: bool
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    birthday: Optional[str] = None
    phone: Optional[str] = None
    shipping_address: Optional[str] = None

class SupplierBase(BaseModel):
    name: str
    contact_info: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierOut(SupplierBase):
    id: int
    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    supplier_id: int
    available_stock: float
    stock: float
    safety_stock: float
    unit: str
    price: float
    description: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductOut(ProductBase):
    id: int
    supplier_name: Optional[str] = None
    class Config:
        from_attributes = True

class OrderItemOut(BaseModel):
    product_id: int
    product_name: str
    supplier: Optional[str] = "未知"
    unit: Optional[str] = ""
    quantity: float
    price_at_order: float
    subtotal: Optional[float] = 0.0
    class Config:
        from_attributes = True

class OrderOut(BaseModel):
    id: int
    user_email: str
    total_amount: float
    payment_method: str
    payment_status: str
    receiver_phone: Optional[str] = None
    receiver_address: Optional[str] = None
    created_at: datetime.datetime
    items: List[OrderItemOut]
    class Config:
        from_attributes = True

class CartItemOut(BaseModel):
    product_id: int
    product_name: str
    quantity: float
    price: float
    unit: str
    supplier: str
    is_gift: bool = False
    class Config:
        from_attributes = True

class CartSync(BaseModel):
    items: List[dict] # [{product_id, quantity}]

class OrderConfirmRequest(BaseModel):
    items: List[dict] # [{product_id, quantity, price_at_order, is_gift: optional}]
    payment_method: str
    receiver_phone: str
    receiver_address: str
    total_amount: float

class ChatMessage(BaseModel):
    message: str
    history: Optional[List[dict]] = []

# --- Auth Endpoints ---

@app.get("/auth/login-url")
def get_login_url():
    from urllib.parse import quote
    scope = "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
    encoded_callback = quote(settings.GOOGLE_CALLBACK_URL, safe="")
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={encoded_callback}&response_type=code&scope={scope}&access_type=online"
    )
    return {"url": url}

@app.get("/auth/callback")
async def auth_callback(code: str, db: Session = Depends(get_db)):
    user_info = await auth.get_google_user_info(code)
    email = user_info["email"]
    access_token = auth.create_access_token(data={"sub": email})
    
    user_record = db.query(models.User).filter(models.User.email == email).first()
    if not user_record:
        user_record = models.User(
            email=email,
            display_name=user_info.get("name", email.split("@")[0]),
            birthday=""
        )
        db.add(user_record)
        db.commit()

    is_admin = email in settings.admin_list
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user": {
            "email": user_record.email,
            "display_name": user_record.display_name,
            "is_vip": user_record.is_vip
        },
        "is_admin": is_admin
    }

@app.get("/me", response_model=UserOut)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.get_current_user)
):
    user = db.query(models.User).filter(models.User.email == current_user).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_dict = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    user_dict["is_admin"] = current_user in settings.admin_list
    return user_dict

@app.patch("/me", response_model=UserOut)
def update_my_profile(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.get_current_user)
):
    user = db.query(models.User).filter(models.User.email == current_user).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    for key, value in data.dict(exclude_unset=True).items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    
    user_dict = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    user_dict["is_admin"] = current_user in settings.admin_list
    return user_dict

# --- Product & Supplier Endpoints ---

@app.get("/products", response_model=List[ProductOut])
def list_products(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()
    # 手動加入供應商名稱
    res = []
    for p in products:
        p_dict = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        p_dict["supplier_name"] = p.supplier.name if p.supplier else "未知"
        res.append(p_dict)
    return res

@app.post("/admin/suppliers", response_model=SupplierOut)
def create_supplier(s: SupplierCreate, db: Session = Depends(get_db), admin: str = Depends(auth.get_current_admin)):
    db_s = models.Supplier(**s.dict())
    db.add(db_s)
    db.commit()
    db.refresh(db_s)
    return db_s

@app.get("/admin/suppliers", response_model=List[SupplierOut])
def list_suppliers(db: Session = Depends(get_db), admin: str = Depends(auth.get_current_admin)):
    return db.query(models.Supplier).all()

@app.post("/admin/products", response_model=ProductOut)
def create_product(p: ProductCreate, db: Session = Depends(get_db), admin: str = Depends(auth.get_current_admin)):
    db_p = models.Product(**p.dict())
    db.add(db_p)
    db.commit()
    db.refresh(db_p)
    return db_p

@app.patch("/admin/products/{p_id}", response_model=ProductOut)
def update_product(p_id: int, p_data: ProductCreate, db: Session = Depends(get_db), admin: str = Depends(auth.get_current_admin)):
    db_p = db.query(models.Product).filter(models.Product.id == p_id).first()
    if not db_p: raise HTTPException(status_code=404)
    for k, v in p_data.dict().items(): setattr(db_p, k, v)
    db.commit()
    db.refresh(db_p)
    return db_p

# --- Tool-Calling Definitions ---
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_inventory",
            "description": "查詢產品庫存、單價與描述。可提供關鍵字，或留空以查詢所有推薦產品。",
            "parameters": {
                "type": "object",
                "properties": {
                    "search_query": {"type": "string", "description": "產品品名、供應商或空字串"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "manage_order",
            "description": "管理訂單項目。僅當用戶明確表達購買/下單意向時調用。推薦產品時嚴禁調用此工具。輸入 items 列表。",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_id": {"type": "integer", "description": "產品 ID"},
                                "quantity": {"type": "number", "description": "採購數量"},
                                "is_gift": {"type": "boolean", "description": "是否為贈品 (價格為 0)"}
                            },
                            "required": ["product_id", "quantity"]
                        }
                    }
                },
                "required": ["items"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_news",
            "description": "獲取全站最新公告、運費門檻、優惠活動、出貨通知。當用戶問到相關話題時必用。",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_cart",
            "description": "獲取當前用戶購物車中已有的產品清單。當用戶問到「我買了什麼、購物車有什麼、剛才點了什麼」時調用。",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_order_history",
            "description": "獲取當前用戶過去已完成的歷史訂單紀錄。當用戶問到「我以前買過什麼、查歷史訂單、根據我之前的喜好推薦」時調用。",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]

# --- Helper for dynamic gift logic ---
def calculate_dynamic_cart(db: Session, user_email: str, raw_items=None):
    """
    統一計算購物車贈品標記的核心邏輯。
    可傳入 raw_items (list of dict) 模擬 manage_order 的變動，
    否則從資料庫抓取現有購物車。
    """
    if raw_items is None:
        items = db.query(models.CartItem).filter(models.CartItem.user_email == user_email).all()
        # 轉換為統一格式
        process_items = []
        for it in items:
            p = it.product
            process_items.append({
                "product_id": it.product_id,
                "product_name": p.name,
                "quantity": it.quantity,
                "price": p.price,
                "unit": p.unit,
                "supplier": p.supplier.name if p.supplier else "未知"
            })
    else:
        process_items = raw_items

    anns = db.query(models.Announcement).all()
    rules = []
    import re
    for a in anns:
        match = re.search(r"滿\s*(\d+)\s*送\s*([^\s,，。!！]+)", a.content + a.title)
        if match:
            rules.append({"threshold": float(match.group(1)), "gift_name": match.group(2).strip()})

    base_total = sum(float(it["price"]) * float(it["quantity"]) for it in process_items)
    
    # 找出最高的達標規則
    applied_rule = None
    if rules:
        rules.sort(key=lambda x: x["threshold"], reverse=True)
        for r in rules:
            if base_total >= r["threshold"]:
                applied_rule = r
                break

    res = []
    final_total = 0.0
    for it in process_items:
        item_is_gift = False
        # 這裡檢查是否符合贈品名稱
        if applied_rule and (applied_rule["gift_name"] in it["product_name"] or it["product_name"] in applied_rule["gift_name"]):
            item_is_gift = True
            applied_rule = None # 一則規則送一次
            
        res_item = {**it, "is_gift": item_is_gift}
        res_item["subtotal"] = 0.0 if item_is_gift else round(float(it["price"]) * float(it["quantity"]), 1)
        res.append(res_item)
        if not item_is_gift:
            final_total += res_item["subtotal"]
            
    return res, round(final_total, 1)

# --- Cart Endpoints ---

@app.get("/cart", response_model=List[CartItemOut])
async def get_cart_api(db: Session = Depends(get_db), current_user: str = Depends(auth.get_current_user)):
    res, _ = calculate_dynamic_cart(db, current_user)
    return res

@app.post("/cart")
async def sync_cart(data: CartSync, db: Session = Depends(get_db), current_user: str = Depends(auth.get_current_user)):
    # 簡單的全量覆蓋同步
    db.query(models.CartItem).filter(models.CartItem.user_email == current_user).delete()
    for it in data.items:
        new_item = models.CartItem(
            user_email=current_user,
            product_id=it["product_id"],
            quantity=it["quantity"]
        )
        db.add(new_item)
    db.commit()
    return {"status": "success"}

# --- Order & Chat Logic ---

@app.post("/chat-order")
async def chat_order(
    msg: ChatMessage,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.get_current_user)
):
    if not groq_client:
        raise HTTPException(status_code=500, detail="Groq API key not configured")
    
    # --- 歷史資料預處理 (Atomic Turn Filtering) ---
    raw_history = msg.history[-12:] if msg.history else []
    history_context = []
    
    # 建立一個地圖來確認 tool 回應是否存在
    tool_responses_ids = {h.get("tool_call_id") for h in raw_history if h.get("role") == "tool"}
    
    for i, h in enumerate(raw_history):
        role = h.get("role")
        content = h.get("content") or ""
        
        # 1. 移除顯式系統錯誤或標籤殘留 (不移除人機禮貌用語)
        if any(k in content for k in ["Error: ", "<function"]):
            continue
            
        # 2. 確保 Atomic Turn：如果 Assistant 有 tool_calls，必須確保後續有 tool 回應
        if role == "assistant" and h.get("tool_calls"):
            tcs = h.get("tool_calls")
            if not all(tc.get("id") in tool_responses_ids for tc in tcs):
                continue # 丟棄這個不完整的對話輪次，否則 API 會報錯
        
        # 3. 如果是 tool 角色但找不到對應的 assistant 調用 (雖然鮮見)，也丟棄
        if role == "tool" and not any(
            ah.get("role") == "assistant" and any(tc.get("id") == h.get("tool_call_id") for tc in ah.get("tool_calls") or [])
            for ah in raw_history[:i]
        ):
            continue
            
        history_context.append(h)

    # 指引清單 (增加類別感知，不改資料表)
    catalog = db.query(models.Product).all()
    snapshot = ""
    for p in catalog:
        cat = "蔬菜" if any(k in p.name for k in ["菜", "瓜", "豆"]) else "水果" if any(k in p.name or (p.description and k in p.description) for k in ["果", "莓", "桃"]) else "其他"
        snapshot += f"- {p.name} (ID:{p.id}) [類別:{cat}]\n"

    # 嘗試從歷史中提取最後一次成功的購物車狀態
    last_cart_items = []
    # 我們找最後一條含有 final_items 數據的 assistant 訊息（透過 context 模擬）
    # 但更直接的是找最後一個 manage_order 的 tool 呼叫結果
    for h in reversed(history_context):
        if h.get("role") == "tool" and h.get("name") == "manage_order":
            # 這裡我們很難從字串還原，但 AI 可以看見歷史。
            # 我們改在大腦指令中強化「看歷史」的要求。
            break

    system_prompt = f"""【人格設定：專業農產特助 3.0】
- 你不僅是特助，更是懂生活的農產專家。說話親切、重視細節。
- **排版與推薦美學**：
  1. **結構化**：必須使用 **Markdown 標題** (## 或 ###) 分段，搭配 **列點** 與 **粗體** 凸顯關鍵資訊。
  2. **深度動機**：推薦理由應結合 **產季現況**、**口感特色** 或 **料理搭配**。
     - ❌ 禁止說：因為您買過，所以推薦您。
     - ✅ 應該說：這款產品現在正值盛產，口感比您上次買時更鮮甜，非常適合搭配您的...。
  3. **換行與間隔**：分段之間請務必使用 **雙換行 (\\n\\n)**，避免文字堆疊。
  4. **擬人化敘述**：禁止機械式輸出「欄位: 值」。應將數據融入自然對話中（如將「產地: 小山, 價格: 0.0」優化為「由小山農場為您免費贈送」）。
- **嚴格庫存感知**：嚴禁推薦查詢結果中不存在的產品。
- **歷史情感連結**：若用戶詢問歷史，請調用工具並從中觀察用戶的 **口味偏好**（如：有機、特定產地）進行延伸推薦。

【回覆架構要求】
你的回覆應包含以下區塊：
1. 👋 **親切開場**：簡短打招呼。
2. 📝 **推薦/查詢清單**：使用標題與列點列出具體品項資訊。
3. 💡 **專家建議/說明**：簡述為什麼推薦或如何搭配。
4. ✅ **行動確認**：若已加入購物車，請明確告知。

【核心屬性：高效代辦】
1. **意向識別**：只有當用戶表現出明確的「行動意向」（如：我想買、幫我加、好喔幫我點一份、結帳）時，才發起工具調用。
2. **推薦不代表下單**：若用戶詢問建議或對比，只需進行 Markdown 回覆推薦內容，嚴禁無故自動將推薦品項塞入購物車。
3. **數據保真**：合文（Synthesis）階段必須 100% 採用工具回報的最鮮活數據。

【回覆範例 (格式參考)】
「您好！我是您的特助 👨‍🌾。根據您的需求，我推薦：
✨ **大湖直送草莓** (ID: 5)
   - 💰 $250 / 盒
   - 🍓 果實紮實、酸甜適口！
✨ **金山農友地瓜** (ID: 2)
   - 💰 $30 / 斤
   - 🍠 口感綿密、適合烤炸。

目前已為您將這些美味放入購物車囉！🧺」

【工具調用索引 (關鍵字導航)】
{snapshot}"""

    messages = [
        {"role": "system", "content": system_prompt},
        *history_context,
        {"role": "user", "content": msg.message}
    ]
    
    try:
        tool_results = []
        final_items = []
        total_amount = 0.0
        
        # 遞迴工具調用 (最多 3 輪)
        for _ in range(3):
            content_text = ""
            tool_calls = []
            
            try:
                completion = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    tools=TOOLS,
                    tool_choice="auto",
                    temperature=0
                )
                response_message = completion.choices[0].message
                tool_calls = response_message.tool_calls or []
                content_text = response_message.content or ""
            except Exception as ge:
                err_msg = str(ge)
                # 處理 Groq 的幻覺攔截 (Error 400: Failed to call a function)
                if "Failed to call a function" in err_msg or "failed_generation" in err_msg:
                    import re
                    # 嘗試從錯誤訊息中提取幻覺內容 (Groq 會在錯誤訊息中放入 failed_generation)
                    match_gen = re.search(r"'failed_generation':\s*'(.*?)'", err_msg)
                    if match_gen:
                        content_text = match_gen.group(1)
                        # 將轉義的引號與換行還原
                        content_text = content_text.replace("\\'", "'").replace("\\n", "\n")
                        # 已從 400 錯誤中恢復內容
                    else:
                        raise ge
                else:
                    raise ge
            
            # --- 幻覺修補器 (Hallucination Patch) ---
            # 如果模型沒給正式 tool_calls 但內容中有調用跡象，手動修補
            if not tool_calls and "function" in content_text:
                import re
                # 兼容 <function=name{...}> 或 function=name{...} 等多種變體
                # 使用 [\s\S]*? 以匹配跨行 JSON
                matches = re.findall(r'function[:=](\w+)\s*(\{[\s\S]*?\})', content_text)
                for f_name, f_args in matches:
                    from uuid import uuid4
                    # 清理內容，防止嵌套標籤干擾
                    clean_args = f_args.split("</function>")[0].strip()
                    class FakeTC:
                        def __init__(self, name, args):
                            self.id = f"call_{uuid4().hex[:12]}"
                            class Func:
                                def __init__(self, n, a):
                                    self.name = n
                                    self.arguments = a
                            self.function = Func(name, args)
                    tool_calls.append(FakeTC(f_name, clean_args))

            # 轉換為字典以確保序列化結構正確
            msg_dict = {"role": "assistant"}
            if tool_calls:
                msg_dict["content"] = None
                msg_dict["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    } for tc in tool_calls
                ]
            else:
                msg_dict["content"] = response_message.content
            messages.append(msg_dict)

            if not tool_calls:
                break # 沒有更多工具要叫，退出循環

            for tool_call in tool_calls:
                func_name = tool_call.function.name
                args_str = tool_call.function.arguments
                
                # 再次清理幻覺內容中的 JSON (有時模型會在標籤裡放不完整 JSON)
                try:
                    args = json.loads(args_str)
                except:
                    # 如果 JSON 解析失敗，嘗試極簡化修復或是帶空字串
                    args = {"search_query": ""}
                
                result_str = ""
                try:
                    if func_name in ["query_inventory", "lookup_products"]:
                        kw_str = args.get("search_query", "")
                        query = db.query(models.Product).join(models.Supplier)
                        if kw_str:
                            from sqlalchemy import or_, and_
                            # 支援空格多詞搜尋
                            keywords = kw_str.split()
                            filters = []
                            for kw in keywords:
                                filters.append(or_(
                                    models.Product.name.contains(kw),
                                    models.Product.description.contains(kw),
                                    models.Supplier.name.contains(kw)
                                ))
                            query = query.filter(and_(*filters))
                        p_list = query.all()
                        res = [{"id": p.id, "name": p.name, "supplier": p.supplier.name, "price": p.price, "unit": p.unit, "current_stock": p.available_stock, "description": p.description} for p in p_list]
                        result_str = json.dumps(res, ensure_ascii=False)
                        tool_results.append(f"產品查詢結果: {result_str}")
                    
                    elif func_name == "manage_order":
                        items = args.get("items", [])
                        # 同步到資料庫前，合併相同 ID 的數量並過濾有效品項
                        merged_items = {} # {product_id: sum_quantity}
                        for it in items:
                            pid = it["product_id"]
                            qty = it["quantity"]
                            merged_items[pid] = merged_items.get(pid, 0) + qty
                            
                        valid_items = []
                        for pid, qty in merged_items.items():
                            p = db.query(models.Product).filter(models.Product.id == pid).first()
                            if p:
                                final_qty = min(qty, p.available_stock) if p.available_stock > 0 else 0
                                if final_qty > 0:
                                    valid_items.append({
                                        "product_id": p.id, "product_name": p.name, 
                                        "supplier": p.supplier.name if p.supplier else "未知",
                                        "price": p.price, "unit": p.unit, "quantity": final_qty
                                    })
                        
                        # 清空並重寫 DB
                        db.query(models.CartItem).filter(models.CartItem.user_email == current_user).delete()
                        for v in valid_items:
                            db.add(models.CartItem(user_email=current_user, product_id=v["product_id"], quantity=v["quantity"]))
                        db.commit()
                        
                        # 使用統一邏輯計算結果
                        final_items, total_amount = calculate_dynamic_cart(db, current_user)
                        result_str = f"已更新訂單清單，目前共 {len(final_items)} 項，總結帳額 {total_amount}"
                        tool_results.append(result_str)
                    
                    elif func_name == "get_cart":
                        final_items, total_amount = calculate_dynamic_cart(db, current_user)
                        result_str = f"當前購物車內容: {json.dumps(final_items, ensure_ascii=False)}，結帳金額 {total_amount}"
                        tool_results.append(result_str)

                    elif func_name == "check_news":
                        anns = db.query(models.Announcement).order_by(models.Announcement.date.desc()).limit(3).all()
                        res = [f"{a.title}: {a.content}" for a in anns]
                        result_str = "; ".join(res)
                        tool_results.append(f"最新公告: {result_str}")

                    elif func_name == "get_order_history":
                        orders = db.query(models.Order).filter(models.Order.user_email == current_user).order_by(models.Order.created_at.desc()).all()
                        hist = []
                        for o in orders:
                            # 強化結構，讓 AI 絕對不會把日期跟品項搞混
                            items_summary = ", ".join([f"· {oi.product.name}(產地:{oi.product.supplier.name})x{oi.quantity}" for oi in o.items])
                            hist.append(f"【日期: {o.created_at.date()}】訂單#{o.id} - 總額{o.total_amount}元 - 品項明細: [{items_summary}]")
                        result_str = "系統歷史紀錄回傳內容: \n" + ("\n".join(hist) if hist else "該帳號目前無歷史購買紀錄")
                        tool_results.append(result_str)
                    else:
                        result_str = f"錯誤：找不到工具 {func_name}"
                except Exception as te:
                    result_str = f"執行工具時發生錯誤: {str(te)}"

                # 反饋回歷史記錄
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": func_name,
                    "content": result_str
                })

        # --- 重要：在合成回覆前，必須重新獲取最新的購物車快照，否則 AI 會基於舊數據產生幻覺 ---
        final_items, total_amount = calculate_dynamic_cart(db, current_user)

        # --- 第二階段：內容合成 (Synthesis) ---
        # 僅提取對話內容，將包含 tool_calls 的 assistant 訊息轉化為輔助語句以提升合成穩定性
        safe_history = []
        for h in history_context[-12:]:
            role = h.get("role")
            content = h.get("content")
            if role == "user" and content:
                safe_history.append({"role": "user", "content": content})
            elif role == "assistant":
                if content:
                    safe_history.append({"role": "assistant", "content": content})
                elif h.get("tool_calls"):
                    # 將工具調用轉化為自然語言提示，讓合成階段的 AI 知道剛才發生了什麼（例如「正在查詢庫存...」）
                    safe_history.append({"role": "assistant", "content": "好的，我正在為您處理中..."})

        synthesis_prompt = f"""你是「新鮮農產」特助。請根據以下【實時數據】為用戶提供專業回覆。

【實時數據 (唯一可信來源)】
{"; ".join(tool_results) if tool_results else "（無新增數據。若用戶有意點餐，請引導他查看目錄或直接提出需求）"}

【回饋準則 - 數據一致性核心】
1. **數據真實性 (Data Fidelity)**：
   - 輸出的 `json` 資料(`data.items`)必須與【實時數據】回傳的「目前購物車內容」**完全一致**。禁止自行增刪品項、禁止遺漏任何一項！
   - 若數據回傳總額為 1000，則清單加總必須等於 1000。
2. **供應商/產地強制標註**：
   - 在 Markdown 列表說明中，**每一項產品** 之後必須緊跟著標註其 **[供應商/產地]**（如：高麗菜 [小山農場]）。
   - 禁止只寫品項名稱而不寫產地。
3. **歷史絕對精準**：
   - 歷史清單必須包含產地，且嚴禁將 02-12 的品項對應到其他日期。
4. **格式與美學**：
   - 使用 **Markdown 標題** (###) 與 **列點**。
   - 分段之間務必使用 **雙換行 (\\n\\n)**。
   - 若價格為 0.0，稱之為「免費贈送」。
5. **格式要求**：必須以 **json** 回傳：{{"response": "你的結構化 Markdown 回覆", "intent": "ORDER/NONE", "data": {{...}}}}。

【目前訂單快照】
{json.dumps(final_items, ensure_ascii=False)}
"""
        
        final_completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": synthesis_prompt},
                *safe_history,
                {"role": "user", "content": msg.message}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        try:
            synthesis_data = json.loads(final_completion.choices[0].message.content)
            final_response = synthesis_data.get("response", "理解您的意圖時遇到了一點小阻礙，可以請您換個方式告訴我嗎？")
        except:
            final_response = final_completion.choices[0].message.content or "系統忙碌中，請稍後再試。"

        # 封裝結果
        is_order = bool(final_items or any("已更新訂單" in r or "購物車" in r for r in tool_results))
        result = {
            "response": final_response,
            "intent": "ORDER" if is_order else "INFO",
            "data": None
        }
        
        if is_order:
            user_obj = db.query(models.User).filter(models.User.email == current_user).first()
            gift_ids = [it["product_id"] for it in final_items if it.get("is_gift")]
            result["data"] = {
                "items": final_items,
                "total_amount": round(total_amount, 2),
                "gift_ids": gift_ids,
                "default_shipping": {
                    "phone": (user_obj.phone if user_obj else "") or "",
                    "address": (user_obj.shipping_address if user_obj else "") or ""
                }
            }
        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Agent error: {e}")
        return {"response": f"抱歉，處理您的要求時發生錯誤：{str(e)}", "intent": "GENERAL", "data": None}

@app.post("/confirm-order")
async def confirm_order(
    req: OrderConfirmRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.get_current_user)
):
    try:
        new_order = models.Order(
            user_email=current_user,
            total_amount=req.total_amount,
            payment_method=req.payment_method,
            payment_status="待付款",
            receiver_phone=req.receiver_phone,
            receiver_address=req.receiver_address,
            status="已建立"
        )
        db.add(new_order)
        db.flush()
        
        for item in req.items:
            product = db.query(models.Product).filter(models.Product.id == item["product_id"]).first()
            if not product or product.available_stock < item["quantity"]:
                raise Exception(f"產品 {product.name if product else item['product_id']} 可購買庫存不足")
            
            # 贈品邏輯：價格覆寫為 0
            final_price = 0.0 if item.get("is_gift") else item["price_at_order"]

            oi = models.OrderItem(
                order_id=new_order.id,
                product_id=item["product_id"],
                quantity=item["quantity"],
                price_at_order=final_price
            )
            db.add(oi)
            # 預扣「可購買庫存」
            product.available_stock -= item["quantity"]
            
        db.commit()
        return {"message": "訂單已預約，可購買庫存已扣除", "order_id": new_order.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/admin/orders/{order_id}/ship")
def ship_order(
    order_id: int, 
    db: Session = Depends(get_db), 
    admin: str = Depends(auth.get_current_admin)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status == "已出貨":
        raise HTTPException(status_code=400, detail="訂單已是出貨狀態")
    
    if order.status == "已取消":
        raise HTTPException(status_code=400, detail="無法出貨已取消的訂單")

    # 扣除「實際庫存」
    for item in order.items:
        product = item.product
        if product:
            product.stock -= item.quantity
            
    order.status = "已出貨"
    db.commit()
    return {"message": "出貨成功，已核銷實體庫存", "order_id": order_id}

@app.get("/my-orders", response_model=List[OrderOut])
def list_my_orders(db: Session = Depends(get_db), current_user: str = Depends(auth.get_current_user)):
    orders = db.query(models.Order).filter(models.Order.user_email == current_user).order_by(models.Order.created_at.desc()).all()
    res = []
    for o in orders:
        items = []
        for it in o.items:
            items.append({
                "product_id": it.product_id,
                "product_name": it.product.name if it.product else "未知",
                "supplier": it.product.supplier.name if (it.product and it.product.supplier) else "未知",
                "unit": it.product.unit if it.product else "",
                "quantity": it.quantity,
                "price_at_order": it.price_at_order,
                "subtotal": it.quantity * it.price_at_order
            })
        o_dict = {c.name: getattr(o, c.name) for c in o.__table__.columns}
        o_dict["items"] = items
        o_dict["created_at"] = o.created_at
        res.append(o_dict)
    return res

# --- Admin Shipping & Payment Management ---

@app.get("/admin/orders", response_model=List[OrderOut])
def list_all_orders(db: Session = Depends(get_db), admin: str = Depends(auth.get_current_admin)):
    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    res = []
    for o in orders:
        items = []
        for it in o.items:
            items.append({
                "product_id": it.product_id, 
                "product_name": it.product.name if it.product else "未知",
                "supplier": it.product.supplier.name if (it.product and it.product.supplier) else "未知",
                "unit": it.product.unit if it.product else "",
                "quantity": it.quantity,
                "price_at_order": it.price_at_order,
                "subtotal": it.quantity * it.price_at_order
            })
        o_dict = {c.name: getattr(o, c.name) for c in o.__table__.columns}
        o_dict["items"] = items
        res.append(o_dict)
    return res

@app.patch("/admin/orders/{order_id}/shipping")
def update_shipping(
    order_id: int, 
    shipping_date: str, 
    db: Session = Depends(get_db), 
    admin: str = Depends(auth.get_current_admin)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(status_code=404)
    order.shipping_date = shipping_date
    db.commit()
    return {"message": "出貨日期已更新", "shipping_date": shipping_date}

@app.patch("/admin/orders/{order_id}/payment")
def update_payment(
    order_id: int, 
    status: str, 
    db: Session = Depends(get_db), 
    admin: str = Depends(auth.get_current_admin)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order: raise HTTPException(status_code=404)
    order.payment_status = status
    db.commit()
    return {"message": "支付狀態已更新", "status": status}

# --- Announcements & Wishes (Keep basic functionality) ---

@app.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...), 
    import_type: str = "products", # products or losses
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    content = await file.read()
    
    # 嘗試不同編碼讀取
    df = None
    for enc in ["utf-8-sig", "utf-8", "big5", "cp950"]:
        try:
            df = pd.read_csv(io.BytesIO(content), encoding=enc)
            break
        except:
            continue
            
    if df is None:
        raise HTTPException(status_code=400, detail="無法識別 CSV 編碼，請使用 UTF-8 格式")

    # 清理欄位名稱空白與處理可能的空值
    df.columns = [c.strip() for c in df.columns]
    df = df.fillna({
        "安全庫存": 0,
        "描述": "",
        "庫存": 0,
        "單價": 0
    })
    
    if import_type == "products":
        # 預期欄位: 產品名稱, 供應商名稱, 庫存, 安全庫存, 單位, 單價, 描述
        required = ["產品名稱", "供應商名稱", "庫存", "單位", "單價"]
        missing = [col for col in required if col not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"CSV 缺少必要欄位: {', '.join(missing)}。請檢查欄位名稱是否正確。")
        
        for _, row in df.iterrows():
            s_name = str(row["供應商名稱"]).strip()
            supplier = db.query(models.Supplier).filter(models.Supplier.name == s_name).first()
            if not supplier:
                supplier = models.Supplier(name=s_name)
                db.add(supplier)
                db.flush() # 確保取得 ID
            
            p_name = str(row["產品名稱"]).strip()
            product = db.query(models.Product).filter(
                models.Product.name == p_name, 
                models.Product.supplier_id == supplier.id
            ).first()
            
            if not product:
                product = models.Product(
                    name=p_name,
                    supplier_id=supplier.id,
                    available_stock=float(row["庫存"]),
                    stock=float(row["庫存"]),
                    safety_stock=float(row.get("安全庫存", 0)),
                    unit=str(row["單位"]),
                    price=float(row["單價"]),
                    description=str(row.get("描述", ""))
                )
                db.add(product)
            else:
                # 累加
                qty = float(row["庫存"])
                product.stock += qty
                product.available_stock += qty
        
    elif import_type == "losses":
        # 預期欄位: 產品名稱, 供應商名稱, 損耗數量, 原因, 日期
        required = ["產品名稱", "供應商名稱", "損耗數量", "原因", "日期"]
        missing = [col for col in required if col not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"CSV 缺少必要欄位: {', '.join(missing)}")

        for _, row in df.iterrows():
            p_name = str(row["產品名稱"]).strip()
            s_name = str(row["供應商名稱"]).strip()
            
            product = db.query(models.Product).join(models.Supplier).filter(
                models.Product.name == p_name,
                models.Supplier.name == s_name
            ).first()
            
            if not product:
                continue 
                
            qty = float(row["損耗數量"])
            loss = models.ProductLoss(
                product_id=product.id,
                quantity=qty,
                reason=str(row["原因"]),
                loss_date=str(row["日期"])
            )
            db.add(loss)
            product.stock -= qty
            product.available_stock -= qty
    
    db.commit()
    return {"message": f"Successfully imported {len(df)} records for {import_type}"}

# --- Product Loss Endpoints ---

@app.post("/admin/losses")
def create_loss(
    p_id: int, 
    qty: float, 
    reason: str, 
    date: str, 
    db: Session = Depends(get_db), 
    admin: str = Depends(auth.get_current_admin)
):
    product = db.query(models.Product).filter(models.Product.id == p_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product.stock < qty:
        raise HTTPException(status_code=400, detail="Stock insufficient to record loss")
        
    loss = models.ProductLoss(
        product_id=p_id,
        quantity=qty,
        reason=reason,
        loss_date=date
    )
    db.add(loss)
    product.stock -= qty
    product.available_stock -= qty
    
    db.commit()
    return {"message": "Loss recorded", "new_stock": product.stock}

@app.get("/admin/losses")
def list_losses(db: Session = Depends(get_db), admin: str = Depends(auth.get_current_admin)):
    losses = db.query(models.ProductLoss).order_by(models.ProductLoss.loss_date.desc()).all()
    res = []
    for l in losses:
        res.append({
            "id": l.id,
            "product_name": l.product.name,
            "supplier_name": l.product.supplier.name if l.product.supplier else "未知",
            "quantity": l.quantity,
            "reason": l.reason,
            "loss_date": l.loss_date
        })
    return res

@app.get("/announcements")
def get_announcements(db: Session = Depends(get_db)):
    return db.query(models.Announcement).order_by(models.Announcement.date.desc()).all()

@app.post("/admin/announcements")
def create_ann(ann: dict, db: Session = Depends(get_db), admin: str = Depends(auth.get_current_admin)):
    db_ann = models.Announcement(title=ann["title"], content=ann["content"], date=ann["date"])
    db.add(db_ann)
    db.commit()
    db.refresh(db_ann)
    return db_ann

@app.patch("/admin/announcements/{ann_id}")
def update_ann(ann_id: int, ann_data: dict, db: Session = Depends(get_db), admin: str = Depends(auth.get_current_admin)):
    db_ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not db_ann: raise HTTPException(status_code=404)
    for k, v in ann_data.items(): setattr(db_ann, k, v)
    db.commit()
    db.refresh(db_ann)
    return db_ann

@app.delete("/admin/announcements/{ann_id}")
def delete_ann(ann_id: int, db: Session = Depends(get_db), admin: str = Depends(auth.get_current_admin)):
    db_ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not db_ann: raise HTTPException(status_code=404)
    db.delete(db_ann)
    db.commit()
    return {"message": "Announcement deleted"}

@app.post("/wishes")
def create_wish(wish: dict, db: Session = Depends(get_db), user: str = Depends(auth.get_current_user)):
    db_wish = models.Wish(user_email=user, content=wish["content"], category=wish["category"])
    db.add(db_wish)
    db.commit()
    return db_wish
