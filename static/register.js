function bindEmailCodeClick(){
    $("#send-code").click(function(event){
        event.preventDefault();
        //将当前button转换成jquery对象
        let that = $(this);

        //1.获取用户输入的邮箱
        let email = $("#reg-email").val();
        let emailReg = /^([a-zA-Z0-9_-])+@([a-zA-Z0-9_-])+(.[a-zA-Z0-9_-])+/;
        if(!emailReg.test(email)){
            alert("请先填写正确的邮箱格式");
            return;
        }
        //2.倒计时过程中，取消点击事件
        that.off("click");





        //3.倒计时
        let countdown = 6;
        that.text(countdown+"s");
        let timer = setInterval(function(){
            countdown -= 1;
            that.text(countdown+"s")
            if(countdown<=0){
                that.text("获取验证码");
                clearInterval(timer)
                //重新绑定点击事件
                bindEmailCodeClick();
            }
        },1000)

        //4.发送ajax请求
        $.get({
            url:"/email/code",
            data:{"email":email},
            success:function (result){
                console.log(result);
            }
        })
    });


}

function bindRegisterEvent(){
    // 必须拦截 form 的 submit：用户在输入框里按「回车」时只会触发表单提交，不会触发「注册」按钮的 click，
    // 且未写 method 时浏览器默认用 GET 提交当前页，网络里看不到对 /register 的 POST。
    $("#register-form").on("submit", function (event){
        event.preventDefault();
        let email = $("#reg-email").val();
        let code =  $("#reg-code").val();
        let username = $("#reg-username").val();
        let password = $("#reg-password").val();
        let confirm_password = $("#reg-confirm-password").val();
        if (confirm_password !== password) {
            alert("两次输入的密码不一致");
            return;
        }
        $.post({
            url: "/register",
            data: { email, code, username, password },
            success: function(result){
                if (result && result["result"] === true) {
                    window.location = "/login";
                } else if (result && result["message"]) {
                    alert(result["message"]);
                }
            },
            error: function(xhr) {
                alert("注册请求失败：" + (xhr.responseText || xhr.statusText || "请打开「网络」查看详情"));
            }
        });
    });
}



//整个网页加载完成后
$(function(){
    bindEmailCodeClick();
    bindRegisterEvent();
})