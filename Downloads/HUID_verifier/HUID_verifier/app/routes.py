
from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, current_app
from . import db
from .models import HuidCapture, HuidDetails, User, Stage1, Stage2, Stage3
from werkzeug.security import generate_password_hash
from datetime import datetime, timezone
from werkzeug.security import check_password_hash, generate_password_hash
import base64
from app.ocrtext import ocrimage
import pandas as pd
import io
import logging
logging.basicConfig(level=logging.DEBUG)

bp = Blueprint('main', __name__)
@bp.before_request
def require_login():
    allowed_routes = [
        'main.login_page',  # Use blueprint-prefixed endpoint names
        'main.login',
        'main.signup_page',
        'main.signup',
        'static'
    ]
    if request.endpoint in allowed_routes:
        return
    if 'user_id' not in session:
        return redirect(url_for('main.login_page'))  # Redirect to login page

@bp.route('/login', methods=['GET'])
def login_page():
    # If already logged in, redirect to index
    if 'user_id' in session:
        return redirect(url_for('main.index'))
    return render_template('login.html')

@bp.route('/logout')
def logout():
    session.clear()  # Clear all session data
    return redirect(url_for('main.login_page'))  # Redirect to login page

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"success": False, "error": "Missing email or password"}), 400

    user = User.query.filter_by(email=email).first()
    if user and check_password_hash(user.password_hash, password):
        session['user_id'] = user.id
        session['user_email'] = user.email
        return jsonify({
            "success": True,
            "redirect": url_for('main.index')  # Tell frontend where to redirect
        })
    return jsonify({"success": False, "error": "Invalid credentials"}), 401

@bp.route('/signup', methods=['GET'])
def signup_page():
    # If already logged in, redirect to index
    if 'user_id' in session:
        return redirect(url_for('main.index'))
    return render_template('signup.html')

@bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"success": False, "error": "Missing email or password"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "error": "User already exists"}), 400

    new_user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        "success": True,
        "redirect": url_for('main.login_page')  # Redirect to login after signup
    })

@bp.route('/forgot-password', methods=['GET'])
def forgot_password_page():
    return render_template('forgot_password.html')

@bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    email = request.form.get('email')
    # Add your password reset logic here
    # Typically you would:
    # 1. Check if email exists
    # 2. Generate a reset token
    # 3. Send email with reset link
    flash('If an account exists with this email, you will receive a password reset link')
    return redirect(url_for('main.login_page'))

@bp.route("/")
def index():
    if 'user_id' not in session:
        return redirect(url_for('main.login_page'))
    return render_template("index.html")


def ocr_after(image_file):
    file = image_file
    if file:
        image_bytes = file.read()
        ocr_huid = ocrimage(image_bytes)
        if ocr_huid is None:
            return None
        return ocr_huid.strip().upper()
    return "No image provided for OCR"

@bp.route("/ocr_QC", methods=["POST"])
def ocr_qc():
    if 'image' not in request.files:
        return jsonify({"success": False, "error": "No image uploaded"}), 400
    
    try:
        job_no = request.form.get('job_no', '').strip()
        itemcode = request.form.get('itemcode', '').strip()
        
        # Get the expected HUID from database
        expected_huid = None
        if job_no and itemcode:
            stage1_record = Stage1.query.filter_by(job_no=job_no, itemcode=itemcode).first()
            if stage1_record:
                expected_huid = stage1_record.huid_no
        
        # Process image (pseudo-code - implement your actual OCR logic)
        image_file = request.files['image']
        ocr_result = ocr_after(image_file)  # Your OCR implementation
        if ocr_result is None:
            return jsonify({"success": False, "error": "Unique number not detected"}), 400
        
        # Validate against expected HUID if available
        is_valid = False
        if expected_huid and ocr_result:
            is_valid = (ocr_result.upper() == expected_huid.upper())
        
        return jsonify({
            "success": True,
            "unique_number": ocr_result,
            "is_valid": is_valid,
            "expected_huid": expected_huid
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# @bp.route("/save_all", methods=["POST"])
# def save_all():
#     itemcode = request.form.get("item_code")
#     ocr_huid = request.form.get("ocr_huid")
#     stage1_image = request.files.get("Stage1_image")     # <-- match exactly!
#     qc_image = request.files.get("QC_image")
#     weighing_image = request.files.get("Weighing_image")

#     if ocr_huid and stage1_image and qc_image and weighing_image:
#         product = HuidCapture()
#         product.itemcode=itemcode
#         product.ocr_huid=ocr_huid
#         product.stage1_image=stage1_image.read()
#         product.qc_image=qc_image.read()
#         product.weighing_image=weighing_image.read()
#         product.date_created=datetime.now(timezone.utc)
        
#         db.session.add(product)
#         db.session.commit()
#         return jsonify({"success": True})
#     else:
#         return jsonify({"success": False, "error": "Missing required data"}), 400


@bp.route("/list")
def list_records():
    try:
        records = HuidCapture.query.order_by(HuidCapture.date_created.desc()).all()
        
        # Verify image data is bytes before passing to template
        for record in records:
            if record.stage1_image and not isinstance(record.stage1_image, bytes):
                record.stage1_image = None
            if record.qc_image and not isinstance(record.qc_image, bytes):
                record.qc_image = None
            if record.weighing_image and not isinstance(record.weighing_image, bytes):
                record.weighing_image = None
            
            # Ensure verification status is set
            if not record.verification:
                if record.actual_huid and record.ocr_huid:
                    if record.actual_huid.upper() == record.ocr_huid.upper():
                        record.verification = 'matched'
                    else:
                        record.verification = 'mismatched'
                elif record.ocr_huid:
                    record.verification = 'pending'
                else:
                    record.verification = 'not_verified'
                
        return render_template("list.html", records=records)
    except Exception as e:
        current_app.logger.error(f"Error loading records: {str(e)}")
        return render_template("error.html", message="Failed to load records"), 500

@bp.route("/excel")
def excel_upload():
    return render_template("excel.html")

#store a data from excel to databases => huiddetails, stage1,stage2,stage3
@bp.route("/upload_excel", methods=["POST"])
def upload_excel():
    file = request.files.get("file")
    if file is None or file.filename is None:
        return jsonify({"success": False, "error": "No file provided"}), 400

    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        return jsonify({"success": False, "error": "Only Excel files (.xlsx, .xls) allowed"}), 400

    try:
        df = pd.read_excel(io.BytesIO(file.read()), engine='openpyxl')
        print("Original columns:", df.columns.tolist())

        # Clean column names: strip whitespace and standardize
        df.columns = df.columns.str.strip().str.title()
        print("Cleaned columns:", df.columns.tolist())

        required_columns = ['Job No', 'Itemcode', 'Huid No', 'Weight']
        for col in required_columns:
            if col not in df.columns:
                return jsonify({"success": False, "error": f"Missing required column: {col}"}), 400

        # Clean and validate data
        df = df.dropna(subset=required_columns)  # Remove rows with any null values in required columns
        df = df[df[required_columns].ne('').all(axis=1)]  # Remove empty strings
        
        # Convert and clean data
        df['Job No'] = df['Job No'].astype(str).str.strip()
        df['Itemcode'] = df['Itemcode'].astype(str).str.strip()
        df['Huid No'] = df['Huid No'].astype(str).str.strip()
        df['Weight'] = pd.to_numeric(df['Weight'], errors='coerce')
        
        # Remove rows with invalid data
        df = df.dropna(subset=['Weight'])
        df = df[df['Job No'].ne('') & df['Itemcode'].ne('') & df['Huid No'].ne('')]

        if df.empty:
            return jsonify({"success": False, "error": "No valid data found in the file"}), 400

        added_count = 0
        stage_added_count = 0
        skipped_rows = 0

        for _, row in df.iterrows():
            try:
                job_no = str(row['Job No']).strip()
                itemcode = str(row['Itemcode']).strip()
                huid_no = str(row['Huid No']).strip()
                weight = float(row['Weight'])

                if not all([job_no, itemcode, huid_no]):
                    skipped_rows += 1
                    continue

                # Check for existing record
                exists = HuidDetails.query.filter_by(job_no=job_no, itemcode=itemcode).first()
                if not exists:
                    new_entry = HuidDetails()
                    new_entry.job_no=job_no
                    new_entry.itemcode=itemcode
                    new_entry.huid_no=huid_no
                    new_entry.weight=weight
                    
                    db.session.add(new_entry)
                    added_count += 1

                # Check for existing stage records
                stage_exists = Stage1.query.filter_by(job_no=job_no, itemcode=itemcode).first()
                if not stage_exists:
                    stage1 = Stage1()
                    stage1.job_no=job_no
                    stage1.itemcode=itemcode
                    stage1.huid_no=huid_no
                    stage1.weight=weight
                    stage1.stage1_image=None
                    stage1.status='pending'
                    
                    
                    stage2 = Stage2()
                    stage2.job_no=job_no
                    stage2.itemcode=itemcode
                    stage2.huid_no=huid_no
                    stage2.weight=weight
                    stage2.ocr_huid=None
                    stage2.qc_image=None
                    stage2.status='pending'
                    
                    
                    stage3 = Stage3()
                    stage3.job_no=job_no
                    stage3.itemcode=itemcode
                    stage3.huid_no=huid_no
                    stage3.weight=weight
                    stage3.ocr_huid=None
                    stage3.weighing_image=None
                    stage3.status='pending'
                    
                    
                    db.session.add_all([stage1, stage2, stage3])
                    stage_added_count += 1

            except Exception as e:
                print(f"Error processing row: {row}\nError: {str(e)}")
                skipped_rows += 1
                continue

        db.session.commit()
        return jsonify({
            "success": True,
            "message": f"Processed {len(df)} rows. {added_count} new HUID records, {stage_added_count} stage records added. {skipped_rows} rows skipped."
        })

    except Exception as e:
        db.session.rollback()
        print("Upload failed:", str(e))
        return jsonify({"success": False, "error": f"Processing error: {str(e)}"}), 500 
    
@bp.route("/get_job_items")
def get_job_items():
    stage = request.args.get('stage', 'Stage1')  # Default to Stage1
    
    try:
        if stage == 'Stage1':
            # For Stage1, show all pending items
            query = db.session.query(
                Stage1.job_no,
                Stage1.itemcode,
                Stage1.huid_no
            ).filter(
                Stage1.status == 'pending'
            )
            
        elif stage == 'QC':
            # For QC (Stage2), show items that are completed in Stage1 and pending in Stage2
            completed_stage1 = db.session.query(
                Stage1.job_no,
                Stage1.itemcode,
                Stage1.huid_no
            ).filter(
                Stage1.status == 'completed'
            ).subquery()
            
            query = db.session.query(
                Stage2.job_no,
                Stage2.itemcode,
                Stage2.huid_no
            ).join(
                completed_stage1,
                (Stage2.job_no == completed_stage1.c.job_no) &
                (Stage2.itemcode == completed_stage1.c.itemcode)
            ).filter(
                Stage2.status == 'pending'
            )
            
        elif stage == 'Weighing':
            # For Weighing (Stage3), show items completed in Stage1 and Stage2, pending in Stage3
            completed_stage1 = db.session.query(
                Stage1.job_no,
                Stage1.itemcode,
                Stage1.huid_no
            ).filter(
                Stage1.status == 'completed'
            ).subquery()
            
            completed_stage2 = db.session.query(
                Stage2.job_no,
                Stage2.itemcode,
                Stage2.huid_no
            ).filter(
                Stage2.status == 'completed'
            ).subquery()
            
            query = db.session.query(
                Stage3.job_no,
                Stage3.itemcode,
                Stage3.huid_no
            ).join(
                completed_stage1,
                (Stage3.job_no == completed_stage1.c.job_no) &
                (Stage3.itemcode == completed_stage1.c.itemcode)
            ).join(
                completed_stage2,
                (Stage3.job_no == completed_stage2.c.job_no) &
                (Stage3.itemcode == completed_stage2.c.itemcode)
            ).filter(
                Stage3.status == 'pending'
            )
            
        else:
            return jsonify({
                'success': False,
                'error': 'Invalid stage specified',
                'data': {}
            }), 400
        
        # Execute the query
        items = query.all()
        result = {}
        for job_no, itemcode, huid_no in items:
            if job_no not in result:
                result[job_no] = []
            result[job_no].append({
                'itemcode': itemcode,
                'huid_no': huid_no if huid_no else ''  # Ensure we always return a huid_no field
            })
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        current_app.logger.error(f"Error in get_job_items: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': {}
        }), 500
    
#get the pending and completed status on each stage
@bp.route("/get_stage_status_summary")
def get_stage_status_summary():
    stage = request.args.get('stage', 'Stage1')  # Default to Stage1
    
    try:
        if stage == 'Stage1':
            # For Stage1, count all pending and completed records
            pending = Stage1.query.filter(Stage1.status == 'pending').count()
            completed = Stage1.query.filter(Stage1.status == 'completed').count()
        elif stage == 'QC':
            # For QC (Stage2), count only from Stage1 completed records
            completed_stage1_jobs = db.session.query(Stage1.job_no, Stage1.itemcode)\
                .filter(Stage1.status == 'completed')\
                .subquery()
            
            pending = db.session.query(Stage2)\
                .join(completed_stage1_jobs, 
                      (Stage2.job_no == completed_stage1_jobs.c.job_no) & 
                      (Stage2.itemcode == completed_stage1_jobs.c.itemcode))\
                .filter(Stage2.status == 'pending').count()
                
            completed = db.session.query(Stage2)\
                .join(completed_stage1_jobs, 
                      (Stage2.job_no == completed_stage1_jobs.c.job_no) & 
                      (Stage2.itemcode == completed_stage1_jobs.c.itemcode))\
                .filter(Stage2.status == 'completed').count()
                
        elif stage == 'Weighing':
            # For Weighing (Stage3), count only from Stage1 completed records
            completed_stage1_jobs = db.session.query(Stage1.job_no, Stage1.itemcode)\
                .filter(Stage1.status == 'completed')\
                .subquery()
            
            pending = db.session.query(Stage3)\
                .join(completed_stage1_jobs, 
                      (Stage3.job_no == completed_stage1_jobs.c.job_no) & 
                      (Stage3.itemcode == completed_stage1_jobs.c.itemcode))\
                .filter(Stage3.status == 'pending').count()
                
            completed = db.session.query(Stage3)\
                .join(completed_stage1_jobs, 
                      (Stage3.job_no == completed_stage1_jobs.c.job_no) & 
                      (Stage3.itemcode == completed_stage1_jobs.c.itemcode))\
                .filter(Stage3.status == 'completed').count()
        else:
            return jsonify({"success": False, "error": "Invalid stage"}), 400
        
        return jsonify({
            "success": True,
            "stage": stage,
            "pending": pending,
            "completed": completed,
            "total": pending + completed
        })
    except Exception as e:
        current_app.logger.error(f"Error in get_stage_status_summary: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500
    
@bp.route("/save_stage_data", methods=["POST"])
def save_stage_data():
    # Get form data
    stage = request.form.get('stage', '').strip()
    job_no = request.form.get('job_no', '').strip()
    itemcode = request.form.get('itemcode', '').strip()
    ocr_huid = request.form.get('ocr_huid', '').strip() if 'ocr_huid' in request.form else None
    
    # Check required fields
    if not all([stage, job_no, itemcode]):
        return jsonify({"success": False, "error": "Missing required parameters"}), 400

    try:
        if stage == "Stage1":
            record = Stage1.query.filter_by(job_no=job_no, itemcode=itemcode).first()
            if not record:
                return jsonify({"success": False, "error": "Stage1 record not found"}), 404
            
            # Handle image upload if present
            if 'image' in request.files:
                image_file = request.files['image']
                record.stage1_image = image_file.read()
            
            record.status = 'completed'
            db.session.commit()
            
            # Update HuidCapture table
            update_huid_capture(job_no, itemcode)
            return jsonify({"success": True, "message": "Stage1 data saved"})
        
        elif stage == "QC":
            record = Stage2.query.filter_by(job_no=job_no, itemcode=itemcode).first()
            if not record:
                return jsonify({"success": False, "error": "QC record not found"}), 404
            
            # Handle image upload if present
            if 'image' in request.files:
                image_file = request.files['image']
                record.qc_image = image_file.read()
            
            if ocr_huid:
                record.ocr_huid = ocr_huid
            
            record.status = 'completed'
            db.session.commit()
            
            # Update HuidCapture table
            update_huid_capture(job_no, itemcode)
            return jsonify({"success": True, "message": "QC data saved"})
        
        elif stage == "Weighing":
            record = Stage3.query.filter_by(job_no=job_no, itemcode=itemcode).first()
            if not record:
                return jsonify({"success": False, "error": "Weighing record not found"}), 404
            
            # Handle image upload if present
            if 'image' in request.files:
                image_file = request.files['image']
                record.weighing_image = image_file.read()
            
            # Get OCR from Stage2
            stage2_record = Stage2.query.filter_by(job_no=job_no, itemcode=itemcode).first()
            if stage2_record:
                record.ocr_huid = stage2_record.ocr_huid
            
            record.status = 'completed'
            db.session.commit()
            
            # Update HuidCapture table
            update_huid_capture(job_no, itemcode)
            return jsonify({"success": True, "message": "Weighing data saved"})
        
        return jsonify({"success": False, "error": "Invalid stage specified"}), 400
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    
def update_huid_capture(job_no, itemcode):
    """Update or create HuidCapture record when any stage is completed"""
    stage1 = Stage1.query.filter_by(job_no=job_no, itemcode=itemcode).first()
    stage2 = Stage2.query.filter_by(job_no=job_no, itemcode=itemcode).first()
    stage3 = Stage3.query.filter_by(job_no=job_no, itemcode=itemcode).first()
    
    huid_capture = HuidCapture.query.filter_by(job_no=job_no, itemcode=itemcode).first()
    if not huid_capture:
        huid_capture = HuidCapture()
        huid_capture.job_no = job_no
        huid_capture.itemcode = itemcode
        db.session.add(huid_capture)
    
    # Update fields based on available stage data
    if stage1:
        huid_capture.actual_huid = stage1.huid_no
        huid_capture.stage1_image = stage1.stage1_image
    if stage2:
        huid_capture.ocr_huid = stage2.ocr_huid
        huid_capture.qc_image = stage2.qc_image
    if stage3:
        huid_capture.weight = stage3.weight
        huid_capture.weighing_image = stage3.weighing_image
    
    # Set verification status if both HUIDs are available
    if huid_capture.actual_huid and huid_capture.ocr_huid:
        if huid_capture.actual_huid.upper() == huid_capture.ocr_huid.upper():
            huid_capture.verification = 'matched'
        else:
            huid_capture.verification = 'mismatched'
    elif huid_capture.ocr_huid:  # Only OCR HUID available
        huid_capture.verification = 'pending'
    else:  # No OCR HUID available
        huid_capture.verification = 'not_verified'
    
    db.session.commit()
     
@bp.route("/save_all_completed", methods=["POST"])
def save_all_completed():
    if not request.is_json:
        return jsonify({"success": False, "error": "Missing JSON in request"}), 400
        
    data = request.get_json() or {}
    job_no = data.get('job_no', '').strip()
    itemcode = data.get('itemcode', '').strip()
    
    if not all([job_no, itemcode]):
        return jsonify({"success": False, "error": "Missing job_no or itemcode"}), 400

    try:
        # Verify all stages are completed
        stage1 = Stage1.query.filter_by(job_no=job_no, itemcode=itemcode, status='completed').first()
        stage2 = Stage2.query.filter_by(job_no=job_no, itemcode=itemcode, status='completed').first()
        stage3 = Stage3.query.filter_by(job_no=job_no, itemcode=itemcode, status='completed').first()
        
        if not stage3:
            # If Stage3 isn't completed, complete it now
            stage3 = Stage3.query.filter_by(job_no=job_no, itemcode=itemcode).first()
            if not stage3:
                return jsonify({"success": False, "error": "Weighing record not found"}), 404
            
            stage3.status = 'completed'
            # Get OCR from Stage2 if not already set
            if not stage3.ocr_huid:
                stage2_record = Stage2.query.filter_by(job_no=job_no, itemcode=itemcode).first()
                if stage2_record:
                    stage3.ocr_huid = stage2_record.ocr_huid
            db.session.commit()
        
        # Verify again after potential update
        if not all([stage1, stage2, stage3]):
            missing = []
            if not stage1: missing.append("Stage1")
            if not stage2: missing.append("QC")
            if not stage3: missing.append("Weighing")
            return jsonify({
                "success": False, 
                "error": f"Missing completed stages: {', '.join(missing)}"
            }), 400
        
        # Check for existing HuidCapture record
        if HuidCapture.query.filter_by(job_no=job_no, itemcode=itemcode).first():
            return jsonify({
                "success": False, 
                "error": "Record already exists in HuidCapture"
            }), 400
        
        # Helper function to extract value from potential tuple
        def get_value(value):
            return value[0] if isinstance(value, tuple) and len(value) == 1 else value
        
        # Create new HuidCapture record
        new_capture = HuidCapture()
        new_capture.job_no = job_no
        new_capture.itemcode = itemcode
        new_capture.ocr_huid = get_value(stage2.ocr_huid) if stage2 else None
        new_capture.actual_huid = get_value(stage1.huid_no) if stage1 else None
        new_capture.weight = get_value(stage3.weight) if stage3 else None
        if new_capture.weight is not None and not isinstance(new_capture.weight, (float, int)):
          new_capture.weight = float(new_capture.weight)  

        new_capture.stage1_image = stage1.stage1_image if stage1 else None
        new_capture.qc_image = stage2.qc_image if stage2 else None
        new_capture.weighing_image = stage3.weighing_image if stage3 else None
        
        db.session.add(new_capture)
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Data saved to HuidCapture",
            "data": {
                "id": new_capture.id,
                "job_no": new_capture.job_no,
                "itemcode": new_capture.itemcode
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False, 
            "error": f"Database error: {str(e)}"
        }), 500
    
@bp.route("/check_completed_records")
def check_completed_records():
    try:
        # Find records where all stages are completed but not in HuidCapture
        completed = db.session.query(
            Stage1.job_no,
            Stage1.itemcode
        ).join(
            Stage2,
            (Stage1.job_no == Stage2.job_no) & (Stage1.itemcode == Stage2.itemcode)
        ).join(
            Stage3,
            (Stage1.job_no == Stage3.job_no) & (Stage1.itemcode == Stage3.itemcode)
        ).filter(
            Stage1.status == 'completed',
            Stage2.status == 'completed',
            Stage3.status == 'completed'
        ).outerjoin(
            HuidCapture,
            (Stage1.job_no == HuidCapture.job_no) & (Stage1.itemcode == HuidCapture.itemcode)
        ).filter(
            HuidCapture.id.is_(None)
        ).all()
        
        return jsonify({
            "success": True,
            "completed": [{"job_no": r[0], "itemcode": r[1]} for r in completed]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    
#delete a record from HuidCapture list
# @bp.route("/delete/<job_no>/<itemcode>", methods=["POST"])
# def delete_record(job_no, itemcode):
#     record = HuidCapture.query.filter_by(
#         job_no=job_no,
#         itemcode=itemcode
#     ).first()
    
#     if record:
#         db.session.delete(record)
#         db.session.commit()
#         return jsonify({"success": True})
#     return jsonify({"success": False, "error": "Record not found"}), 404

