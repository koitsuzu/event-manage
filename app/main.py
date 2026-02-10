from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
import datetime
from pydantic import BaseModel

from . import models, auth, database
from .database import engine, get_db, settings
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from fastapi import BackgroundTasks
import asyncio

# 初始化資料庫
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="活動管理系統 API")

# CORS 設定 (支援多來源：本機 + 雲端)
allowed_origins = [url.strip() for url in settings.FRONTEND_URL.split(",") if url.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def check_marketing_loop():
    """
    每分鐘檢查一次是否有需發送的行銷郵件
    """
    while True:
        try:
            # 必須在每輪循環中手動開啟 Session 確保連線可控
            db = next(get_db())
            try:
                count = check_marketing_mails(db, None)
                if count > 0:
                    print(f"Background automation: Sent {count} marketing emails at {datetime.datetime.now()}")
            finally:
                db.close()
        except Exception as e:
            print(f"Error in background marketing loop: {e}")
        
        await asyncio.sleep(60) # 每分鐘檢查一次

@app.on_event("startup")
async def startup_event():
    # 伺服器啟動時自動檢查一次當日是否有待催繳活動
    db = next(get_db())
    try:
        r_count = check_reminders(db, None) 
        m_count = check_marketing_mails(db, None)
        if r_count > 0 or m_count > 0:
            print(f"Startup check: Sent {r_count} reminders and {m_count} marketing emails.")
    finally:
        db.close()
    
    # 啟動長駐背景行銷檢查
    asyncio.create_task(check_marketing_loop())

@app.get("/auth/login-url")
def get_login_url():
    from urllib.parse import quote
    # 簡單回傳 Google OAuth 連結給前端
    scope = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
    encoded_callback = quote(settings.GOOGLE_CALLBACK_URL, safe="")
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={encoded_callback}&response_type=code&scope={scope}"
    )
    return {"url": url}

@app.get("/auth/callback")
async def auth_callback(code: str, db: Session = Depends(get_db)):
    # 處理 Google OAuth callback 並核發 JWT
    user_info = await auth.get_google_user_info(code)
    
    email = user_info["email"]
    access_token = auth.create_access_token(data={"sub": email})
    
    # 確保使用者存在於 User 資料表
    user_record = db.query(models.User).filter(models.User.email == email).first()
    if not user_record:
        user_record = models.User(
            email=email,
            display_name=user_info.get("name", email.split("@")[0]),
            birthday=""
        )
        db.add(user_record)
        db.commit()

    # 回傳是否為管理員
    is_admin = email in settings.admin_list
    
    # 顯式序列化以確保資料完整性
    from fastapi.encoders import jsonable_encoder
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user": jsonable_encoder(user_record),
        "is_admin": is_admin
    }

class UserProfileUpdate(BaseModel):
    display_name: str
    birthday: str

class UserOut(BaseModel):
    email: str
    display_name: str
    birthday: str
    is_vip: int
    is_admin: bool
    class Config:
        from_attributes = True

class AnnouncementBase(BaseModel):
    title: str
    content: str
    date: str
    event_link_id: int = None

class AnnouncementCreate(AnnouncementBase):
    pass

class AnnouncementOut(AnnouncementBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class WishBase(BaseModel):
    content: str
    category: str

class WishCreate(WishBase):
    pass

class WishOut(WishBase):
    id: int
    user_email: str
    created_at: datetime.datetime
    class Config:
        from_attributes = True

class EventBase(BaseModel):
    name: str
    date: datetime.datetime
    description: str = None
    amount: float
    reminder_date: str = None # YYYY-MM-DD
    reminder_deadline: str = None # YYYY-MM-DD

class EventCreate(EventBase):
    pass

class EventOut(EventBase):
    id: int
    class Config:
        from_attributes = True

class MarketingMailBase(BaseModel):
    subject: str
    content: str
    scheduled_date: str # YYYY-MM-DD
    scheduled_time: str = "09:00" # HH:MM

class MarketingMailCreate(MarketingMailBase):
    pass

class MarketingMailOut(MarketingMailBase):
    id: int
    scheduled_time: str
    is_sent: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True

@app.get("/me", response_model=UserOut)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.get_current_user)
):
    # 取得當前使用者 Profile，如果不存在補齊一筆 (解決舊 Session 問題)
    user = db.query(models.User).filter(models.User.email == current_user).first()
    if not user:
        user = models.User(
            email=current_user,
            display_name=current_user.split("@")[0],
            birthday=""
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # 動態判定是否為管理員，確保 .env 修改後同步
    user_dict = {c.name: getattr(user, c.name) for c in user.__table__.columns}
    user_dict["is_admin"] = current_user in settings.admin_list
    return user_dict

@app.patch("/me")
def update_my_profile(
    profile: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.get_current_user)
):
    # 更新當前使用者 Profile
    user = db.query(models.User).filter(models.User.email == current_user).first()
    if not user:
        user = models.User(
            email=current_user,
            display_name=profile.display_name,
            birthday=profile.birthday
        )
        db.add(user)
    else:
        user.display_name = profile.display_name
        user.birthday = profile.birthday
    
    # [同步更新] 將此使用者所有歷史報名的姓名與生日一併更新
    db.query(models.Registration).filter(models.Registration.email == current_user).update({
        "user_name": profile.display_name,
        "birthday": profile.birthday
    })
    
    db.commit()
    db.refresh(user)
    return user

# --- Mail Utilities ---

# --- Mail Utilities ---

def send_registration_email(to_email: str, user_name: str, event_name: str, amount: float, participant_count: int, deadline: str):
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        print("Mail settings not configured, skipping email.")
        return

    total_amount = amount * participant_count
    subject = f"【活動報名確認】{event_name} - 報名成功通知"
    
    body = f"""
    <html>
    <body style="font-family: 'Microsoft JhengHei', sans-serif; color: #4A4A4A; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #D2B48C20; border-radius: 20px; background-color: #FDFCF9;">
            <h2 style="color: #B87333; border-bottom: 2px solid #B8733310; padding-bottom: 10px;">報名成功通知</h2>
            <p>親愛的 <strong>{user_name}</strong> 您好：</p>
            <p>感謝您的參與！您已成功報名以下活動，請於截止日前完成繳費以保留名額。</p>
            
            <div style="background-color: #F9F7F2; padding: 20px; border-radius: 15px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>活動名稱：</strong> {event_name}</p>
                <p style="margin: 5px 0;"><strong>報名人數：</strong> {participant_count} 位</p>
                <p style="margin: 5px 0;"><strong>單人金額：</strong> ${amount}</p>
                <p style="margin: 30px 0 5px 0; font-size: 1.2em; color: #B87333;"><strong>應繳總金額： ${total_amount}</strong></p>
            </div>
            
            <div style="background-color: #FFF5F5; padding: 15px; border-radius: 10px; border-left: 5px solid #E53E3E;">
                <p style="margin: 0; color: #C53030; font-weight: bold;">🚨 繳費截止日期：{deadline}</p>
            </div>
            
            <p style="margin-top: 30px; font-size: 0.9em; color: #A0A095;">
                <strong>※ 若您已完成繳費，請忽略此信件。</strong><br>
                ※ 本郵件由系統自動發出，請勿直接回覆。<br>
                ※ 如有任何問題，請洽詢活動管理員。
            </p>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart()
    sender_name = settings.MAIL_FROM if settings.MAIL_FROM else "活動管理系統"
    msg['From'] = formataddr((sender_name, settings.MAIL_USERNAME))
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    try:
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"Email sent successfully to {to_email}")
    except Exception as e:
        print(f"Failed to send email: {e}")

def send_reminder_email(to_email: str, user_name: str, event_name: str, amount: float, participant_count: int, deadline: str):
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        print("Mail settings not configured, skipping reminder.")
        return

    total_amount = amount * participant_count
    subject = f"【補繳提醒】{event_name} - 活動費用繳費通知"
    
    body = f"""
    <html>
    <body style="font-family: 'Microsoft JhengHei', sans-serif; color: #4A4A4A; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #D2B48C20; border-radius: 20px; background-color: #FDFCF9;">
            <h2 style="color: #4A4A4A; border-bottom: 2px solid #D2B48C10; padding-bottom: 10px;">活動補繳提醒</h2>
            <p>親愛的 <strong>{user_name}</strong> 您好：</p>
            <p>提醒您，您報名的活動目前尚未紀錄繳費資訊。為了確保您的報名名額，請務必於下方期限前完成補繳。</p>
            
            <div style="background-color: #F9F7F2; padding: 20px; border-radius: 15px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>活動名稱：</strong> {event_name}</p>
                <p style="margin: 5px 0;"><strong>報名人數：</strong> {participant_count} 位</p>
                <p style="margin: 30px 0 5px 0; font-size: 1.2em; color: #B87333;"><strong>應繳總金額： ${total_amount}</strong></p>
            </div>
            
            <div style="background-color: #FFF5F5; padding: 15px; border-radius: 10px; border-left: 5px solid #E53E3E;">
                <p style="margin: 0; color: #C53030; font-weight: bold;">🚨 補繳截止日期：{deadline}</p>
                <p style="margin: 5px 0 0 0; font-size: 0.85em; color: #C53030;">※ 建議於 3 天內儘速辦理，逾期名額將自動釋出。</p>
            </div>
            
            <br>
            <p style="font-size: 0.9em; color: #A0A095;">
                <strong>※ 若您已完成繳費，請忽略此信。</strong><br>
                ※ 本郵件由系統自動發出，請勿直接回覆。<br>
                ※ 如有任何問題，請連繫管理員更新狀態。
            </p>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart()
    sender_name = settings.MAIL_FROM if settings.MAIL_FROM else "活動管理系統"
    msg['From'] = formataddr((sender_name, settings.MAIL_USERNAME))
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    try:
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"Reminder email sent successfully to {to_email}")
    except Exception as e:
        print(f"Failed to send reminder email: {e}")

def send_marketing_email(to_email: str, subject: str, content: str):
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        print("Mail settings not configured, skipping marketing mail.")
        return

    body = f"""
    <html>
    <body style="font-family: 'Microsoft JhengHei', sans-serif; color: #4A4A4A; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #D2B48C20; border-radius: 20px; background-color: #FDFCF9;">
            <h2 style="color: #B87333; border-bottom: 2px solid #B8733310; padding-bottom: 10px;">優質成員專屬推廣</h2>
            <div style="margin: 20px 0; color: #4A4A4A; font-size: 1.1em; white-space: pre-line;">
                {content}
            </div>
            
            <p style="margin-top: 40px; font-size: 0.9em; color: #A0A095; border-top: 1px solid #eee; pt-20">
                ※ 本郵件為您作為我們的好顧客專屬收到。<br>
                ※ 若您不想再收到此類訊息，請聯繫管理員。
            </p>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart()
    sender_name = settings.MAIL_FROM if settings.MAIL_FROM else "活動管理系統"
    msg['From'] = formataddr((sender_name, settings.MAIL_USERNAME))
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    try:
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"Marketing email sent successfully to {to_email}")
    except Exception as e:
        print(f"Failed to send marketing email: {e}")

def send_new_event_notification(to_email: str, user_name: str, event_name: str, event_date: str, event_amount: float, event_desc: str):
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        return

    subject = f"✨【好顧客專屬】新活動發佈：{event_name}"
    
    body = f"""
    <html>
    <body style="font-family: 'Microsoft JhengHei', sans-serif; color: #4A4A4A; line-height: 1.6;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #D2B48C20; border-radius: 20px; background-color: #FDFCF9;">
            <h2 style="color: #B87333; border-bottom: 2px solid #B8733310; padding-bottom: 10px;">✨ 精彩新活動邀約</h2>
            <p>親愛的 <strong>{user_name}</strong> 您好：</p>
            <p>感謝您一直以來對我們的支持！我們剛剛推出了一個全新的活動，誠摯地邀請您搶先了解與報名：</p>
            
            <div style="background-color: #F9F7F2; padding: 25px; border-radius: 20px; margin: 25px 0; border: 1px dashed #D2B48C60;">
                <h3 style="color: #4A4A4A; margin-top: 0;">{event_name}</h3>
                <p style="margin: 8px 0;"><strong>📅 活動日期：</strong> {event_date}</p>
                <p style="margin: 8px 0;"><strong>💰 活動金額：</strong> ${event_amount}</p>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #D2B48C20; font-size: 0.95em; color: #666;">
                    {event_desc}
                </div>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
                <a href="{settings.FRONTEND_URL}" style="background-color: #B87333; color: white; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(184, 115, 51, 0.2);">立即前往查看詳情</a>
            </p>
            
            <p style="margin-top: 40px; font-size: 0.85em; color: #A0A095; border-top: 1px solid #eee; padding-top: 20px;">
                ※ 本郵件為您作為我們的好顧客專屬優先收到。<br>
                ※ 若您不想再收到此类訊息，請聯繫管理員。
            </p>
        </div>
    </body>
    </html>
    """

    msg = MIMEMultipart()
    sender_name = settings.MAIL_FROM if settings.MAIL_FROM else "活動管理系統"
    msg['From'] = formataddr((sender_name, settings.MAIL_USERNAME))
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    try:
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"New event notification sent to {to_email}")
    except Exception as e:
        print(f"Failed to send event notification: {e}")

def check_reminders(db: Session, background_tasks: BackgroundTasks = None):
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    # 找出執行日為今日且尚未截止的活動
    events = db.query(models.Event).filter(models.Event.reminder_date == today).all()
    
    count = 0
    for event in events:
        # 找出該活動下待付款的人
        pendings = [r for r in event.registrations if r.payment_status == "待付款"]
        for r in pendings:
            if background_tasks:
                background_tasks.add_task(
                    send_reminder_email,
                    to_email=r.email,
                    user_name=r.user_name,
                    event_name=event.name,
                    amount=event.amount,
                    participant_count=r.participant_count,
                    deadline=event.reminder_deadline
                )
            else:
                # 無背景任務時 (例如 Startup)，直接同步發送
                send_reminder_email(
                    to_email=r.email,
                    user_name=r.user_name,
                    event_name=event.name,
                    amount=event.amount,
                    participant_count=r.participant_count,
                    deadline=event.reminder_deadline
                )
            count += 1
    return count

def check_marketing_mails(db: Session, background_tasks: BackgroundTasks = None):
    now = datetime.datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    current_time_str = now.strftime("%H:%M")
    
    # 找出當日(或之前已過期)需發送且尚未發送的行銷郵件
    # 邏輯：日期相等且時間已到，或者日期小於今天（補發漏掉的）
    mails = db.query(models.MarketingMail).filter(
        models.MarketingMail.is_sent == 0,
        (
            (models.MarketingMail.scheduled_date < today_str) |
            ((models.MarketingMail.scheduled_date == today_str) & (models.MarketingMail.scheduled_time <= current_time_str))
        )
    ).all()
    
    total_count = 0
    if not mails:
        return 0
        
    vips = db.query(models.User).filter(models.User.is_vip == 1).all()
    if not vips:
        return 0
        
    for mail in mails:
        for vip in vips:
            if background_tasks:
                background_tasks.add_task(
                    send_marketing_email,
                    to_email=vip.email,
                    subject=mail.subject,
                    content=mail.content
                )
            else:
                send_marketing_email(
                    to_email=vip.email,
                    subject=mail.subject,
                    content=mail.content
                )
            total_count += 1
        mail.is_sent = 1
        db.commit()
    return total_count

@app.get("/events")
def list_events(db: Session = Depends(get_db)):
    # 公開介面，回傳活動列表
    return db.query(models.Event).all()

@app.post("/events/{event_id}/register")
def register_for_event(
    event_id: int, 
    birthday: str,
    user_name: str,
    background_tasks: BackgroundTasks, # 修正注入
    participant_count: int = 1,
    notes: str = None,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.get_current_user)
):
    # 一般使用者報名活動
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="活動不存在")
    
    # 檢查是否已報名
    existing = db.query(models.Registration).filter(
        models.Registration.event_id == event_id,
        models.Registration.email == current_user
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="您已經報名過此活動")

    # 建立報名資料
    registration = models.Registration(
        event_id=event_id,
        user_name=user_name,
        birthday=birthday,
        email=current_user,
        payment_status="待付款",
        participant_count=participant_count,
        notes=notes,
        registration_date=datetime.datetime.utcnow()
    )
    db.add(registration)
    db.commit()

    # 計算截止日 (+3 天)
    deadline_date = datetime.datetime.utcnow() + datetime.timedelta(days=3)
    deadline_str = deadline_date.strftime("%Y-%m-%d")

    # 發送通知信 (背景執行)
    if background_tasks:
        background_tasks.add_task(
            send_registration_email,
            to_email=current_user,
            user_name=user_name,
            event_name=event.name,
            amount=event.amount,
            participant_count=participant_count,
            deadline=deadline_str
        )

    return {"message": "報名成功", "total_amount": event.amount * participant_count, "deadline": deadline_str}

@app.get("/my-registrations")
def list_my_registrations(
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.get_current_user)
):
    # 回傳當前使用者的報名紀錄
    return db.query(models.Registration).filter(models.Registration.email == current_user).all()

@app.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    content = await file.read()
    df = pd.read_csv(io.BytesIO(content))
    
    # 欄位對應: 活動名, 活動日期, 金額, 活動簡介, 報名者姓名, 生日, 信箱, 付款狀態, 報名日期
    required_cols = ["活動名", "活動日期", "金額", "活動簡介", "報名者姓名", "生日", "信箱", "付款狀態", "報名日期"]
    for col in required_cols:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Missing column: {col}")

    for _, row in df.iterrows():
        # 1. 處理活動 (如果活動不存在則建立)
        event_name = str(row["活動名"])
        event = db.query(models.Event).filter(models.Event.name == event_name).first()
        if not event:
            event = models.Event(
                name=event_name,
                date=pd.to_datetime(row["活動日期"]),
                amount=float(row["金額"]),
                description=str(row["活動簡介"])
            )
            db.add(event)
            db.commit()
            db.refresh(event)

        # 2. 處理使用者 (確保 User 資料表有紀錄，因為 Registration.email 是 FK)
        user_email = str(row["信箱"])
        user_record = db.query(models.User).filter(models.User.email == user_email).first()
        if not user_record:
            user_record = models.User(
                email=user_email,
                display_name=str(row["報名者姓名"]),
                birthday=str(row["生日"])
            )
            db.add(user_record)
            db.commit()

        # 3. 處理報名資料
        registration = models.Registration(
            event_id=event.id,
            user_name=str(row["報名者姓名"]),
            birthday=str(row["生日"]),
            email=user_email,
            payment_status=str(row["付款狀態"]),
            registration_date=pd.to_datetime(row["報名日期"])
        )
        db.add(registration)
    
    db.commit()
    db.commit()
    return {"message": f"Successfully imported {len(df)} records"}

# --- Events Admin CRUD ---

@app.post("/admin/events", response_model=EventOut)
def create_event(
    event: EventCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    db_event = models.Event(**event.dict())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    # [自動化] 找出所有 VIP 並發送新活動邀請
    vips = db.query(models.User).filter(models.User.is_vip == 1).all()
    event_date_str = db_event.date.strftime("%Y-%m-%d %H:%M")
    
    for vip in vips:
        background_tasks.add_task(
            send_new_event_notification,
            to_email=vip.email,
            user_name=vip.display_name,
            event_name=db_event.name,
            event_date=event_date_str,
            event_amount=db_event.amount,
            event_desc=db_event.description or "暫無簡介"
        )
        
    return db_event

@app.patch("/admin/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    event: EventCreate,
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    db_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    for key, value in event.dict().items():
        setattr(db_event, key, value)
    
    db.commit()
    db.refresh(db_event)
    return db_event

@app.delete("/admin/events/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    db_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    db.delete(db_event)
    db.commit()
    return {"message": "Event deleted successfully"}

@app.get("/admin/events/{event_id}/registrations")
def get_registrations_admin(
    event_id: int, 
    db: Session = Depends(get_db), 
    admin_user: str = Depends(auth.get_current_admin)
):
    # 管理員查看特定活動的所有報名
    return db.query(models.Registration).filter(models.Registration.event_id == event_id).all()

@app.patch("/registrations/{reg_id}/payment")
def update_payment(
    reg_id: int, 
    status: str, 
    db: Session = Depends(get_db), 
    admin_user: str = Depends(auth.get_current_admin)
):
    reg = db.query(models.Registration).filter(models.Registration.id == reg_id).first()
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    reg.payment_status = status
    db.commit()
    return {"message": "Status updated", "new_status": status}

@app.get("/admin/member-stats")
def get_member_stats(
    db: Session = Depends(get_db), 
    admin_user: str = Depends(auth.get_current_admin)
):
    # 取得所有使用者及其報名統計
    admins = [a.lower() for a in settings.admin_list]
    users = db.query(models.User).all()
    result = []
    for u in users:
        # 跳過管理員帳號，統計僅針對一般成員
        if u.email.lower() in admins:
            continue
            
        paid_count = sum(1 for r in u.registrations if r.payment_status == "已付款")
        pending_count = sum(1 for r in u.registrations if r.payment_status == "待付款")
        
        result.append({
            "display_name": u.display_name,
            "email": u.email,
            "birthday": u.birthday,
            "is_vip": u.is_vip,
            "paid_count": paid_count, # 已參加次數
            "pending_count": pending_count, # 待處理次數
            "registrations": [
                {
                    "event_name": r.event.name if r.event else "未知",
                    "payment_status": r.payment_status,
                    "registration_date": r.registration_date
                } for r in u.registrations
            ]
        })
    return result

@app.patch("/admin/users/{user_email}/vip")
def toggle_user_vip(
    user_email: str,
    is_vip: int, # 0 or 1
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    user = db.query(models.User).filter(models.User.email == user_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="找不到使用者")
    user.is_vip = is_vip
    db.commit()
    return {"message": f"使用者 {user_email} VIP 狀態已更新為 {is_vip}"}

@app.post("/admin/reminders/trigger")
def trigger_reminders(
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db), 
    admin_user: str = Depends(auth.get_current_admin)
):
    # 手動觸發兩者檢查
    r_count = check_reminders(db, background_tasks)
    m_count = check_marketing_mails(db, background_tasks)
    return {"message": f"成功排程發送 {r_count} 封提醒郵件與 {m_count} 封行銷郵件"}

@app.get("/announcements", response_model=List[AnnouncementOut])
def get_announcements(db: Session = Depends(get_db)):
    return db.query(models.Announcement).order_by(models.Announcement.date.desc()).all()

@app.post("/admin/announcements", response_model=AnnouncementOut)
def create_announcement(
    ann: AnnouncementCreate, 
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    db_ann = models.Announcement(**ann.dict())
    db.add(db_ann)
    db.commit()
    db.refresh(db_ann)
    return db_ann

@app.patch("/admin/announcements/{ann_id}", response_model=AnnouncementOut)
def update_announcement(
    ann_id: int,
    ann: AnnouncementCreate,
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    db_ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not db_ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    for key, value in ann.dict().items():
        setattr(db_ann, key, value)
    
    db.commit()
    db.refresh(db_ann)
    return db_ann

@app.delete("/admin/announcements/{ann_id}")
def delete_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    db_ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not db_ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    db.delete(db_ann)
    db.commit()
    return {"message": "Announcement deleted"}

# --- Wishes API ---

@app.post("/wishes", response_model=WishOut)
def create_wish(
    wish: WishCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(auth.get_current_user)
):
    db_wish = models.Wish(
        user_email=current_user,
        content=wish.content,
        category=wish.category
    )
    db.add(db_wish)
    db.commit()
    db.refresh(db_wish)
    return db_wish

@app.get("/admin/wishes", response_model=List[WishOut])
def list_wishes(
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    return db.query(models.Wish).order_by(models.Wish.created_at.desc()).all()
@app.get("/admin/marketing-mails", response_model=List[MarketingMailOut])
def get_marketing_mails(
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    return db.query(models.MarketingMail).order_by(models.MarketingMail.scheduled_date.desc()).all()

@app.post("/admin/marketing-mails")
def create_marketing_mail(
    mail: MarketingMailCreate,
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    new_mail = models.MarketingMail(
        subject=mail.subject,
        content=mail.content,
        scheduled_date=mail.scheduled_date,
        scheduled_time=mail.scheduled_time
    )
    db.add(new_mail)
    db.commit()
    db.refresh(new_mail)
    return new_mail

@app.patch("/admin/marketing-mails/{mail_id}", response_model=MarketingMailOut)
def update_marketing_mail(
    mail_id: int,
    mail_data: MarketingMailCreate,
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    db_mail = db.query(models.MarketingMail).filter(models.MarketingMail.id == mail_id).first()
    if not db_mail:
        raise HTTPException(status_code=404, detail="找不到該排程")
    
    if db_mail.is_sent == 1:
        raise HTTPException(status_code=400, detail="行銷郵件已發送，無法編輯")
    
    for key, value in mail_data.dict().items():
        setattr(db_mail, key, value)
    
    db.commit()
    db.refresh(db_mail)
    return db_mail

@app.delete("/admin/marketing-mails/{mail_id}")
def delete_marketing_mail(
    mail_id: int,
    db: Session = Depends(get_db),
    admin_user: str = Depends(auth.get_current_admin)
):
    mail = db.query(models.MarketingMail).filter(models.MarketingMail.id == mail_id).first()
    if not mail:
        raise HTTPException(status_code=404, detail="找不到該排程")
    db.delete(mail)
    db.commit()
    return {"message": "狀態已更新"}

# === 前端靜態檔案服務 (單服務部署模式) ===
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    # 掛載靜態資源 (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """SPA catch-all: 所有非 API 路由都返回 index.html"""
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))
