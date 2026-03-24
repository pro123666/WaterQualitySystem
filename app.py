from datetime import datetime,timedelta
import os
from sqlalchemy.exc import IntegrityError
from flask import Flask, render_template, request, jsonify, redirect, url_for, g,session
import random
import string
from exts import migrate, db,mail
from models import Quality, Date, User,EmailCode
from flask_mail import Message
from decorators import login_required


app = Flask(__name__)

# Prefer environment-based config for cloud deployment; fall back to local config.py.
try:
    import config as local_config
    app.config.from_object(local_config)
except ModuleNotFoundError:
    mysql_host = os.getenv("MYSQL_HOST", "localhost")
    mysql_user = os.getenv("MYSQL_USER", "root")
    mysql_password = os.getenv("MYSQL_PASSWORD", "")
    mysql_port = os.getenv("MYSQL_PORT", "3306")
    mysql_db = os.getenv("MYSQL_DB", "water_quality")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        database_url = (
            f"mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_db}"
            "?charset=utf8mb4"
        )

    app.config.update(
        SECRET_KEY=os.getenv("SECRET_KEY", "replace-with-a-strong-secret-key"),
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.qq.com"),
        MAIL_USE_SSL=os.getenv("MAIL_USE_SSL", "true").lower() == "true",
        MAIL_PORT=int(os.getenv("MAIL_PORT", "465")),
        MAIL_USERNAME=os.getenv("MAIL_USERNAME", ""),
        MAIL_PASSWORD=os.getenv("MAIL_PASSWORD", ""),
        MAIL_DEFAULT_SENDER=os.getenv("MAIL_DEFAULT_SENDER", os.getenv("MAIL_USERNAME", "")),
    )

DISABLE_DB = os.getenv("DISABLE_DB", "false").lower() == "true"
app.config["DISABLE_DB"] = DISABLE_DB
if DISABLE_DB:
    # Keep app bootable in demo mode without a live MySQL service.
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
if not DISABLE_DB:
    migrate.init_app(app, db)
mail.init_app(app)

@app.before_request
def before_request():
    if app.config.get("DISABLE_DB"):
        g.user = None
        return
    user_id = session.get('user_id')
    if user_id:
        user = db.session.get(User,user_id)
        g.user = user
    else:
        g.user = None




def _quality_row_for_js(q: Quality) -> dict:
    date_str = ""
    if q.date is not None and getattr(q.date, "date", None) is not None:
        date_str = q.date.date.strftime("%Y-%m-%d")

    def num(x):
        if x is None:
            return None
        return float(x)

    return {
        "id": q.id,
        "pointId": q.point_id,
        "date": date_str,
        "FCR": num(q.FCR),
        "ECR": num(q.ECR),
        "PH": num(q.PH),
        "ORP": num(q.ORP),
        "NTU": num(q.NTU),
    }


@app.context_processor
def context_processor():
    if app.config.get("DISABLE_DB"):
        quality_data = []
        quality_rows = []
    else:
        quality_data = db.session.scalars(db.select(Quality)).all()
        quality_rows = [_quality_row_for_js(q) for q in quality_data]
    return {
        'user': g.user,
        "quality_data": quality_data,
        "quality_rows": quality_rows,
    }


@app.route("/")
def index():
    # 首页跳到数据录入页
    return redirect(url_for("entry_page"))

@app.route("/register",methods=['GET','POST'])
def register():
    if request.method == 'GET':
        return render_template("register.html")
    else:
        if app.config.get("DISABLE_DB"):
            return jsonify({"result": False, "message": "演示模式未连接数据库，暂不支持注册。"})
        email = request.form.get("email")
        username = request.form.get("username")
        password = request.form.get("password")
        code = request.form.get("code")
        code_model = db.session.scalar(
            db.select(EmailCode).where(EmailCode.code == code, EmailCode.email == email)
        )
        if not code_model or (datetime.now() - code_model.create_time) > timedelta(minutes=10):
            return jsonify({"result":False, "message":"请输入正确的验证码！"})
        existed_user = db.session.scalar(db.select(User).where(User.email == email))
        if existed_user:
            return jsonify({"result":False, "message":"该邮箱已注册，请直接登录！"})
        if not password or not str(password).strip():
            return jsonify({"result": False, "message": "请输入密码"})
        user = User(email=email, username=username, password=password)
        db.session.add(user)

        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            return jsonify({"result":False,"message":"注册失败，请检查输入后重试。"})
        return jsonify({"result":True,"message":None})
@app.get('/email/code')
def get_email_code():
    if app.config.get("DISABLE_DB"):
        return jsonify({"result": False, "message": "演示模式未连接数据库，暂不支持发送验证码。"})
    email = request.args.get('email')
    if not email:
        return jsonify({"result":False,"message":"请传入邮箱!"})


    #生成验证码
    source = string.digits * 4
    code = "".join(random.sample(source,4))
    message = Message(
        subject = "[水质管理系统]注册验证码",
        recipients = [email],
        body = f"[水质管理系统]注册验证码:{code}"
    )
    try:
        mail.send(message)
    except Exception as e:
        return jsonify({"result": False, "message": str(e)})
    try:
        code_model = EmailCode(code=code, email=email)
        db.session.add(code_model)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"result": False, "message": f"保存验证码失败: {e}"})
    return jsonify({"result": True, "message": None})

@app.route('/login',methods=['GET','POST'])
def login():
    if request.method == 'GET':
        return render_template("login.html")
    else:
        if app.config.get("DISABLE_DB"):
            return redirect('/login')
        email = request.form.get("email")
        password = request.form.get("password")
        remember = request.form.get("remember")
        user = db.session.scalar(db.select(User).where(User.email == email))
        if user and user.check_password(password):
            session['user_id'] = user.id
            #设置会31天后过期
            if remember:
                session.permanent = True
            return redirect('/')
        else:
            print("邮箱或密码错误!")
            return redirect('/login')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route("/entry")
def entry_page():
    return render_template("entry.html", current_page="entry")


@app.route("/edit")
def edit_page():
    return render_template("edit.html", current_page="edit")


@app.route("/delete")
def delete_page():
    return render_template("delete.html", current_page="delete")


@app.route("/query")
def query_page():
    return render_template("query.html", current_page="query")


@app.route("/alert")
@login_required
def alert_page():
    return render_template("alert.html", current_page="alert")


@app.get("/entry/point")
def get_entry_point():
    entry_point = request.args.get("entry_point")
    if not entry_point:
        return jsonify({"result": False, "message": "请输入监测点编号!"})
    else:
        return jsonify({"result": True, "message": None})


@app.post("/api/records")
def create_record():
    if app.config.get("DISABLE_DB"):
        return jsonify({"ok": False, "message": "演示模式未连接数据库，暂不支持写入数据。"})
    data = request.get_json(silent=True) or {}

    point_id = (data.get("point_id") or "").strip()
    date_str = (data.get("date") or "").strip()

    if not point_id:
        return jsonify({"ok": False, "message": "请输入监测点编号!"})
    if not date_str:
        return jsonify({"ok": False, "message": "请选择监测日期!"})

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"ok": False, "message": "日期格式必须为 YYYY-MM-DD"})

    d = Date(date=dt)
    db.session.add(d)
    db.session.flush()
    q = Quality(
        point_id=point_id,
        FCR=data.get("FCR"),
        ECR=data.get("ECR"),
        PH=data.get("PH"),
        ORP=data.get("ORP"),
        NTU=data.get("NTU"),
        date_id=d.id,
    )
    db.session.add(q)
    db.session.commit()
    return jsonify({"ok": True, "id": q.id, "message": "创建成功"})


@app.route('/edit',methods=['POST','GET'])
def edit():
    if request.method == "GET":
        return render_template('edit.html')
    else:
        if app.config.get("DISABLE_DB"):
            return redirect("/edit")
        date = request.form.get("date")
        date=date[0:10]
        dt = datetime.strptime(date, "%Y-%m-%d")
        point_id = request.form.get("point_id")
        FCR = request.form.get("FCR")
        ECR = request.form.get("ECR")
        PH = request.form.get("PH")
        ORP = request.form.get("ORP")
        NTU = request.form.get("NTU")
        quality = db.session.scalar(db.select(Quality).join(Date).where(Date.date == dt, Quality.point_id == point_id))
        quality.FCR = FCR
        quality.ECR = ECR
        quality.PH = PH
        quality.ORP = ORP
        quality.NTU = NTU
        db.session.add(quality)
        db.session.commit()
        return redirect("/edit")



@app.route('/delete',methods=['POST','GET'])
def delete():
    if request.method == "GET":
        return render_template('delete.html')
    else:
        if app.config.get("DISABLE_DB"):
            return redirect("/delete")
        date = request.form.get("date")
        date=date[0:10]
        dt = datetime.strptime(date, "%Y-%m-%d")
        point_id = request.form.get("point_id")
        FCR = request.form.get("FCR")
        ECR = request.form.get("ECR")
        PH = request.form.get("PH")
        ORP = request.form.get("ORP")
        NTU = request.form.get("NTU")
        quality = db.session.scalar(db.select(Quality).join(Date).where(Date.date == dt, Quality.point_id == point_id))
        db.session.delete(quality)
        db.session.commit()
        return redirect("/edit")



if __name__ == "__main__":
    app.run(debug=False, use_reloader=False)

