from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, declarative_base
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    email = Column(String, primary_key=True, index=True)
    display_name = Column(String, index=True)
    birthday = Column(String)  # 格式: YYYY-MM-DD
    phone = Column(String, nullable=True) # 新增：電話
    shipping_address = Column(String, nullable=True) # 新增：通訊/配送地址
    is_vip = Column(Integer, default=1) # 0: 一般, 1: 好顧客 (VIP)
    
    orders = relationship("Order", back_populates="user_record")

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    contact_info = Column(Text, nullable=True)
    
    products = relationship("Product", back_populates="supplier")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    available_stock = Column(Float, default=0.0) # 可購買庫存 (已預扣待出貨)
    stock = Column(Float, default=0.0) # 實際庫存 (倉庫實體存量)
    safety_stock = Column(Float, default=0.0) # 安全庫存
    unit = Column(String) # 斤, 袋, 盒 等
    price = Column(Float) # 單價
    description = Column(Text, nullable=True)
    
    supplier = relationship("Supplier", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")
    losses = relationship("ProductLoss", back_populates="product", cascade="all, delete-orphan")

class ProductLoss(Base):
    __tablename__ = "product_losses"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    reason = Column(String) # 損壞, 過期, 遺失 等
    loss_date = Column(String) # YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="losses")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, ForeignKey("users.email"), index=True)
    total_amount = Column(Float)
    payment_method = Column(String) # 現金, 轉帳, LINE Pay 等
    payment_status = Column(String, default="待付款") # 待付款, 已付款
    receiver_phone = Column(String, nullable=True) # 新增：收件人電話
    receiver_address = Column(String, nullable=True) # 新增：收件人地址
    status = Column(String, default="已建立") # 已建立, 已取消, 已完成
    shipping_date = Column(String, nullable=True) # 預計出貨日 YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user_record = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    price_at_order = Column(Float) # 下單時的單價

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

class Announcement(Base):
    __tablename__ = "announcements"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    content = Column(Text)
    date = Column(String)  # 格式: YYYY-MM-DD
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Wish(Base):
    __tablename__ = "wishes"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String)
    content = Column(Text)
    category = Column(String)  # 願望, 建議
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
class CartItem(Base):
    __tablename__ = "cart_items"
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, ForeignKey("users.email"), index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")
    product = relationship("Product")
