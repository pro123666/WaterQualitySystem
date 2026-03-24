
async function createRecord() {
    const payload = {
        point_id: document.getElementById("entryPoint").value.trim(),
        date: document.getElementById("entryDate").value,
        FCR: parseFloat(document.getElementById("entryFCR").value),
        ECR: parseFloat(document.getElementById("entryECR").value),
        PH: parseFloat(document.getElementById("entryPH").value),
        ORP: parseFloat(document.getElementById("entryORP").value),
        NTU: parseFloat(document.getElementById("entryNTU").value),
    };

    let res;
    res = await fetch("/api/records", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload),
    });

    let result;
    result = await res.json();
    if (!res.ok) {
        alert(result.message || "保存失败");
        return;
    }
    alert("保存成功");
}


function checkEntryPoint() {
    //获取用户输入的
    let entry_point = $("#entryPoint").val();

    if (!entry_point) {
        alert("请输入监测点编号!");
        return;
    }


//发送ajax请求
    $.get({
        url: "/entry/point",
        data: {"entry_point": entry_point},
        success: function (result) {
            console.log(result);
        }
    })
    return true;
}


function checkRequiredFields() {
    const point = $("#entryPoint").val().trim();
    const date  = $("#entryDate").val().trim();
    const fcr   = $("#entryFCR").val().trim();
    const ecr   = $("#entryECR").val().trim();
    const ph    = $("#entryPH").val().trim();
    const orp   = $("#entryORP").val().trim();
    const ntu   = $("#entryNTU").val().trim();
    if (!point) {
        alert("监测点编号不能为空！");
        return false;
    }
    if (!date) {
        alert("监测日期不能为空！");
        return false;
    }
    if (!fcr) {
        alert("余氯不能为空！");
        return false;
    }
    if (!ecr) {
        alert("电导率不能为空！");
        return false;
    }
    if (!ph) {
        alert("PH 值不能为空！");
        return false;
    }
    if (!orp) {
        alert("ORP 不能为空！");
        return false;
    }
    if (!ntu) {
        alert("浊度不能为空！");
        return false;
    }
    if (typeof getData === 'function') {
    const exists = getData().some(function (r) {
    return r.pointId === point && r.date === date;
    });
    if (exists) {
        alert("已在当天记录过该监测点！请去修改页面修改！");
        return false;
    }
}
    return true;  // 全部不为空
}




//整个网页加载完成后
$(function () {
    $("#entrySubmit").on("click", function (e) {
        e.preventDefault();
        // 先检查必填项
        if (!checkRequiredFields()) {
            return;            // 有任何一个为空，就弹窗并停止提交
        }
        createRecord();        // 所有字段都有值，再发 POST 写数据库
    });
});