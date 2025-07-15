from app import db   # adjust the import to your actual app structure
from app import create_app  # if you have a factory pattern, otherwise import app directly

app = create_app()   # only if using factory; else remove

with app.app_context():
    print("⚠ Dropping all tables...")
    db.drop_all()
    print("✅ All tables dropped.")

    print("🔧 Creating all tables...")
    db.create_all()
    print("✅ All tables created fresh!")
    