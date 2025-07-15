from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import base64

db = SQLAlchemy() #database object creation
def create_app():
    app = Flask(__name__)  # application creation
    app.config['SECRET_KEY'] = 'demohuid9626' #secrete key to manage session
    app.config['UPLOAD_FOLDER'] = os.path.join("static", "uploads")
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///demohuid.db'
    app.config['SESSION_PERMANENT'] = False
        
    CORS(app)
    db.init_app(app)

    with app.app_context():
        from .routes import bp as main_bp
        app.register_blueprint(main_bp)
        db.create_all()

    @app.template_filter('b64encode')
    def b64encode_filter(data):
        if data is None:
            return ''
        return base64.b64encode(data).decode('utf-8')
    
    return app