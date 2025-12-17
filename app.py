from flask import Flask
from config import Config
from routes.pages import pages_bp
from routes.api import api_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.secret_key = 'your-secret-key'  # Required for sessions; set securely in production

    # Register blueprints
    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp)

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
