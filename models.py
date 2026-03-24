from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy import Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from werkzeug.security import generate_password_hash, check_password_hash
from exts import db
from datetime import datetime
from typing import List, Optional


class Quality(db.Model):
    __tablename__ = 'quality'

    __table_args__ = (
        UniqueConstraint('point_id', 'date_id', name='unique_point_id'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    FCR: Mapped[float] = mapped_column(Float, nullable=True)  # 余氯
    ECR: Mapped[float] = mapped_column(Float, nullable=True)  # 电导率
    PH: Mapped[float] = mapped_column(Float, nullable=True)
    ORP: Mapped[float] = mapped_column(Float, nullable=True)
    NTU: Mapped[float] = mapped_column(Float, nullable=True)  # 浊度
    point_id: Mapped[str] = mapped_column(String(50), nullable=True)
    date_id: Mapped[int] = mapped_column(Integer, ForeignKey('date.id'))
    date: Mapped["Date"] = relationship("Date", back_populates="quality")
    users: Mapped[List["User"]] = relationship("User", back_populates="quality")


class Date(db.Model):
    __tablename__ = 'date'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    quality: Mapped["Quality"] = relationship("Quality", back_populates="date")


class User(db.Model):
    __tablename__ = 'users'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(100), unique=True)
    username: Mapped[str] = mapped_column(String(50))
    _password: Mapped[str] = mapped_column(String(200))
    quality_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey('quality.id', ondelete='SET NULL'), nullable=True
    )
    quality: Mapped[Optional["Quality"]] = relationship('Quality', back_populates='users')


    def __init__(self, *args, **kwargs):
        # 必须从 kwargs 里取出，不能传给 super（表没有 password 列）；且 None 不能交给 generate_password_hash
        password = kwargs.pop("password", None)
        super().__init__(*args, **kwargs)
        if password:
            self.password = password


    @property
    def password(self):
        return self._password

    @password.setter
    def password(self,raw_password):
        self._password=generate_password_hash(raw_password)

    def check_password(self,raw_password):
        return check_password_hash(self.password,raw_password)


class EmailCode(db.Model):
    __tablename__ = 'email_code'
    id:Mapped[int] = mapped_column(Integer,primary_key=True,autoincrement=True)
    code:Mapped[str] = mapped_column(String(10))
    email:Mapped[str] = mapped_column(String(100))
    create_time:Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
