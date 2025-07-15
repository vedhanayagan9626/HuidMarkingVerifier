from app import create_app, db
from app.models import User

app = create_app()
with app.app_context():
    u = User()
    u.email ='admin@example.com'
    u.set_password('password')
    db.session.add(u)
    db.session.commit()
