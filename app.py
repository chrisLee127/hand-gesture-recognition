from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    """主路由，返回渲染后的HTML页面"""
    return render_template('index_websocket.html')

if __name__ == '__main__':
    # 调试模式，自动重启服务器，仅用于开发环境
    app.run(debug=True, port=5000)