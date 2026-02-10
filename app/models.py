from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, declarative_base
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    email = Column(String(255), primary_key=True, index=True)
    display_name = Column(String(255), index=True)
    birthday = Column(String(20))  # 格式: YYYY-MM-DD
    is_vip = Column(Integer, default=1) # 0: 一般, 1: 好顧客 (VIP) - 預設為 VIP
    
    registrations = relationship("Registration", back_populates="user_record")

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    date = Column(DateTime)
    description = Column(Text)
    amount = Column(Float)
    reminder_date = Column(String(20), nullable=True) # 催繳執行日期 YYYY-MM-DD
    reminder_deadline = Column(String(20), nullable=True) # 催繳最後截止日期 YYYY-MM-DD
    
    registrations = relationship("Registration", back_populates="event", cascade="all, delete-orphan")

class Registration(Base):
    __tablename__ = "registrations"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    user_name = Column(String(255), index=True)
    birthday = Column(String(20))  # 格式: YYYY-MM-DD
    email = Column(String(255), ForeignKey("users.email"), index=True)
    payment_status = Column(String(20), default="待付款")  # 待付款, 已付款
    participant_count = Column(Integer, default=1) # 參加人數
    notes = Column(Text, nullable=True) # 需求備註
    registration_date = Column(DateTime, default=datetime.datetime.utcnow)

    event = relationship("Event", back_populates="registrations")
    user_record = relationship("User", back_populates="registrations")

class Announcement(Base):
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    content = Column(Text)
    date = Column(String(20))  # 格式: YYYY-MM-DD
    event_link_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    event_link = relationship("Event")

class Wish(Base):
    __tablename__ = "wishes"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String(255))
    content = Column(Text)
    category = Column(String(50))  # 活動希望, 改善建議
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class MarketingMail(Base):
    __tablename__ = "marketing_mails"
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(255))
    content = Column(Text)
    scheduled_date = Column(String(20)) # 格式: YYYY-MM-DD
    scheduled_time = Column(String(10), default="09:00") # 格式: HH:MM
    is_sent = Column(Integer, default=0) # 0: 尚未發送, 1: 已發送
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
