from flask import Flask, render_template, request, jsonify
import pandas as pd
import os
import json
from datetime import datetime
import smtplib
from email.message import EmailMessage
from werkzeug.utils import secure_filename
import mimetypes
from pypdf import PdfReader


app = Flask(__name__)

# =========================
# CONFIGURATION
# =========================

UPLOAD_FOLDER = "uploads"

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# =========================
# HOME
# =========================

@app.route("/")
def home():
    return render_template("index.html")


# =========================
# PDF UPLOAD & EXTRACTION
# =========================

@app.route("/upload-pdf", methods=["POST"])
def upload_pdf():

    # Check whether a file was submitted
    if "file" not in request.files:
        return jsonify({
            "success": False,
            "message": "No PDF file uploaded."
        }), 400

    file = request.files["file"]

    # Check filename
    if file.filename == "":
        return jsonify({
            "success": False,
            "message": "No PDF file selected."
        }), 400

    # Only allow PDF files
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({
            "success": False,
            "message": "Only PDF files are allowed."
        }), 400

    try:

        # =========================
        # SAVE PDF
        # =========================

        filename = secure_filename(file.filename)

        pdf_path = os.path.join(
            app.config["UPLOAD_FOLDER"],
            filename
        )

        file.save(pdf_path)

        # =========================
        # READ PDF
        # =========================

        reader = PdfReader(pdf_path)

        extracted_pages = []

        for page in reader.pages:

            text = page.extract_text()

            if text:
                extracted_pages.append(text)

        extracted_text = "\n".join(extracted_pages)

        # =========================
        # CHECK EXTRACTION
        # =========================

        if not extracted_text.strip():

            return jsonify({
                "success": False,
                "message": "Could not extract text from this PDF."
            }), 400

        # =========================
        # SAVE EXTRACTED TEXT
        # =========================

        text_file = os.path.join(
            app.config["UPLOAD_FOLDER"],
            "extracted_pdf.txt"
        )

        with open(
            text_file,
            "w",
            encoding="utf-8"
        ) as output_file:

            output_file.write(extracted_text)

        # =========================
        # RESPONSE
        # =========================

        return jsonify({
            "success": True,
            "message": "PDF uploaded and text extracted successfully.",
            "filename": filename,
            "pages": len(reader.pages),
            "text": extracted_text
        })

    except Exception as error:

        print("PDF EXTRACTION ERROR:", error)

        return jsonify({
            "success": False,
            "message": "Could not process the PDF."
        }), 500


# =========================
# RUN APPLICATION
# =========================

if __name__ == "__main__":
    app.run(debug=True)