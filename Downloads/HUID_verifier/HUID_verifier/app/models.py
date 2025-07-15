from . import db
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

# Update the HuidCapture model
class HuidCapture(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_no = db.Column(db.String(50), nullable=False)
    itemcode = db.Column(db.String(50))
    ocr_huid = db.Column(db.String(100))
    actual_huid = db.Column(db.String(20))
    weight = db.Column(db.Float)
    stage1_image = db.Column(db.LargeBinary)
    qc_image = db.Column(db.LargeBinary)
    weighing_image = db.Column(db.LargeBinary)
    verification = db.Column(db.String(20))  # New column for verification status
    date_created = db.Column(db.DateTime, default=datetime.now(timezone.utc))

class HuidDetails(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_no = db.Column(db.String(50), nullable=False)
    itemcode = db.Column(db.String(20), unique=True, nullable=False)
    huid_no = db.Column(db.String(20), nullable=False)
    weight = db.Column(db.Float, nullable=False)
    date_created = db.Column(db.DateTime, default=datetime.now(timezone.utc))

class Stage1(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_no = db.Column(db.String(50), nullable=False)
    itemcode = db.Column(db.String(20), nullable=False)
    huid_no = db.Column(db.String(20), nullable=False)
    weight = db.Column(db.Float, nullable=False)
    stage1_image = db.Column(db.LargeBinary, nullable=True)  # initially blank
    status = db.Column(db.String(20), default='pending')  # pending / completed
    date_created = db.Column(db.DateTime, default=datetime.now(timezone.utc))

class Stage2(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_no = db.Column(db.String(50), nullable=False)
    itemcode = db.Column(db.String(20), nullable=False)
    huid_no = db.Column(db.String(20), nullable=False)
    ocr_huid = db.Column(db.String(20), nullable=True)      # set after OCR
    weight = db.Column(db.Float, nullable=False)
    qc_image = db.Column(db.LargeBinary, nullable=True) # initially blank
    status = db.Column(db.String(20), default='pending')
    date_created = db.Column(db.DateTime, default=datetime.now(timezone.utc))

class Stage3(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    job_no = db.Column(db.String(50), nullable=False)
    itemcode = db.Column(db.String(20), nullable=False)
    huid_no = db.Column(db.String(20), nullable=False)
    ocr_huid = db.Column(db.String(20), nullable=True)       # from previous stage
    weight = db.Column(db.Float, nullable=False)
    weighing_image = db.Column(db.LargeBinary, nullable=True) # initially blank
    status = db.Column(db.String(20), default='pending')
    date_created = db.Column(db.DateTime, default=datetime.now(timezone.utc))