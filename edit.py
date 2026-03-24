from datetime import datetime

from flask import request, jsonify

from exts import db
from models import Quality


def edit_data():
    data = request.get_json(silent=True) or {}

    point_id = (data.get("point_id") or "").strip()
    date_str = (data.get("date") or "").strip()


    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"ok": False, "message": "日期格式必须为 YYYY-MM-DD"})

    from models import Date
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


